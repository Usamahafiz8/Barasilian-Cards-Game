import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { GameMode, GameVariant, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { RedisService } from '../../common/redis/redis.service';
import { SocketService } from '../../common/socket/socket.service';

interface CreateRoomOptions {
  mode: GameMode;
  variant: GameVariant;
  turnDuration?: number;
  entryFeeCoins?: number;
  minLevel?: number;
  minPoints?: number;
}

interface SeatEntry {
  seatIndex: number;
  teamId: number;
  userId: string;
  username: string;
  isConnected: boolean;
}

const DEFAULT_TABLES = [
  { mode: GameMode.CLASSIC,      variant: GameVariant.ONE_VS_ONE, label: 'Classic 1v1' },
  { mode: GameMode.PROFESSIONAL, variant: GameVariant.ONE_VS_ONE, label: 'Professional 1v1' },
  { mode: GameMode.CLASSIC,      variant: GameVariant.TWO_VS_TWO, label: 'Classic 2v2' },
  { mode: GameMode.PROFESSIONAL, variant: GameVariant.TWO_VS_TWO, label: 'Professional 2v2' },
];

@Injectable()
export class RoomsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private economyService: EconomyService,
    private redis: RedisService,
    private socketService: SocketService,
  ) {}

  async onModuleInit() {
    await this.purgeStaleCustomRooms();
    await this.ensureDefaultTables();
  }

  // ── Redis key helpers ──────────────────────────────────────────────────────

  private seatsKey(roomId: string) {
    return `room:${roomId}:seats`;
  }

  private defaultTableKey(mode: GameMode, variant: GameVariant) {
    return `default:table:${mode}:${variant}`;
  }

  // ── Stale room cleanup ─────────────────────────────────────────────────────

  private async purgeStaleCustomRooms() {
    await this.prisma.room.deleteMany({
      where: {
        isDefaultTable: false,
        status: RoomStatus.EMPTY,
        currentPlayers: 0,
      },
    });
  }

  // ── Default table management ───────────────────────────────────────────────

  private async ensureDefaultTables() {
    // One instance wins the lock per 30 s to avoid stampede on multi-instance restart
    const locked = await this.redis.setNx('default:tables:init:lock', '1', 30);
    if (!locked) return;

    for (const t of DEFAULT_TABLES) {
      await this.seedDefaultTableIfMissing(t.mode, t.variant, t.label);
    }
  }

  private async seedDefaultTableIfMissing(mode: GameMode, variant: GameVariant, label: string) {
    const key = this.defaultTableKey(mode, variant);
    const existingId = await this.redis.get(key);

    if (existingId) {
      const room = await this.prisma.room.findUnique({ where: { id: existingId } });
      if (room) return; // still valid
    }

    const maxPlayers = variant === GameVariant.ONE_VS_ONE ? 2 : 4;
    const room = await this.prisma.room.create({
      data: {
        mode,
        variant,
        maxPlayers,
        turnDuration: 30,
        entryFeeCoins: 0,
        status: RoomStatus.EMPTY,
        currentPlayers: 0,
        isDefaultTable: true,
        tableLabel: label,
      },
    });

    await this.redis.set(key, room.id);
  }

  private async getDefaultTableIds(): Promise<string[]> {
    const ids: string[] = [];
    for (const t of DEFAULT_TABLES) {
      const id = await this.redis.get(this.defaultTableKey(t.mode, t.variant));
      if (id) ids.push(id);
    }
    return ids;
  }

  // ── Seat enrichment ────────────────────────────────────────────────────────

  async enrichRoomWithSeats(room: any) {
    const hash = (await this.redis.hgetall(this.seatsKey(room.id))) ?? {};

    // Collect only numeric seat fields (skip "0:u" username fields)
    const seatFields = Object.entries(hash).filter(([f]) => !f.includes(':'));

    // Parallel fetch online status for all seated players
    const onlineFlags = await Promise.all(
      seatFields.map(([, userId]) => this.redis.get(`online:${userId}`)),
    );

    const seats: Record<string, { userId: string; username: string; teamId: number; isConnected: boolean }> = {};
    const seatList: SeatEntry[] = [];

    seatFields.forEach(([field, userId], i) => {
      const seatIndex = parseInt(field, 10);
      const username = hash[`${field}:u`] ?? '';
      const isConnected = !!onlineFlags[i];
      const teamId = seatIndex % 2 === 0 ? 1 : 2;

      seats[String(seatIndex)] = { userId, username, teamId, isConnected };
      seatList.push({ seatIndex, teamId, userId, username, isConnected });
    });

    seatList.sort((a, b) => a.seatIndex - b.seatIndex);
    return { ...room, seats, seatList };
  }

  async getRoomSeats(roomId: string): Promise<Record<string, string>> {
    return (await this.redis.hgetall(this.seatsKey(roomId))) ?? {};
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getRoomList() {
    const defaultIds = await this.getDefaultTableIds();

    const [defaultRooms, customRooms] = await Promise.all([
      this.prisma.room.findMany({ where: { id: { in: defaultIds } } }),
      this.prisma.room.findMany({
        where: {
          isDefaultTable: false,
          status: { in: [RoomStatus.WAITING, RoomStatus.FULL, RoomStatus.READY, RoomStatus.IN_PROGRESS] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Preserve the canonical DEFAULT_TABLES order for the first 4 slots
    const sortedDefaults = DEFAULT_TABLES
      .map((t) => defaultRooms.find((r) => r.mode === t.mode && r.variant === t.variant))
      .filter((r): r is NonNullable<typeof r> => !!r);

    return Promise.all([...sortedDefaults, ...customRooms].map((r) => this.enrichRoomWithSeats(r)));
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    return this.enrichRoomWithSeats(room);
  }

  async createRoom(userId: string, opts: CreateRoomOptions) {
    const maxPlayers = opts.variant === GameVariant.ONE_VS_ONE ? 2 : 4;
    const room = await this.prisma.room.create({
      data: {
        mode: opts.mode,
        variant: opts.variant,
        maxPlayers,
        turnDuration: opts.turnDuration ?? 30,
        entryFeeCoins: opts.entryFeeCoins ?? 0,
        minLevel: opts.minLevel,
        minPoints: opts.minPoints,
        status: RoomStatus.EMPTY,
        currentPlayers: 0,
        isDefaultTable: false,
      },
    });
    // Creator always gets seat 0 (team 1)
    return this.joinRoom(userId, room.id, 0);
  }

  async joinRoom(userId: string, roomId: string, requestedSeatIndex?: number) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === RoomStatus.IN_PROGRESS) throw new BadRequestException('ROOM_NOT_WAITING');
    if (room.status === RoomStatus.FULL) throw new BadRequestException('ROOM_FULL');

    // Level / points gate
    if (room.minLevel || room.minPoints) {
      const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
      if (stats && room.minLevel && stats.level < room.minLevel) throw new ForbiddenException('LEVEL_REQUIREMENT_NOT_MET');
      if (stats && room.minPoints && stats.points < room.minPoints) throw new ForbiddenException('POINTS_REQUIREMENT_NOT_MET');
    }

    if (room.entryFeeCoins > 0) {
      await this.economyService.deductEntryFee(userId, roomId, room.entryFeeCoins);
    }

    // ── Seat assignment ──────────────────────────────────────────────────────
    const seatsKey = this.seatsKey(roomId);
    const hash = (await this.redis.hgetall(seatsKey)) ?? {};

    // Only look at numeric seat fields for duplicate / occupancy checks
    const occupiedEntries = Object.entries(hash).filter(([f]) => !f.includes(':'));
    const occupiedUserIds = occupiedEntries.map(([, uid]) => uid);
    const occupiedSeats = new Set(occupiedEntries.map(([f]) => parseInt(f, 10)));

    if (occupiedUserIds.includes(userId)) throw new BadRequestException('ALREADY_IN_ROOM');

    const maxSeat = room.variant === GameVariant.TWO_VS_TWO ? 3 : 1;
    const allSeats = Array.from({ length: maxSeat + 1 }, (_, i) => i);

    let assignedSeat: number;

    if (requestedSeatIndex !== undefined) {
      if (requestedSeatIndex < 0 || requestedSeatIndex > maxSeat) throw new BadRequestException('INVALID_SEAT_INDEX');
      if (occupiedSeats.has(requestedSeatIndex)) throw new BadRequestException('SEAT_TAKEN');
      assignedSeat = requestedSeatIndex;
    } else {
      const available = allSeats.find((s) => !occupiedSeats.has(s));
      if (available === undefined) throw new BadRequestException('ROOM_FULL');
      assignedSeat = available;
    }

    // Look up username to store alongside the seat
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    const username = user?.username ?? '';

    await this.redis.hset(seatsKey, String(assignedSeat), userId);
    await this.redis.hset(seatsKey, `${assignedSeat}:u`, username);
    await this.redis.expire(seatsKey, 86400);

    // ── Update DB ────────────────────────────────────────────────────────────
    const newCount = room.currentPlayers + 1;
    const newStatus = newCount >= room.maxPlayers ? RoomStatus.FULL : RoomStatus.WAITING;

    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { increment: 1 }, status: newStatus },
    });

    // ── Broadcast lobby & room channel ───────────────────────────────────────
    const enriched = await this.enrichRoomWithSeats(updatedRoom);
    this.socketService.emitToRoom(`room:${roomId}`, 'room:update', enriched);
    this.socketService.emitToRoom('room_lobby', 'room:list_updated', enriched);

    const teamId = assignedSeat % 2 === 0 ? 1 : 2;
    return { ...updatedRoom, seatIndex: assignedSeat, teamId };
  }

  async leaveRoom(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    if (room.entryFeeCoins > 0 && room.status !== RoomStatus.IN_PROGRESS) {
      await this.economyService.refundEntryFee(userId, roomId, room.entryFeeCoins);
    }

    const seatsKey = this.seatsKey(roomId);
    const hash = (await this.redis.hgetall(seatsKey)) ?? {};
    const userSeat = Object.entries(hash).find(([f, uid]) => !f.includes(':') && uid === userId)?.[0];
    if (userSeat) {
      await this.redis.hdel(seatsKey, userSeat, `${userSeat}:u`);
    }

    const newCount = Math.max(0, room.currentPlayers - 1);

    if (newCount === 0 && !room.isDefaultTable) {
      await this.prisma.room.delete({ where: { id: roomId } });
      this.socketService.emitToRoom('room_lobby', 'room:removed', { roomId });
      return { ...room, currentPlayers: 0, status: RoomStatus.EMPTY };
    }

    const newStatus = newCount === 0 ? RoomStatus.EMPTY : RoomStatus.WAITING;

    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { decrement: 1 }, status: newStatus },
    });

    const enriched = await this.enrichRoomWithSeats(updatedRoom);
    this.socketService.emitToRoom(`room:${roomId}`, 'room:update', enriched);
    this.socketService.emitToRoom('room_lobby', 'room:list_updated', enriched);

    return updatedRoom;
  }

  async transitionToInProgress(roomId: string, gameId: string) {
    // Seat map is no longer needed once game state lives in Redis game state
    await this.redis.del(this.seatsKey(roomId));

    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.IN_PROGRESS, gameId },
    });

    // Immediately reseed the default slot so a new EMPTY table appears in the lobby
    if (updatedRoom.isDefaultTable) {
      const tableConfig = DEFAULT_TABLES.find(
        (t) => t.mode === updatedRoom.mode && t.variant === updatedRoom.variant,
      );
      const label = tableConfig?.label ?? updatedRoom.tableLabel ?? '';
      // Clear the Redis pointer so seedDefaultTableIfMissing creates a fresh room
      await this.redis.del(this.defaultTableKey(updatedRoom.mode, updatedRoom.variant));
      await this.seedDefaultTableIfMissing(updatedRoom.mode, updatedRoom.variant, label);
    }

    // Notify lobby that this room is now IN_PROGRESS
    const enriched = await this.enrichRoomWithSeats(updatedRoom);
    this.socketService.emitToRoom('room_lobby', 'room:list_updated', enriched);

    return updatedRoom;
  }

  async resetRoom(roomId: string) {
    return this.prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.EMPTY, currentPlayers: 0, gameId: null },
    });
  }
}
