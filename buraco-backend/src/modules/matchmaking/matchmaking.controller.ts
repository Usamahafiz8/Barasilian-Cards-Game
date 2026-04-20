import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GameMode, GameVariant } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MatchmakingService } from './matchmaking.service';

class JoinQueueDto {
  @ApiProperty({ enum: GameMode, description: 'Game mode: CLASSIC or PROFESSIONAL' })
  @IsEnum(GameMode)
  mode: GameMode;

  @ApiProperty({ enum: GameVariant, description: 'Game variant: ONE_VS_ONE or TWO_VS_TWO' })
  @IsEnum(GameVariant)
  variant: GameVariant;
}

@ApiTags('Matchmaking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('join')
  @ApiOperation({ summary: 'Join the matchmaking queue. A room is auto-created when enough players are found.' })
  @ApiResponse({ status: 201, description: 'Queued successfully. Listen for room:update event on WebSocket.' })
  @ApiResponse({ status: 400, description: 'Already in queue' })
  joinQueue(@CurrentUser('id') userId: string, @Body() dto: JoinQueueDto) {
    return this.matchmakingService.joinQueue(userId, dto.mode, dto.variant);
  }

  @Delete('leave')
  @ApiOperation({ summary: 'Leave the matchmaking queue' })
  @ApiResponse({ status: 200, description: 'Removed from queue' })
  @ApiResponse({ status: 404, description: 'Not currently in queue' })
  leaveQueue(@CurrentUser('id') userId: string) {
    return this.matchmakingService.leaveQueue(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current queue status and wait time estimate' })
  @ApiResponse({ status: 200, description: 'Queue position and elapsed wait time' })
  getStatus(@CurrentUser('id') userId: string) {
    return this.matchmakingService.getQueueStatus(userId);
  }
}
