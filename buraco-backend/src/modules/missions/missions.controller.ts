import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MissionsService } from './missions.service';

@ApiTags('Missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get active missions with progress' })
  getActiveMissions(@CurrentUser('id') userId: string) {
    return this.missionsService.getActiveMissions(userId);
  }

  @Post(':missionId/claim')
  @ApiOperation({ summary: 'Claim reward for a completed mission' })
  claimReward(@CurrentUser('id') userId: string, @Param('missionId') missionId: string) {
    return this.missionsService.claimReward(userId, missionId);
  }
}
