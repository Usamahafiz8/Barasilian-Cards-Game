import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MatchHistoryService } from './match-history.service';

@ApiTags('Match History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('match-history')
export class MatchHistoryController {
  constructor(private readonly matchHistoryService: MatchHistoryService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own match history' })
  getMyHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('mode') mode?: string,
  ) {
    return this.matchHistoryService.getPlayerHistory(userId, +page, +limit, mode);
  }

  @Get(':matchId')
  @ApiOperation({ summary: 'Get full match detail' })
  getMatchDetail(@Param('matchId') matchId: string) {
    return this.matchHistoryService.getMatchDetail(matchId);
  }
}
