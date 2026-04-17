import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MissionRequirement, MissionType, TransactionType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';

const DAILY_MISSION_COUNT = 3;
const WEEKLY_MISSION_COUNT = 3;

@Injectable()
export class MissionsService {
  constructor(
    private prisma: PrismaService,
    private economyService: EconomyService,
  ) {}

  async getActiveMissions(userId: string) {
    await this.ensureMissionsAssigned(userId);

    const progress = await this.prisma.missionProgress.findMany({
      where: { userId, isClaimed: false },
      include: { mission: true },
    });

    const daily = progress.filter((p) => p.mission.type === MissionType.DAILY);
    const weekly = progress.filter((p) => p.mission.type === MissionType.WEEKLY);
    return { daily, weekly };
  }

  async claimReward(userId: string, missionId: string) {
    const progress = await this.prisma.missionProgress.findUnique({
      where: { userId_missionId: { userId, missionId } },
      include: { mission: true },
    });

    if (!progress) throw new NotFoundException('Mission not found');
    if (!progress.isCompleted) throw new BadRequestException('MISSION_NOT_COMPLETED');
    if (progress.isClaimed) throw new BadRequestException('REWARD_ALREADY_CLAIMED');

    await this.prisma.missionProgress.update({
      where: { userId_missionId: { userId, missionId } },
      data: { isClaimed: true, claimedAt: new Date() },
    });

    const { rewardCoins, rewardDiamonds } = progress.mission;
    const ops: Promise<any>[] = [];
    if (rewardCoins > 0) ops.push(this.economyService.addCoins(userId, rewardCoins, TransactionType.MISSION_REWARD, missionId));
    if (rewardDiamonds > 0) ops.push(this.economyService.addDiamonds(userId, rewardDiamonds, TransactionType.MISSION_REWARD, missionId));
    await Promise.all(ops);

    const balance = await this.economyService.getBalance(userId);
    return { reward: { coins: rewardCoins, diamonds: rewardDiamonds }, newBalance: balance };
  }

  async updateProgress(userId: string, event: MissionRequirement, value = 1) {
    const progresses = await this.prisma.missionProgress.findMany({
      where: { userId, isClaimed: false, mission: { requirement: event, isActive: true } },
      include: { mission: true },
    });

    for (const p of progresses) {
      if (p.isCompleted) continue;
      const newValue = Math.min(p.currentValue + value, p.mission.targetValue);
      const completed = newValue >= p.mission.targetValue;
      await this.prisma.missionProgress.update({
        where: { userId_missionId: { userId, missionId: p.missionId } },
        data: { currentValue: newValue, isCompleted: completed },
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyMissions() {
    await this.prisma.missionProgress.deleteMany({
      where: { mission: { type: MissionType.DAILY } },
    });
  }

  @Cron('0 0 * * 1') // Every Monday midnight
  async resetWeeklyMissions() {
    await this.prisma.missionProgress.deleteMany({
      where: { mission: { type: MissionType.WEEKLY } },
    });
  }

  private async ensureMissionsAssigned(userId: string) {
    const existingDaily = await this.prisma.missionProgress.count({
      where: { userId, mission: { type: MissionType.DAILY } },
    });

    if (existingDaily < DAILY_MISSION_COUNT) {
      await this.assignMissions(userId, MissionType.DAILY, DAILY_MISSION_COUNT - existingDaily);
    }

    const existingWeekly = await this.prisma.missionProgress.count({
      where: { userId, mission: { type: MissionType.WEEKLY } },
    });

    if (existingWeekly < WEEKLY_MISSION_COUNT) {
      await this.assignMissions(userId, MissionType.WEEKLY, WEEKLY_MISSION_COUNT - existingWeekly);
    }
  }

  private async assignMissions(userId: string, type: MissionType, count: number) {
    const existing = await this.prisma.missionProgress.findMany({
      where: { userId, mission: { type } },
      select: { missionId: true },
    });
    const excludeIds = existing.map((p) => p.missionId);

    const missions = await this.prisma.mission.findMany({
      where: { type, isActive: true, id: { notIn: excludeIds } },
      take: count,
      orderBy: { createdAt: 'asc' },
    });

    if (missions.length > 0) {
      await this.prisma.missionProgress.createMany({
        data: missions.map((m) => ({ userId, missionId: m.id })),
        skipDuplicates: true,
      });
    }
  }
}
