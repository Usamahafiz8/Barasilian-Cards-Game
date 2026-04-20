import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../common/system-config/system-config.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
