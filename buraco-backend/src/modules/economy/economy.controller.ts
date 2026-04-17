import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrencyType, TransactionType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EconomyService } from './economy.service';
import { GiftDto } from './dto/gift.dto';

@ApiTags('Economy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('economy')
export class EconomyController {
  constructor(private readonly economyService: EconomyService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current currency balances' })
  getBalance(@CurrentUser('id') userId: string) {
    return this.economyService.getBalance(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'currency', enum: CurrencyType, required: false })
  @ApiQuery({ name: 'type', enum: TransactionType, required: false })
  getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('currency') currency?: CurrencyType,
    @Query('type') type?: TransactionType,
  ) {
    return this.economyService.getTransactionHistory(userId, +page, +limit, currency, type);
  }

  @Post('gift')
  @ApiOperation({ summary: 'Send currency gift to another player' })
  sendGift(@CurrentUser('id') senderId: string, @Body() dto: GiftDto) {
    return this.economyService.sendGift(senderId, dto.receiverId, dto.currency, dto.amount);
  }
}
