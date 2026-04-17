import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private friendsService: FriendsService,
  ) {}

  async getOrCreateDirectConversation(userId1: string, userId2: string) {
    const blocked = await this.friendsService.isBlocked(userId1, userId2);
    if (blocked) throw new ForbiddenException('USER_BLOCKED');

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        members: { some: { userId: userId1 } },
        AND: [{ members: { some: { userId: userId2 } } }],
      },
    });

    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({ data: { type: 'DIRECT' } });
      await tx.conversationMember.createMany({
        data: [{ conversationId: conv.id, userId: userId1 }, { conversationId: conv.id, userId: userId2 }],
      });
      return conv;
    });
  }

  async getClubConversation(clubId: string) {
    return this.prisma.conversation.findUnique({ where: { clubId } });
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          where: { userId: { not: userId } },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
          take: 1,
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        club: { select: { id: true, name: true, iconUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCounts = await Promise.all(conversations.map((c) =>
      this.prisma.message.count({ where: { conversationId: c.id, isRead: false, senderId: { not: userId } } }),
    ));

    return conversations.map((c, idx) => ({
      id: c.id,
      type: c.type,
      participant: c.type === 'DIRECT' ? c.members[0]?.user : null,
      club: c.club,
      lastMessage: c.messages[0] || null,
      unreadCount: unreadCounts[idx],
    }));
  }

  async getHistory(conversationId: string, userId: string, page = 1, limit = 50) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: { sender: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return { data: data.reverse(), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    return this.prisma.message.create({
      data: { conversationId, senderId, type: 'TEXT', content },
      include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  async sendVoiceMessage(conversationId: string, senderId: string, voiceUrl: string, duration: number) {
    return this.prisma.message.create({
      data: { conversationId, senderId, type: 'VOICE', voiceUrl, duration },
      include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  async markAsRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }
}
