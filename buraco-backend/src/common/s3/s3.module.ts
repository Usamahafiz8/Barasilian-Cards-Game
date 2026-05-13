import { Global, Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { S3Service } from './s3.service';

@Global()
@Module({
  imports: [SystemConfigModule],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
