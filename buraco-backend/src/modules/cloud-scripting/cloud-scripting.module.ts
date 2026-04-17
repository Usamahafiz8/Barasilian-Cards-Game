import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { CloudScriptingController } from './cloud-scripting.controller';
import { CloudScriptingService } from './cloud-scripting.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CloudScriptingController],
  providers: [CloudScriptingService],
  exports: [CloudScriptingService],
})
export class CloudScriptingModule {}
