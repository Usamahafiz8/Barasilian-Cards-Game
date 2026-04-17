import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyType, ShopCategory, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private economyService: EconomyService,
  ) {}

  async getCatalog(category?: ShopCategory, userId?: string) {
    const items = await this.prisma.shopItem.findMany({
      where: { isActive: true, ...(category && { category }) },
      orderBy: { category: 'asc' },
    });

    if (!userId) return items;

    const owned = await this.prisma.inventory.findMany({ where: { userId }, select: { itemId: true } });
    const ownedSet = new Set(owned.map((o) => o.itemId));
    return items.map((item) => ({ ...item, isOwned: ownedSet.has(item.id) }));
  }

  async getItemById(itemId: string) {
    const item = await this.prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async purchaseItem(userId: string, itemId: string, currency: CurrencyType) {
    const item = await this.prisma.shopItem.findUnique({ where: { id: itemId, isActive: true } });
    if (!item) throw new NotFoundException('Item not found');

    if (!item.isConsumable) {
      const owned = await this.prisma.inventory.findUnique({ where: { userId_itemId: { userId, itemId } } });
      if (owned) throw new ConflictException('ITEM_ALREADY_OWNED');
    }

    const price = currency === CurrencyType.COINS ? item.priceCoins : item.priceDiamonds;
    if (!price) throw new BadRequestException(`Item not available for purchase with ${currency}`);

    await this.prisma.$transaction(async () => {
      if (currency === CurrencyType.COINS) {
        await this.economyService.deductCoins(userId, price, TransactionType.PURCHASE, itemId, `Purchase: ${item.name}`);
      } else {
        await this.economyService.deductDiamonds(userId, price, TransactionType.PURCHASE, itemId, `Purchase: ${item.name}`);
      }

      await this.prisma.inventory.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: { userId, itemId, quantity: 1 },
        update: { quantity: { increment: item.isConsumable ? 1 : 0 } },
      });
    });

    const balance = await this.economyService.getBalance(userId);
    return { item: { id: item.id, name: item.name }, newBalance: balance };
  }

  async getInventory(userId: string) {
    return this.prisma.inventory.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async equipItem(userId: string, itemId: string) {
    const inv = await this.prisma.inventory.findUnique({ where: { userId_itemId: { userId, itemId } } });
    if (!inv) throw new NotFoundException('Item not in inventory');

    const item = await this.getItemById(itemId);

    // Unequip other items of same category
    await this.prisma.$transaction(async (tx) => {
      await tx.inventory.updateMany({
        where: { userId, item: { category: item.category }, isEquipped: true },
        data: { isEquipped: false, equippedAt: null },
      });
      await tx.inventory.update({
        where: { userId_itemId: { userId, itemId } },
        data: { isEquipped: true, equippedAt: new Date() },
      });
    });
  }

  async getEquipped(userId: string) {
    return this.prisma.inventory.findMany({
      where: { userId, isEquipped: true },
      include: { item: true },
    });
  }

  async redeemCode(userId: string, code: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { code, isActive: true } });
    if (!promo) throw new NotFoundException('Invalid promo code');
    if (promo.expiresAt && promo.expiresAt < new Date()) throw new BadRequestException('Promo code expired');
    if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new BadRequestException('Promo code fully redeemed');

    await this.prisma.promoCode.update({ where: { code }, data: { usedCount: { increment: 1 } } });

    const rewards: any = {};
    if (promo.rewardCoins > 0) {
      await this.economyService.addCoins(userId, promo.rewardCoins, TransactionType.REWARD, promo.id, `Promo: ${code}`);
      rewards.coins = promo.rewardCoins;
    }
    if (promo.rewardDiamonds > 0) {
      await this.economyService.addDiamonds(userId, promo.rewardDiamonds, TransactionType.REWARD, promo.id, `Promo: ${code}`);
      rewards.diamonds = promo.rewardDiamonds;
    }
    if (promo.itemId) {
      await this.prisma.inventory.upsert({
        where: { userId_itemId: { userId, itemId: promo.itemId } },
        create: { userId, itemId: promo.itemId },
        update: {},
      });
      rewards.itemId = promo.itemId;
    }

    return { rewards };
  }
}
