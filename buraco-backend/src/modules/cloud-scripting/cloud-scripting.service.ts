import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const HARDCODED_DEFAULTS: Record<string, string> = {
  turnDuration: '30',
  entryFeeClassic: '100',
  entryFeeProfessional: '500',
  newUserCoins: '1000',
  newUserDiamonds: '50',
  newUserLives: '5',
};

@Injectable()
export class CloudScriptingService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getConfig(key: string): Promise<string> {
    // 1. Try Redis cache
    const cached = await this.redis.get(`config:${key}`);
    if (cached !== null) return cached;

    // 2. Try DB
    const dbConfig = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (dbConfig) return dbConfig.value;

    // 3. Hardcoded defaults
    return HARDCODED_DEFAULTS[key] ?? '';
  }

  async setConfig(key: string, value: string, adminId: string): Promise<void> {
    // Persist to Redis (no TTL — permanent until changed)
    await this.redis.set(`config:${key}`, value);

    // Upsert in DB
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedBy: adminId },
      create: { key, value, updatedBy: adminId },
    });
  }

  async getAllConfigs(): Promise<Record<string, string>> {
    const dbConfigs = await this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    const result: Record<string, string> = {};

    // Start with DB values
    for (const cfg of dbConfigs) {
      result[cfg.key] = cfg.value;
    }

    // Override with Redis values where present
    for (const cfg of dbConfigs) {
      const cached = await this.redis.get(`config:${cfg.key}`);
      if (cached !== null) {
        result[cfg.key] = cached;
      }
    }

    return result;
  }

  async getGameDefaults(): Promise<{
    turnDuration: number;
    entryFeeClassic: number;
    entryFeeProfessional: number;
    newUserCoins: number;
    newUserDiamonds: number;
    newUserLives: number;
  }> {
    const [turnDuration, entryFeeClassic, entryFeeProfessional, newUserCoins, newUserDiamonds, newUserLives] =
      await Promise.all([
        this.getConfig('turnDuration'),
        this.getConfig('entryFeeClassic'),
        this.getConfig('entryFeeProfessional'),
        this.getConfig('newUserCoins'),
        this.getConfig('newUserDiamonds'),
        this.getConfig('newUserLives'),
      ]);

    return {
      turnDuration: Number(turnDuration),
      entryFeeClassic: Number(entryFeeClassic),
      entryFeeProfessional: Number(entryFeeProfessional),
      newUserCoins: Number(newUserCoins),
      newUserDiamonds: Number(newUserDiamonds),
      newUserLives: Number(newUserLives),
    };
  }
}
