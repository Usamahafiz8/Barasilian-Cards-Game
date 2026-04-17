import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(config.get('google.clientId'));
  }

  async register(dto: RegisterDto) {
    const [existingEmail, existingUsername] = await Promise.all([
      dto.email ? this.prisma.user.findUnique({ where: { email: dto.email } }) : null,
      this.prisma.user.findUnique({ where: { username: dto.username } }),
    ]);

    if (existingEmail) throw new ConflictException('EMAIL_TAKEN');
    if (existingUsername) throw new ConflictException('USERNAME_TAKEN');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const newUserCoins = this.config.get<number>('game.newUserCoins');
    const newUserDiamonds = this.config.get<number>('game.newUserDiamonds');
    const newUserLives = this.config.get<number>('game.newUserLives');

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          username: dto.username,
          coins: newUserCoins,
          diamonds: newUserDiamonds,
          lives: newUserLives,
        },
      });
      await tx.playerStats.create({ data: { userId: created.id } });
      return created;
    });

    const tokens = await this.generateTokens(user.id, user.email ?? '');
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, isDeleted: false },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('INVALID_CREDENTIALS');
    if (user.isBanned) throw new ForbiddenException('ACCOUNT_BANNED');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const tokens = await this.generateTokens(user.id, user.email ?? '');
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async loginWithGoogle(dto: GoogleAuthDto) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.config.get('google.clientId'),
    });
    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException('Invalid Google token');

    const { sub: googleId, email, picture, name } = payload;
    let user = await this.prisma.user.findUnique({ where: { googleId } });
    let isNewUser = false;

    if (!user) {
      const username = await this.generateUsername(name || (email ?? '').split('@')[0]);
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            googleId,
            email,
            username,
            avatarUrl: picture,
            coins: this.config.get<number>('game.newUserCoins'),
            diamonds: this.config.get<number>('game.newUserDiamonds'),
            lives: this.config.get<number>('game.newUserLives'),
          },
        });
        await tx.playerStats.create({ data: { userId: created.id } });
        return created;
      });
      isNewUser = true;
    }

    if (user.isBanned) throw new ForbiddenException('ACCOUNT_BANNED');
    const tokens = await this.generateTokens(user.id, user.email ?? '');
    return { user: this.sanitizeUser(user), ...tokens, isNewUser };
  }

  async loginWithApple(dto: AppleAuthDto) {
    // Verify Apple identity token (simplified — production needs full JWT verification with Apple public keys)
    const parts = dto.identityToken.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid Apple token');

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const appleId = payload.sub;
    const email = payload.email;

    if (!appleId) throw new UnauthorizedException('Invalid Apple token payload');

    let user = await this.prisma.user.findUnique({ where: { appleId } });
    let isNewUser = false;

    if (!user) {
      const firstName = dto.fullName?.firstName || '';
      const lastName = dto.fullName?.lastName || '';
      const baseName = `${firstName}${lastName}`.trim() || (email ? email.split('@')[0] : 'Player');
      const username = await this.generateUsername(baseName);

      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            appleId,
            email: email || null,
            username,
            coins: this.config.get<number>('game.newUserCoins'),
            diamonds: this.config.get<number>('game.newUserDiamonds'),
            lives: this.config.get<number>('game.newUserLives'),
          },
        });
        await tx.playerStats.create({ data: { userId: created.id } });
        return created;
      });
      isNewUser = true;
    }

    if (user.isBanned) throw new ForbiddenException('ACCOUNT_BANNED');
    const tokens = await this.generateTokens(user.id, user.email ?? '');
    return { user: this.sanitizeUser(user), ...tokens, isNewUser };
  }

  async refreshToken(token: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    const hash = await this.hashToken(token);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.expiresAt < new Date()) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { tokenHash: hash } });
    const accessToken = this.signAccessToken(payload.sub, payload.email);
    return { accessToken, expiresIn: 900 };
  }

  async logout(userId: string, token: string) {
    const ttl = 900; // match access token TTL
    await this.redis.set(`blacklist:${token}`, '1', ttl);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email, isDeleted: false } });
    if (!user) return; // silent — don't leak user existence

    const otp = Math.random().toString(36).slice(2, 10).toUpperCase();
    await this.redis.set(`otp:${email}`, otp, 600); // 10 min TTL

    // TODO: send email via NodeMailer — plugged in when SMTP is configured
    // await this.mailer.sendPasswordReset(email, otp);
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Token format: base64(email):otp
    const decoded = Buffer.from(dto.token, 'base64').toString();
    const [email, otp] = decoded.split(':');
    if (!email || !otp) throw new BadRequestException('Invalid reset token');

    const stored = await this.redis.get(`otp:${email}`);
    if (!stored || stored !== otp) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { email }, data: { passwordHash } });
    await this.redis.del(`otp:${email}`);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException('No password set on this account');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async updateEmail(userId: string, email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('EMAIL_TAKEN');
    await this.prisma.user.update({ where: { id: userId }, data: { email } });
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    // Revoke all refresh tokens
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string) {
    const accessToken = this.signAccessToken(userId, email);
    const refreshToken = this.signRefreshToken(userId, email);

    const hash = await this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({ data: { userId, tokenHash: hash, expiresAt } });
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private signAccessToken(userId: string, email: string) {
    return this.jwt.sign(
      { sub: userId, email },
      { secret: this.config.get<string>('jwt.secret'), expiresIn: '15m' },
    );
  }

  private signRefreshToken(userId: string, email: string) {
    return this.jwt.sign(
      { sub: userId, email },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: '30d' },
    );
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 8);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, googleId, appleId, ...safe } = user;
    return safe;
  }

  private async generateUsername(base: string): Promise<string> {
    const clean = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15) || 'Player';
    let candidate = clean;
    let attempt = 0;
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      attempt++;
      candidate = `${clean}${Math.floor(Math.random() * 9000 + 1000)}`;
      if (attempt > 10) throw new ConflictException('Could not generate unique username');
    }
    return candidate;
  }
}
