import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClubRole, ClubType, MemberStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateClubDto } from './dto/create-club.dto';

@Injectable()
export class ClubsService {
  constructor(private prisma: PrismaService) {}

  async createClub(userId: string, dto: CreateClubDto) {
    const existing = await this.prisma.club.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('CLUB_NAME_TAKEN');

    const userClub = await this.prisma.clubMember.findFirst({ where: { userId, status: MemberStatus.ACTIVE } });
    if (userClub) throw new BadRequestException('ALREADY_IN_CLUB');

    return this.prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: { ...dto, memberCount: 1 },
      });
      await tx.clubMember.create({ data: { clubId: club.id, userId, role: ClubRole.LEADER, status: MemberStatus.ACTIVE } });
      await tx.conversation.create({ data: { type: 'CLUB', clubId: club.id } });
      return club;
    });
  }

  async updateClub(userId: string, clubId: string, dto: Partial<CreateClubDto>) {
    await this.requireRole(userId, clubId, [ClubRole.LEADER]);
    return this.prisma.club.update({ where: { id: clubId }, data: dto });
  }

  async deleteClub(userId: string, clubId: string) {
    await this.requireRole(userId, clubId, [ClubRole.LEADER]);
    return this.prisma.club.delete({ where: { id: clubId } });
  }

  async joinClub(userId: string, clubId: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');
    if (club.type === ClubType.REQUEST_BASED) throw new ForbiddenException('CLUB_REQUEST_BASED');

    const stats = await this.prisma.playerStats.findUnique({ where: { userId } });
    if (stats && stats.points < club.minPoints) throw new BadRequestException('INSUFFICIENT_POINTS');

    await this.prisma.$transaction(async (tx) => {
      await tx.clubMember.upsert({
        where: { clubId_userId: { clubId, userId } },
        create: { clubId, userId, role: ClubRole.MEMBER, status: MemberStatus.ACTIVE },
        update: { status: MemberStatus.ACTIVE },
      });
      await tx.club.update({ where: { id: clubId }, data: { memberCount: { increment: 1 } } });
    });
  }

  async requestToJoin(userId: string, clubId: string) {
    const existing = await this.prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } });
    if (existing) throw new ConflictException('Already a member or request pending');

    await this.prisma.clubMember.create({ data: { clubId, userId, role: ClubRole.MEMBER, status: MemberStatus.PENDING } });
  }

  async respondToRequest(leaderId: string, clubId: string, memberId: string, accept: boolean) {
    await this.requireRole(leaderId, clubId, [ClubRole.LEADER, ClubRole.VICE_LEADER]);

    const member = await this.prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId: memberId } } });
    if (!member || member.status !== MemberStatus.PENDING) throw new NotFoundException('Pending request not found');

    if (accept) {
      await this.prisma.$transaction(async (tx) => {
        await tx.clubMember.update({ where: { clubId_userId: { clubId, userId: memberId } }, data: { status: MemberStatus.ACTIVE } });
        await tx.club.update({ where: { id: clubId }, data: { memberCount: { increment: 1 } } });
      });
    } else {
      await this.prisma.clubMember.delete({ where: { clubId_userId: { clubId, userId: memberId } } });
    }
  }

  async removeMember(leaderId: string, clubId: string, memberId: string) {
    await this.requireRole(leaderId, clubId, [ClubRole.LEADER, ClubRole.VICE_LEADER]);
    await this.prisma.$transaction(async (tx) => {
      await tx.clubMember.delete({ where: { clubId_userId: { clubId, userId: memberId } } });
      await tx.club.update({ where: { id: clubId }, data: { memberCount: { decrement: 1 } } });
    });
  }

  async assignRole(leaderId: string, clubId: string, memberId: string, role: ClubRole) {
    await this.requireRole(leaderId, clubId, [ClubRole.LEADER]);
    return this.prisma.clubMember.update({ where: { clubId_userId: { clubId, userId: memberId } }, data: { role } });
  }

  async leaveClub(userId: string, clubId: string) {
    const member = await this.prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } });
    if (!member) throw new NotFoundException('Not a club member');
    if (member.role === ClubRole.LEADER) throw new BadRequestException('Leader must transfer leadership before leaving');

    await this.prisma.$transaction(async (tx) => {
      await tx.clubMember.delete({ where: { clubId_userId: { clubId, userId } } });
      await tx.club.update({ where: { id: clubId }, data: { memberCount: { decrement: 1 } } });
    });
  }

  async getClub(clubId: string, requestingUserId?: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: {
        members: {
          where: { status: MemberStatus.ACTIVE },
          include: { user: { select: { id: true, username: true, avatarUrl: true, stats: { select: { level: true } } } } },
        },
      },
    });
    if (!club) throw new NotFoundException('Club not found');

    let myRole: ClubRole | null = null;
    if (requestingUserId) {
      const membership = club.members.find((m) => m.userId === requestingUserId);
      myRole = membership?.role || null;
    }

    const progress = club.level > 0 ? Math.round(((club.points % (club.level * 1000)) / (club.level * 1000)) * 100) : 0;
    return { ...club, myRole, progressToNextLevel: progress };
  }

  async searchClubs(query?: string, mode?: string, type?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query) where.name = { contains: query, mode: 'insensitive' };
    if (mode) where.mode = mode;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.club.findMany({ where, skip, take: limit, orderBy: { memberCount: 'desc' } }),
      this.prisma.club.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async addClubPoints(clubId: string, points: number) {
    const club = await this.prisma.club.update({
      where: { id: clubId },
      data: { points: { increment: points } },
    });
    const nextLevelThreshold = club.level * 1000;
    if (club.points >= nextLevelThreshold) {
      await this.prisma.club.update({ where: { id: clubId }, data: { level: { increment: 1 } } });
    }
    return club;
  }

  private async requireRole(userId: string, clubId: string, roles: ClubRole[]) {
    const member = await this.prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } });
    if (!member || !roles.includes(member.role)) throw new ForbiddenException('Insufficient club permissions');
    return member;
  }
}
