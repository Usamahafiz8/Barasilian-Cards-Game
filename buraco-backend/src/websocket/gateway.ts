import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GameEngineService } from '../modules/game-engine/game-engine.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { RedisService } from '../common/redis/redis.service';
import { ReconnectionService } from '../modules/reconnection/reconnection.service';
import { MoveType } from '@prisma/client';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AppGateway.name);

  // Map userId → socketId for presence
  private userSockets = new Map<string, string>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private gameEngine: GameEngineService,
    private messaging: MessagingService,
    private notifications: NotificationsService,
    private redis: RedisService,
    private reconnection: ReconnectionService,
  ) {}

  // ─── Connection ───────────────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) { socket.disconnect(); return; }

    try {
      const payload = this.jwt.verify(token, { secret: this.config.get('jwt.secret') });
      socket.data.userId = payload.sub;
      this.userSockets.set(payload.sub, socket.id);
      await this.redis.set(`online:${payload.sub}`, '1', 30);
      this.logger.log(`User ${payload.sub} connected: ${socket.id}`);
      socket.emit('connect_ack', { userId: payload.sub, socketId: socket.id });
    } catch {
      socket.emit('error', { code: 'AUTH_FAILED', message: 'Invalid or expired token' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    if (!userId) return;
    this.userSockets.delete(userId);
    await this.redis.del(`online:${userId}`);
    this.logger.log(`User ${userId} disconnected`);

    // Handle in-game disconnect
    const activeGame = await this.redis.get(`user:${userId}:activeGame`);
    if (activeGame) {
      const timeout = this.config.get<number>('game.disconnectTimeoutSeconds');
      await this.redis.set(`disconnect:${userId}:${activeGame}`, '1', timeout);
      socket.to(`game:${activeGame}`).emit('game:player_disconnected', {
        gameId: activeGame,
        playerId: userId,
        reconnectWindowSeconds: timeout,
      });
    }
  }

  // ─── Presence ─────────────────────────────────────────────────────────────

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() socket: Socket) {
    const userId = socket.data.userId;
    if (userId) await this.redis.set(`online:${userId}`, '1', 30);
    socket.emit('pong', { timestamp: Date.now() });
  }

  // ─── Rooms ────────────────────────────────────────────────────────────────

  @SubscribeMessage('room:subscribe')
  handleRoomSubscribe(@ConnectedSocket() socket: Socket) {
    socket.join('room_lobby');
  }

  @SubscribeMessage('room:unsubscribe')
  handleRoomUnsubscribe(@ConnectedSocket() socket: Socket) {
    socket.leave('room_lobby');
  }

  @SubscribeMessage('room:join')
  handleRoomJoin(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    socket.join(`room:${data.roomId}`);
  }

  @SubscribeMessage('room:leave')
  handleRoomLeave(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    socket.leave(`room:${data.roomId}`);
  }

  broadcastRoomUpdate(action: string, room: any) {
    this.server.to('room_lobby').emit('room:list_update', { action, room });
  }

  broadcastPlayerJoined(roomId: string, player: any, currentPlayers: number, maxPlayers: number) {
    this.server.to(`room:${roomId}`).emit('room:player_joined', { roomId, player, currentPlayers, maxPlayers });
  }

  broadcastPlayerLeft(roomId: string, userId: string, username: string, currentPlayers: number) {
    this.server.to(`room:${roomId}`).emit('room:player_left', { roomId, userId, username, currentPlayers });
  }

  // ─── Game ─────────────────────────────────────────────────────────────────

  @SubscribeMessage('game:join')
  async handleGameJoin(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string }) {
    const userId = socket.data.userId;
    socket.join(`game:${data.gameId}`);
    await this.redis.set(`user:${userId}:activeGame`, data.gameId, 86400);
    await this.reconnection.setActiveGame(userId, data.gameId);
  }

  @SubscribeMessage('game:reconnect')
  async handleGameReconnect(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string }) {
    const userId = socket.data.userId;
    socket.join(`game:${data.gameId}`);

    const disconnectKey = `disconnect:${userId}:${data.gameId}`;
    const wasDisconnected = await this.redis.exists(disconnectKey);
    if (wasDisconnected) await this.redis.del(disconnectKey);

    const state = await this.gameEngine.getGameState(data.gameId, userId);
    socket.emit('game:state_sync', state);
    socket.to(`game:${data.gameId}`).emit('game:player_reconnected', { gameId: data.gameId, playerId: userId });
  }

  @SubscribeMessage('game:move:draw')
  async handleDraw(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string; source: 'STOCK' | 'DISCARD' }) {
    const userId = socket.data.userId;
    const type = data.source === 'DISCARD' ? MoveType.DRAW_DISCARD : MoveType.DRAW_STOCK;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type, source: data.source });
      if ('winnerTeam' in result) {
        this.server.to(`game:${data.gameId}`).emit('game:end', { gameId: data.gameId, ...result });
        // Clear active game for all players in the room
        const sockets = await this.server.in(`game:${data.gameId}`).fetchSockets();
        await Promise.all(sockets.map((s) => this.reconnection.clearActiveGame(s.data.userId)));
      } else {
        this.server.to(`game:${data.gameId}`).emit('game:move_played', { gameId: data.gameId, playerId: userId, moveType: type, result: result.result, nextTurnPlayerId: result.nextTurnPlayerId, turnTimeLimit: 30 });
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: err.message });
    }
  }

  @SubscribeMessage('game:move:discard')
  async handleDiscard(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string; cardId: string }) {
    const userId = socket.data.userId;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type: MoveType.DISCARD, cardIds: [data.cardId] });
      if (result && 'winnerTeam' in result) {
        this.server.to(`game:${data.gameId}`).emit('game:end', { gameId: data.gameId, ...result });
        // Clear active game for all players in the room
        const sockets = await this.server.in(`game:${data.gameId}`).fetchSockets();
        await Promise.all(sockets.map((s) => this.reconnection.clearActiveGame(s.data.userId)));
      } else {
        this.server.to(`game:${data.gameId}`).emit('game:move_played', { gameId: data.gameId, playerId: userId, moveType: MoveType.DISCARD, result: result.result, nextTurnPlayerId: result.nextTurnPlayerId, turnTimeLimit: 30 });
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: err.message });
    }
  }

  @SubscribeMessage('game:move:meld')
  async handleMeld(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string; cardIds: string[] }) {
    const userId = socket.data.userId;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type: MoveType.PLAY_MELD, cardIds: data.cardIds });
      if (!('winnerTeam' in result)) {
        this.server.to(`game:${data.gameId}`).emit('game:move_played', { gameId: data.gameId, playerId: userId, moveType: MoveType.PLAY_MELD, result: result.result });
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: err.message });
    }
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:send')
  async handleChatSend(@ConnectedSocket() socket: Socket, @MessageBody() data: { conversationId: string; content: string }) {
    const userId = socket.data.userId;
    try {
      const message = await this.messaging.sendMessage(data.conversationId, userId, data.content);
      this.server.to(`conv:${data.conversationId}`).emit('chat:message', message);
    } catch (err) {
      socket.emit('error', { code: 'CHAT_ERROR', message: err.message });
    }
  }

  @SubscribeMessage('chat:typing')
  handleTyping(@ConnectedSocket() socket: Socket, @MessageBody() data: { conversationId: string; isTyping: boolean }) {
    socket.to(`conv:${data.conversationId}`).emit('chat:typing', { conversationId: data.conversationId, userId: socket.data.userId, isTyping: data.isTyping });
  }

  @SubscribeMessage('chat:read')
  async handleChatRead(@ConnectedSocket() socket: Socket, @MessageBody() data: { conversationId: string }) {
    await this.messaging.markAsRead(data.conversationId, socket.data.userId);
    socket.to(`conv:${data.conversationId}`).emit('chat:read_receipt', { conversationId: data.conversationId, readByUserId: socket.data.userId, readAt: new Date().toISOString() });
  }

  // ─── Notification helpers ─────────────────────────────────────────────────

  async sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification:new', notification);
    }
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}
