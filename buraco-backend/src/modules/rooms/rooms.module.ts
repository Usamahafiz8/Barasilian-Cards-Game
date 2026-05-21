import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { EconomyModule } from '../economy/economy.module';
import { GameEngineModule } from '../game-engine/game-engine.module';

@Module({
  imports: [EconomyModule, GameEngineModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
