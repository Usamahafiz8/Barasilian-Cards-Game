import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CloudScriptingService } from './cloud-scripting.service';

@ApiTags('CloudScripting')
@Controller('cloud-scripting')
export class CloudScriptingController {
  constructor(private readonly cloudScripting: CloudScriptingService) {}

  @Get('game-defaults')
  @Public()
  @ApiOperation({ summary: 'Get game default config values (used by Unity client on startup)' })
  getGameDefaults() {
    return this.cloudScripting.getGameDefaults();
  }

  @Get('config')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all config values (admin only)' })
  getAllConfigs() {
    return this.cloudScripting.getAllConfigs();
  }

  @Put('config/:key')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a config value at runtime (admin only)' })
  setConfig(
    @CurrentUser('id') adminId: string,
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    return this.cloudScripting.setConfig(key, value, adminId);
  }
}
