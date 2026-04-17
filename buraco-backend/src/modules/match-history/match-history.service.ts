import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MatchHistoryService {
  constructor(private prisma: PrismaService) {}

  async getPlayerHistory(userId: string, page = 1, limit = 20, mode?: string) {
    const skip = (page - 1) * limit;
    const where: any = { players: { some: { userId } }, ...(mode && { mode }) };
    const [data, total] = await Promise.all([
      this.prisma.matchRecord.findMany({
        where,
        include: {
          players: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
        },
        orderBy: { playedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.matchRecord.count({ where }),
    ]);

    const enriched = data.map((match) => {
      const myPlayer = match.players.find((p) => p.userId === userId);
      const scores = match.scores as Record<string, number>;
      const myScore = myPlayer ? scores[myPlayer.teamId] || 0 : 0;
      const oppTeam = myPlayer ? (myPlayer.teamId === 1 ? 2 : 1) : null;
      const oppScore = oppTeam ? scores[oppTeam] || 0 : 0;
      return { ...match, result: myPlayer?.result, myScore, opponentScore: oppScore };
    });

    return { data: enriched, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getMatchDetail(matchId: string) {
    return this.prisma.matchRecord.findUnique({
      where: { id: matchId },
      include: {
        players: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
        game: { include: { moves: { orderBy: { turnNumber: 'asc' } } } },
      },
    });
  }
}
