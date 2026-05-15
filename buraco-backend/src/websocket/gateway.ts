import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GameEngineService } from '../modules/game-engine/game-engine.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import { RedisService } from '../common/redis/redis.service';
import { ReconnectionService } from '../modules/reconnection/reconnection.service';
import { RoomsService } from '../modules/rooms/rooms.service';
import { SocketService } from '../common/socket/socket.service';
import { MoveType, RoomStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(AppGateway.name);

  // Map userId → socketId for presence
  private userSockets = new Map<string, string>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private gameEngine: GameEngineService,
    private messaging: MessagingService,
    private redis: RedisService,
    private reconnection: ReconnectionService,
    private roomsService: RoomsService,
    private socketService: SocketService,
  ) {}

  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.logger.log('WebSocket gateway initialized');
  }

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
  async handleRoomJoin(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string } | string) {
    // Unity sends roomId as a plain string; web clients may send { roomId }
    const roomId = typeof data === 'string' ? data : data?.roomId;

    if (!roomId) {
      socket.emit('error', { code: 'INVALID_PAYLOAD', message: 'roomId is required' });
      return;
    }

    socket.join(`room:${roomId}`);
    socket.emit('room:joined_ack', { roomId });

    try {
      const room = await this.roomsService.getRoom(roomId);
      if (room.status !== RoomStatus.FULL) return;

      // Only one socket wins the lock to avoid double-starting the game
      const lockKey = `game:starting:${roomId}`;
      const locked = await this.redis.setNx(lockKey, '1', 30);
      if (!locked) return;

      try {
        const connectedSockets = await this.server.in(`room:${roomId}`).fetchSockets();
        const playerIds = connectedSockets.map((s) => s.data.userId as string).filter(Boolean);

        if (playerIds.length < room.maxPlayers) {
          await this.redis.del(lockKey);
          this.logger.warn(`Room ${roomId} is FULL but only ${playerIds.length}/${room.maxPlayers} sockets connected`);
          return;
        }

        const gameState = await this.gameEngine.startGame(roomId, room.mode, room.variant, playerIds);
        await this.roomsService.transitionToInProgress(roomId, gameState.gameId);

        this.server.to(`room:${roomId}`).emit('room:update', {
          roomId,
          gameId: gameState.gameId,
          status: 'IN_PROGRESS',
        });
        this.logger.log(`Game ${gameState.gameId} started for room ${roomId}`);
      } catch (err) {
        await this.redis.del(lockKey);
        this.logger.error(`Failed to start game for room ${roomId}`, err);
        socket.emit('error', { code: 'GAME_START_FAILED', message: (err as Error).message });
      }
    } catch (err) {
      this.logger.error(`room:join failed for room ${roomId}`, err);
      socket.emit('error', { code: 'ROOM_JOIN_FAILED', message: (err as Error).message });
    }
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

  private async broadcastGameState(gameId: string, lastMove: Record<string, unknown>, skipUserId?: string) {
    const sockets = await this.server.in(`game:${gameId}`).fetchSockets();
    await Promise.all(
      sockets.map(async (s) => {
        const userId = s.data.userId as string;
        if (!userId || userId === skipUserId) return;
        try {
          const view = await this.gameEngine.getGameState(gameId, userId);
          s.emit('game:state_updated', { lastMove, ...view });
        } catch {
          // Socket disconnected between move and broadcast — reconnect will sync
        }
      }),
    );
  }

  @SubscribeMessage('game:join')
  async handleGameJoin(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string }) {
    const userId = socket.data.userId;
    socket.join(`game:${data.gameId}`);
    await this.redis.set(`user:${userId}:activeGame`, data.gameId, 86400);
    await this.reconnection.setActiveGame(userId, data.gameId);

    // Emit full setup sequence so Unity can animate toss then deal.
    try {
      const view = await this.gameEngine.getGameState(data.gameId, userId);

      // 1 — stable seat map (same payload for every player)
      const seatMap = view.players
        .map((p) => ({
          playerId: p.userId,
          userId: p.userId,
          username: p.username,
          seatIndex: p.seatIndex,
          teamId: p.teamId,
        }))
        .sort((a, b) => a.seatIndex - b.seatIndex);

      socket.emit('game:start_snapshot', {
        gameId: data.gameId,
        seatMap,
        players: seatMap.map((s) => ({ id: s.userId, ...s })),
        turnOrder: view.turnOrder,
        currentTurnIndex: view.currentTurnIndex,
      });

      // 2 — toss result (Unity animates cards, shows winner)
      if (view.toss) {
        socket.emit('game:toss_result', { gameId: data.gameId, toss: view.toss });
      }

      // 3 — authoritative deal state (Unity animates real hand, not fake cards)
      socket.emit('game:deal_start', view);
    } catch (err) {
      this.logger.error(`game:join setup failed for ${userId} in game ${data.gameId}`, err);
    }
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
        const sockets = await this.server.in(`game:${data.gameId}`).fetchSockets();
        await Promise.all(sockets.map((s) => this.reconnection.clearActiveGame(s.data.userId)));
      } else {
        const lastMove: Record<string, unknown> = { type: data.source === 'STOCK' ? 'DRAW' : 'PICKUP_DISCARD', source: data.source, playerId: userId };
        if (data.source === 'STOCK' && result.result?.card) lastMove['drawnCardId'] = result.result.card.id;
        // Emit directly to the mover using the already-computed state — this reaches the socket
        // even when it hasn't joined the game room yet.
        socket.emit('game:state_updated', { lastMove, ...result.state });
        // Broadcast the authoritative per-player view to everyone else in the game room.
        await this.broadcastGameState(data.gameId, lastMove, userId);
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: (err as Error).message });
    }
  }

  @SubscribeMessage('game:move:discard')
  async handleDiscard(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string; cardId: string }) {
    const userId = socket.data.userId;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type: MoveType.DISCARD, cardIds: [data.cardId] });
      if (result && 'winnerTeam' in result) {
        this.server.to(`game:${data.gameId}`).emit('game:end', { gameId: data.gameId, ...result });
        const sockets = await this.server.in(`game:${data.gameId}`).fetchSockets();
        await Promise.all(sockets.map((s) => this.reconnection.clearActiveGame(s.data.userId)));
      } else {
        const lastMove = { type: 'DISCARD', playerId: userId, cardId: data.cardId };
        socket.emit('game:state_updated', { lastMove, ...result.state });
        await this.broadcastGameState(data.gameId, lastMove, userId);
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: (err as Error).message });
    }
  }

  @SubscribeMessage('game:move:meld')
  async handleMeld(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string; cardIds: string[] }) {
    const userId = socket.data.userId;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type: MoveType.PLAY_MELD, cardIds: data.cardIds });
      if (!('winnerTeam' in result)) {
        const lastMove = { type: 'MELD', playerId: userId, cardIds: data.cardIds };
        socket.emit('game:state_updated', { lastMove, ...result.state });
        await this.broadcastGameState(data.gameId, lastMove, userId);
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: (err as Error).message });
    }
  }

  @SubscribeMessage('game:move:add_to_meld')
  async handleAddToMeld(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string; meldId: string; cardIds: string[] }) {
    const userId = socket.data.userId;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type: MoveType.ADD_TO_MELD, meldId: data.meldId, cardIds: data.cardIds });
      if (!('winnerTeam' in result)) {
        const lastMove = { type: 'ADD_TO_MELD', playerId: userId, meldId: data.meldId, cardIds: data.cardIds };
        socket.emit('game:state_updated', { lastMove, ...result.state });
        await this.broadcastGameState(data.gameId, lastMove, userId);
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: (err as Error).message });
    }
  }

  @SubscribeMessage('game:move:pickup_pot')
  async handlePickupPot(@ConnectedSocket() socket: Socket, @MessageBody() data: { gameId: string }) {
    const userId = socket.data.userId;
    try {
      const result = await this.gameEngine.processMove(data.gameId, userId, { type: MoveType.PICKUP_POT });
      if (!('winnerTeam' in result)) {
        const lastMove = { type: 'PICKUP_POT', playerId: userId };
        socket.emit('game:state_updated', { lastMove, ...result.state });
        await this.broadcastGameState(data.gameId, lastMove, userId);
      }
    } catch (err) {
      socket.emit('game:move_invalid', { gameId: data.gameId, reason: (err as Error).message });
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
      socket.emit('error', { code: 'CHAT_ERROR', message: (err as Error).message });
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
