import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SystemConfigService } from '../../common/system-config/system-config.service';
import { v4 as uuidv4 } from 'uuid';

const PREDEFINED_AVATARS = [
  { id: 'avatar_001', name: 'Classic Blue', url: '/avatars/predefined/001.png' },
  { id: 'avatar_002', name: 'Fire Red', url: '/avatars/predefined/002.png' },
  { id: 'avatar_003', name: 'Forest Green', url: '/avatars/predefined/003.png' },
  { id: 'avatar_004', name: 'Golden Star', url: '/avatars/predefined/004.png' },
  { id: 'avatar_005', name: 'Ocean Wave', url: '/avatars/predefined/005.png' },
];

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private sysConfig: SystemConfigService,
  ) {}

  private async getS3Client() {
    const [region, accessKeyId, secretAccessKey] = await Promise.all([
      this.sysConfig.get('aws_region', this.config.get<string>('aws.region') ?? 'us-east-1'),
      this.sysConfig.get('aws_access_key_id', this.config.get<string>('aws.accessKeyId') ?? ''),
      this.sysConfig.get('aws_secret_access_key', this.config.get<string>('aws.secretAccessKey') ?? ''),
    ]);
    return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
      include: { stats: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, googleId, appleId, ...safe } = user;
    return safe;
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        stats: { select: { level: true, points: true, gamesPlayed: true, winPercentage: true, winStreak: true } },
        clubMemberships: {
          where: { status: 'ACTIVE' },
          select: { role: true, club: { select: { id: true, name: true, iconUrl: true } } },
          take: 1,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const membership = user.clubMemberships[0];
    return {
      ...user,
      club: membership ? { ...membership.club, role: membership.role } : null,
      clubMemberships: undefined,
    };
  }

  async updateUsername(userId: string, username: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) throw new ConflictException('USERNAME_TAKEN');
    return this.prisma.user.update({ where: { id: userId }, data: { username }, select: { id: true, username: true } });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const ext = file.originalname.split('.').pop();
    const key = `avatars/${userId}/${uuidv4()}.${ext}`;
    const [s3, bucket, region] = await Promise.all([
      this.getS3Client(),
      this.sysConfig.get('aws_s3_bucket', this.config.get<string>('aws.s3Bucket') ?? ''),
      this.sysConfig.get('aws_region', this.config.get<string>('aws.region') ?? 'us-east-1'),
    ]);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const avatarUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return { avatarUrl };
  }

  async setPredefinedAvatar(userId: string, predefinedId: string) {
    const avatar = PREDEFINED_AVATARS.find((a) => a.id === predefinedId);
    if (!avatar) throw new NotFoundException('Predefined avatar not found');
    const appUrl = this.config.get<string>('appUrl');
    const avatarUrl = `${appUrl}${avatar.url}`;
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return { avatarUrl };
  }

  getPredefinedAvatars() {
    const appUrl = this.config.get<string>('appUrl');
    return PREDEFINED_AVATARS.map((a) => ({ ...a, url: `${appUrl}${a.url}` }));
  }
}
