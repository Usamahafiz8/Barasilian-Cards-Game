import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyType, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class EconomyService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, diamonds: true, lives: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async addCoins(userId: string, amount: number, type: TransactionType, referenceId?: string, description?: string, performedBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
      if (!user) throw new NotFoundException('User not found');
      const updated = await tx.user.update({ where: { id: userId }, data: { coins: { increment: amount } } });
      await tx.transaction.create({
        data: { userId, type, currency: CurrencyType.COINS, amount, balanceBefore: user.coins, balanceAfter: updated.coins, referenceId, description, performedBy },
      });
      return updated.coins;
    });
  }

  async deductCoins(userId: string, amount: number, type: TransactionType, referenceId?: string, description?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.coins < amount) throw new BadRequestException('INSUFFICIENT_BALANCE');
      const updated = await tx.user.update({ where: { id: userId }, data: { coins: { decrement: amount } } });
      await tx.transaction.create({
        data: { userId, type, currency: CurrencyType.COINS, amount: -amount, balanceBefore: user.coins, balanceAfter: updated.coins, referenceId, description },
      });
      return updated.coins;
    });
  }

  async addDiamonds(userId: string, amount: number, type: TransactionType, referenceId?: string, description?: string, performedBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { diamonds: true } });
      if (!user) throw new NotFoundException('User not found');
      const updated = await tx.user.update({ where: { id: userId }, data: { diamonds: { increment: amount } } });
      await tx.transaction.create({
        data: { userId, type, currency: CurrencyType.DIAMONDS, amount, balanceBefore: user.diamonds, balanceAfter: updated.diamonds, referenceId, description, performedBy },
      });
      return updated.diamonds;
    });
  }

  async deductDiamonds(userId: string, amount: number, type: TransactionType, referenceId?: string, description?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { diamonds: true } });
      if (!user) throw new NotFoundException('User not found');
      if (user.diamonds < amount) throw new BadRequestException('INSUFFICIENT_BALANCE');
      const updated = await tx.user.update({ where: { id: userId }, data: { diamonds: { decrement: amount } } });
      await tx.transaction.create({
        data: { userId, type, currency: CurrencyType.DIAMONDS, amount: -amount, balanceBefore: user.diamonds, balanceAfter: updated.diamonds, referenceId, description },
      });
      return updated.diamonds;
    });
  }

  async deductEntryFee(userId: string, roomId: string, fee: number) {
    if (fee <= 0) return;
    return this.deductCoins(userId, fee, TransactionType.ENTRY_FEE, roomId, 'Match entry fee');
  }

  async refundEntryFee(userId: string, roomId: string, fee: number) {
    if (fee <= 0) return;
    return this.addCoins(userId, fee, TransactionType.ENTRY_FEE_REFUND, roomId, 'Entry fee refund');
  }

  async distributeMatchReward(userId: string, gameId: string, coins: number, diamonds = 0) {
    const ops: Promise<any>[] = [];
    if (coins > 0) ops.push(this.addCoins(userId, coins, TransactionType.REWARD, gameId, 'Match win reward'));
    if (diamonds > 0) ops.push(this.addDiamonds(userId, diamonds, TransactionType.REWARD, gameId, 'Match win reward'));
    return Promise.all(ops);
  }

  async sendGift(senderId: string, receiverId: string, currency: CurrencyType, amount: number) {
    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId, isDeleted: false } });
    if (!receiver) throw new NotFoundException('USER_NOT_FOUND');

    const blocked = await this.prisma.block.findFirst({
      where: { OR: [{ blockerId: senderId, blockedId: receiverId }, { blockerId: receiverId, blockedId: senderId }] },
    });
    if (blocked) throw new ForbiddenException('USER_BLOCKED');

    await this.prisma.$transaction(async () => {
      if (currency === CurrencyType.COINS) {
        await this.deductCoins(senderId, amount, TransactionType.GIFT_SENT, receiverId, `Gift to ${receiverId}`);
        await this.addCoins(receiverId, amount, TransactionType.GIFT_RECEIVED, senderId, `Gift from ${senderId}`);
      } else {
        await this.deductDiamonds(senderId, amount, TransactionType.GIFT_SENT, receiverId, `Gift to ${receiverId}`);
        await this.addDiamonds(receiverId, amount, TransactionType.GIFT_RECEIVED, senderId, `Gift from ${senderId}`);
      }
    });
  }

  async getTransactionHistory(userId: string, page = 1, limit = 20, currency?: CurrencyType, type?: TransactionType) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(currency && { currency }), ...(type && { type }) };
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.transaction.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
