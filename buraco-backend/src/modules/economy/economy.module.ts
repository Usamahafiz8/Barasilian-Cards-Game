import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../common/system-config/system-config.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [EconomyController],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
