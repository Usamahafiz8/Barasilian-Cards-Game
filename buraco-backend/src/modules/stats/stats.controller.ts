import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get own stats' })
  getMyStats(@CurrentUser('id') userId: string) {
    return this.statsService.getStats(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: "Get another player's stats" })
  getStats(@Param('userId') userId: string) {
    return this.statsService.getStats(userId);
  }
}
