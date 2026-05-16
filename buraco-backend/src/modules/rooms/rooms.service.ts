import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GameMode, GameVariant, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { RedisService } from '../../common/redis/redis.service';

interface CreateRoomOptions {
  mode: GameMode;
  variant: GameVariant;
  turnDuration?: number;
  entryFeeCoins?: number;
  minLevel?: number;
  minPoints?: number;
}

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private economyService: EconomyService,
    private redis: RedisService,
  ) {}

  private seatsKey(roomId: string) {
    return `room:${roomId}:seats`;
  }

  async getRoomSeats(roomId: string): Promise<Record<string, string>> {
    return (await this.redis.hgetall(this.seatsKey(roomId))) ?? {};
  }

  async createRoom(userId: string, opts: CreateRoomOptions) {
    const maxPlayers = opts.variant === GameVariant.ONE_VS_ONE ? 2 : 4;
    const room = await this.prisma.room.create({
      data: {
        mode: opts.mode,
        variant: opts.variant,
        maxPlayers,
        turnDuration: opts.turnDuration || 30,
        entryFeeCoins: opts.entryFeeCoins || 0,
        minLevel: opts.minLevel,
        minPoints: opts.minPoints,
        status: RoomStatus.EMPTY,
        currentPlayers: 0,
      },
    });
    // Creator always gets seat 0 (team 1)
    return this.joinRoom(userId, room.id, 0);
  }

  async joinRoom(userId: string, roomId: string, requestedSeatIndex?: number) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === RoomStatus.FULL || room.status === RoomStatus.IN_PROGRESS) throw new BadRequestException('ROOM_FULL');

    // Level / points check
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
    const seats = (await this.redis.hgetall(seatsKey)) ?? {};

    if (Object.values(seats).includes(userId)) throw new BadRequestException('ALREADY_IN_ROOM');

    let assignedSeat: number;

    if (room.variant === GameVariant.TWO_VS_TWO) {
      if (requestedSeatIndex !== undefined) {
        if (requestedSeatIndex < 0 || requestedSeatIndex > 3) throw new BadRequestException('INVALID_SEAT_INDEX');
        if (seats[String(requestedSeatIndex)]) throw new BadRequestException('SEAT_TAKEN');
        assignedSeat = requestedSeatIndex;
      } else {
        // Auto-assign first available seat when no preference given
        const occupied = new Set(Object.keys(seats).map(Number));
        const available = [0, 1, 2, 3].find((s) => !occupied.has(s));
        if (available === undefined) throw new BadRequestException('ROOM_FULL');
        assignedSeat = available;
      }
    } else {
      // 1v1: seat selection not supported
      if (requestedSeatIndex !== undefined) throw new BadRequestException('SEAT_SELECTION_NOT_SUPPORTED_FOR_1V1');
      assignedSeat = Object.keys(seats).length === 0 ? 0 : 1;
    }

    await this.redis.hset(seatsKey, String(assignedSeat), userId);
    await this.redis.expire(seatsKey, 86400);

    // ── Update DB ────────────────────────────────────────────────────────────
    const newCount = room.currentPlayers + 1;
    const newStatus = newCount >= room.maxPlayers ? RoomStatus.FULL : RoomStatus.WAITING;

    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { increment: 1 }, status: newStatus },
    });

    const teamId = assignedSeat % 2 === 0 ? 1 : 2;
    return { ...updatedRoom, seatIndex: assignedSeat, teamId };
  }

  async leaveRoom(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    if (room.entryFeeCoins > 0 && room.status !== RoomStatus.IN_PROGRESS) {
      await this.economyService.refundEntryFee(userId, roomId, room.entryFeeCoins);
    }

    // Free the player's seat
    const seatsKey = this.seatsKey(roomId);
    const seats = (await this.redis.hgetall(seatsKey)) ?? {};
    const userSeat = Object.entries(seats).find(([, uid]) => uid === userId)?.[0];
    if (userSeat) await this.redis.hdel(seatsKey, userSeat);

    const newCount = Math.max(0, room.currentPlayers - 1);
    const newStatus = newCount === 0 ? RoomStatus.EMPTY : RoomStatus.WAITING;

    return this.prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { decrement: 1 }, status: newStatus },
    });
  }

  async getRoomList(mode?: GameMode, variant?: GameVariant) {
    return this.prisma.room.findMany({
      where: {
        status: { in: [RoomStatus.WAITING, RoomStatus.READY, RoomStatus.EMPTY] },
        ...(mode && { mode }),
        ...(variant && { variant }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    const seats = (await this.redis.hgetall(this.seatsKey(roomId))) ?? {};
    return { ...room, seats };
  }

  async transitionToInProgress(roomId: string, gameId: string) {
    // Seat map is no longer needed once game state is in Redis
    await this.redis.del(this.seatsKey(roomId));
    return this.prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.IN_PROGRESS, gameId },
    });
  }

  async resetRoom(roomId: string) {
    return this.prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.EMPTY, currentPlayers: 0, gameId: null },
    });
  }
}
