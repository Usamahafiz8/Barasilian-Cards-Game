import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RankingsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getClassicRanking(page = 1, limit = 50, requestingUserId?: string) {
    return this.getRanking('ranking:classic', page, limit, requestingUserId);
  }

  async getInternationalRanking(page = 1, limit = 50, requestingUserId?: string) {
    return this.getRanking('ranking:international', page, limit, requestingUserId);
  }

  private async getRanking(key: string, page: number, limit: number, requestingUserId?: string) {
    const offset = (page - 1) * limit;
    const total = await this.redis.zcard(key);
    const entries = await this.redis.zrevrangebyscore(key, '+inf', '-inf', limit);

    // Fetch user details for top entries
    const userIds = entries.slice(offset, offset + limit);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isDeleted: false },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        stats: { select: { level: true, points: true } },
        clubMemberships: {
          where: { status: 'ACTIVE' },
          select: { role: true, club: { select: { name: true } } },
          take: 1,
        },
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const ranked = userIds.map((userId, idx) => {
      const user = userMap.get(userId);
      if (!user) return null;
      const membership = user.clubMemberships[0];
      return {
        rank: offset + idx + 1,
        user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl, level: user.stats?.level },
        points: user.stats?.points || 0,
        club: membership ? { name: membership.club.name, role: membership.role } : null,
      };
    }).filter(Boolean);

    let myRank: number | null = null;
    if (requestingUserId) {
      const rank = await this.redis.zrevrank(key, requestingUserId);
      myRank = rank !== null ? rank + 1 : null;
    }

    return { data: ranked, meta: { total, page, limit, totalPages: Math.ceil(total / limit), myRank } };
  }

  async getPlayerRank(userId: string, type: 'classic' | 'international') {
    const key = `ranking:${type}`;
    const rank = await this.redis.zrevrank(key, userId);
    const score = await this.redis.zscore(key, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, avatarUrl: true,
        stats: { select: { level: true, points: true, gamesPlayed: true, wins: true, winPercentage: true } },
        clubMemberships: {
          where: { status: 'ACTIVE' },
          select: { role: true, club: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });

    const membership = user?.clubMemberships?.[0];
    return {
      rank: rank !== null ? rank + 1 : null,
      points: score ? parseInt(score) : 0,
      user: { id: user?.id, username: user?.username, avatarUrl: user?.avatarUrl, level: user?.stats?.level },
      stats: user?.stats,
      club: membership ? { ...membership.club, role: membership.role } : null,
    };
  }
}
