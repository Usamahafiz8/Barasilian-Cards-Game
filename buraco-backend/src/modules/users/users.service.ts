import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id, isDeleted: false } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email, isDeleted: false } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username, isDeleted: false } });
  }

  async findByIdOrThrow(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: Partial<{ username: string; avatarUrl: string; fcmToken: string; lastSeenAt: Date; coins: number; diamonds: number; lives: number }>) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { id, isDeleted: false } });
    return count > 0;
  }

  async updateLastSeen(id: string) {
    return this.prisma.user.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }
}
