import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RankingsService } from './rankings.service';

@ApiTags('Rankings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('classic')
  @ApiOperation({ summary: 'Get classic ranking leaderboard' })
  getClassicRanking(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.rankingsService.getClassicRanking(+page, +limit, userId);
  }

  @Get('international')
  @ApiOperation({ summary: 'Get international ranking leaderboard' })
  getInternationalRanking(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.rankingsService.getInternationalRanking(+page, +limit, userId);
  }

  @Get('player/:userId')
  @ApiOperation({ summary: 'Get ranked detail for a specific player' })
  getPlayerRank(@Param('userId') userId: string, @Query('type') type: 'classic' | 'international' = 'classic') {
    return this.rankingsService.getPlayerRank(userId, type);
  }
}
