import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry { value: string; expiresAt: number; }

@Injectable()
export class SystemConfigService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string, fallback = ''): Promise<string> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value || fallback;
    }
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    const dbValue = row?.value?.trim() ?? '';
    this.cache.set(key, { value: dbValue, expiresAt: Date.now() + this.TTL });
    // Return DB value if set, otherwise fall back to provided default (env var)
    return dbValue || fallback;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const v = await this.get(key, String(fallback));
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  }

  async getBool(key: string, fallback: boolean): Promise<boolean> {
    const v = await this.get(key, String(fallback));
    return v === 'true';
  }

  invalidate(key?: string) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}
