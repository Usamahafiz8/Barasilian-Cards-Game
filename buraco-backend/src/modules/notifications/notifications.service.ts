import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  private async sendPush(userId: string, title: string, body: string, data?: object): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
      if (!user?.fcmToken) return;

      const serverKey = process.env.FCM_SERVER_KEY;
      if (!serverKey) return;

      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          to: user.fcmToken,
          notification: { title, body },
          data: data ?? {},
        }),
      });
    } catch (err) {
      this.logger.error(`FCM push failed for user ${userId}`, err);
    }
  }

  async create(userId: string, type: NotificationType, title: string, body: string, data?: object) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data: data as any },
    });
    // Fire-and-forget push
    this.sendPush(userId, title, body, data).catch(() => {});
    return notification;
  }

  async getNotifications(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(unreadOnly && { isRead: false }) };
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async delete(userId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  }
}
