import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfileModule } from './modules/profile/profile.module';
import { StatsModule } from './modules/stats/stats.module';
import { EconomyModule } from './modules/economy/economy.module';
import { MissionsModule } from './modules/missions/missions.module';
import { FriendsModule } from './modules/friends/friends.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { ShopModule } from './modules/shop/shop.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { GameEngineModule } from './modules/game-engine/game-engine.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { MatchHistoryModule } from './modules/match-history/match-history.module';
import { AdminModule } from './modules/admin/admin.module';
import { AppGateway } from './websocket/gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    StatsModule,
    EconomyModule,
    MissionsModule,
    FriendsModule,
    ClubsModule,
    RankingsModule,
    ShopModule,
    NotificationsModule,
    MatchmakingModule,
    RoomsModule,
    GameEngineModule,
    MessagingModule,
    MatchHistoryModule,
    AdminModule,
  ],
  providers: [
    AppGateway,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
