import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameMode, GameVariant } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MatchmakingService } from './matchmaking.service';

class JoinQueueDto {
  @ApiProperty({ enum: GameMode }) @IsEnum(GameMode) mode: GameMode;
  @ApiProperty({ enum: GameVariant }) @IsEnum(GameVariant) variant: GameVariant;
}

@ApiTags('Matchmaking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('join')
  @ApiOperation({ summary: 'Join matchmaking queue' })
  joinQueue(@CurrentUser('id') userId: string, @Body() dto: JoinQueueDto) {
    return this.matchmakingService.joinQueue(userId, dto.mode, dto.variant);
  }

  @Delete('leave')
  @ApiOperation({ summary: 'Leave matchmaking queue' })
  leaveQueue(@CurrentUser('id') userId: string) {
    return this.matchmakingService.leaveQueue(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get queue status' })
  getStatus(@CurrentUser('id') userId: string) {
    return this.matchmakingService.getQueueStatus(userId);
  }
}
