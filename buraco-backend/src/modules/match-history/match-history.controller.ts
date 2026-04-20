import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get own paginated match history' })
  @ApiQuery({ name: 'page',  required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default 20)' })
  @ApiQuery({ name: 'mode',  required: false, type: String, description: 'Filter by game mode (CLASSIC | PROFESSIONAL)' })
  @ApiResponse({ status: 200, description: 'Paginated match list with result, score, and opponents' })
  getMyHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('mode') mode?: string,
  ) {
    return this.matchHistoryService.getPlayerHistory(userId, +page, +limit, mode);
  }

  @Get(':matchId')
  @ApiOperation({ summary: 'Get full match detail including all player scores and move count' })
  @ApiParam({ name: 'matchId', description: 'Match record UUID' })
  @ApiResponse({ status: 200, description: 'Full match detail' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  getMatchDetail(@Param('matchId') matchId: string) {
    return this.matchHistoryService.getMatchDetail(matchId);
  }
}
