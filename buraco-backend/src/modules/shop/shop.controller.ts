import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrencyType, ShopCategory } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ShopService } from './shop.service';

@ApiTags('Shop')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Get shop catalog' })
  getCatalog(@CurrentUser('id') userId: string, @Query('category') category?: ShopCategory) {
    return this.shopService.getCatalog(category, userId);
  }

  @Get('item/:itemId')
  @ApiOperation({ summary: 'Get single item detail' })
  getItem(@Param('itemId') itemId: string) {
    return this.shopService.getItemById(itemId);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase an item' })
  purchaseItem(
    @CurrentUser('id') userId: string,
    @Body('itemId') itemId: string,
    @Body('currency') currency: CurrencyType,
  ) {
    return this.shopService.purchaseItem(userId, itemId, currency);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Get own inventory' })
  getInventory(@CurrentUser('id') userId: string) {
    return this.shopService.getInventory(userId);
  }

  @Put('inventory/:itemId/equip')
  @ApiOperation({ summary: 'Equip an owned item' })
  equipItem(@CurrentUser('id') userId: string, @Param('itemId') itemId: string) {
    return this.shopService.equipItem(userId, itemId);
  }

  @Get('equipped')
  @ApiOperation({ summary: 'Get all equipped cosmetics' })
  getEquipped(@CurrentUser('id') userId: string) {
    return this.shopService.getEquipped(userId);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem a promo code' })
  redeemCode(@CurrentUser('id') userId: string, @Body('code') code: string) {
    return this.shopService.redeemCode(userId, code);
  }
}
