import { Module } from '@nestjs/common';
import { RedisModule } from '../../common/redis/redis.module';
import { ReconnectionService } from './reconnection.service';

@Module({
  imports: [RedisModule],
  providers: [ReconnectionService],
  exports: [ReconnectionService],
})
export class ReconnectionModule {}
