import { Global, Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [SystemConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
