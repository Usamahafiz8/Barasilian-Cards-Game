import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GameMode, GameVariant, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';

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
  ) {}

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
    return this.joinRoom(userId, room.id);
  }

  async joinRoom(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === RoomStatus.FULL || room.status === RoomStatus.IN_PROGRESS) throw new BadRequestException('ROOM_FULL');

    // Level check
    if (room.minLevel) {
      const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
      if (stats && stats.level < room.minLevel) throw new ForbiddenException('LEVEL_REQUIREMENT_NOT_MET');
    }

    // Points check
    if (room.minPoints) {
      const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
      if (stats && stats.points < room.minPoints) throw new ForbiddenException('POINTS_REQUIREMENT_NOT_MET');
    }

    if (room.entryFeeCoins > 0) {
      await this.economyService.deductEntryFee(userId, roomId, room.entryFeeCoins);
    }

    const newCount = room.currentPlayers + 1;
    const newStatus = newCount >= room.maxPlayers
      ? RoomStatus.FULL
      : newCount >= 2
        ? RoomStatus.WAITING
        : RoomStatus.WAITING;

    return this.prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { increment: 1 }, status: newStatus },
    });
  }

  async leaveRoom(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    if (room.entryFeeCoins > 0 && room.status !== RoomStatus.IN_PROGRESS) {
      await this.economyService.refundEntryFee(userId, roomId, room.entryFeeCoins);
    }

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
    return room;
  }

  async transitionToInProgress(roomId: string, gameId: string) {
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
