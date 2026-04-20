import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own player stats (level, wins, points, streak …)' })
  @ApiResponse({ status: 200, description: 'Stats object returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyStats(@CurrentUser('id') userId: string) {
    return this.statsService.getStats(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: "Get another player's stats" })
  @ApiParam({ name: 'userId', description: 'Target player UUID' })
  @ApiResponse({ status: 200, description: 'Stats object returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Player not found' })
  getStats(@Param('userId') userId: string) {
    return this.statsService.getStats(userId);
  }
}
