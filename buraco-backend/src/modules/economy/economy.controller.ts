import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get current coin and diamond balances' })
  @ApiResponse({ status: 200, description: '{ coins: number, diamonds: number, lives: number }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getBalance(@CurrentUser('id') userId: string) {
    return this.economyService.getBalance(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get paginated transaction history' })
  @ApiQuery({ name: 'page',     required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit',    required: false, type: Number, description: 'Items per page (default 20)' })
  @ApiQuery({ name: 'currency', required: false, enum: CurrencyType, description: 'Filter by currency type' })
  @ApiQuery({ name: 'type',     required: false, enum: TransactionType, description: 'Filter by transaction type' })
  @ApiResponse({ status: 200, description: 'Paginated transaction list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('currency') currency?: CurrencyType,
    @Query('type') type?: TransactionType,
  ) {
    return this.economyService.getTransactionHistory(userId, +page, +limit, currency, type);
  }

  @Post('daily-claim')
  @HttpCode(200)
  @ApiOperation({ summary: 'Claim daily login reward coins' })
  @ApiResponse({ status: 200, description: 'Reward claimed or already claimed today' })
  claimDaily(@CurrentUser('id') userId: string) {
    return this.economyService.claimDailyReward(userId);
  }

  @Post('gift')
  @ApiOperation({ summary: 'Send coins or diamonds as a gift to another player' })
  @ApiResponse({ status: 201, description: 'Gift sent, both balances updated' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid amount' })
  @ApiResponse({ status: 404, description: 'Recipient not found' })
  sendGift(@CurrentUser('id') senderId: string, @Body() dto: GiftDto) {
    return this.economyService.sendGift(senderId, dto.receiverId, dto.currency, dto.amount);
  }
}
