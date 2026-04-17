import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getStats(userId: string) {
    const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
    if (!stats) throw new NotFoundException('Stats not found');

    const xpToNext = this.xpForNextLevel(stats.level);
    return { ...stats, experienceToNextLevel: xpToNext - stats.experience };
  }

  async updateAfterMatch(userId: string, result: 'WIN' | 'LOSS' | 'ABANDONED', pointsEarned: number, xpEarned: number) {
    const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
    if (!stats) return;

    const isWin = result === 'WIN';
    const isLoss = result === 'LOSS';

    const newWins = isWin ? stats.wins + 1 : stats.wins;
    const newLosses = isLoss ? stats.losses + 1 : stats.losses;
    const newGamesLeft = result === 'ABANDONED' ? stats.gamesLeft + 1 : stats.gamesLeft;
    const newGamesPlayed = stats.gamesPlayed + 1;
    const newStreak = isWin ? stats.winStreak + 1 : 0;
    const newBestStreak = Math.max(stats.bestWinStreak, newStreak);
    const newXP = stats.experience + xpEarned;
    const newPoints = stats.points + pointsEarned;
    const newLevel = this.calculateLevel(newXP);
    const newWinPct = newGamesPlayed > 0 ? (newWins / newGamesPlayed) * 100 : 0;

    const updated = await this.prisma.playerStats.update({
      where: { userId },
      data: {
        wins: newWins,
        losses: newLosses,
        gamesLeft: newGamesLeft,
        gamesPlayed: newGamesPlayed,
        winStreak: newStreak,
        bestWinStreak: newBestStreak,
        experience: newXP,
        points: newPoints,
        level: newLevel,
        winPercentage: Math.round(newWinPct * 100) / 100,
      },
    });

    // Update Redis ranking sorted sets
    await this.redis.zadd('ranking:classic', newPoints, userId);
    await this.redis.zadd('ranking:international', newPoints, userId);

    return updated;
  }

  async addPoints(userId: string, points: number) {
    const stats = await this.prisma.playerStats.update({
      where: { userId },
      data: { points: { increment: points } },
    });
    await this.redis.zadd('ranking:classic', stats.points, userId);
    await this.redis.zadd('ranking:international', stats.points, userId);
    return stats;
  }

  calculateLevel(xp: number): number {
    let level = 1;
    let accumulated = 0;
    while (true) {
      const needed = this.xpForNextLevel(level);
      if (accumulated + needed > xp) break;
      accumulated += needed;
      level++;
    }
    return level;
  }

  private xpForNextLevel(level: number): number {
    if (level <= 10) return level * 100;
    if (level <= 30) return level * 200;
    return level * 350;
  }
}
