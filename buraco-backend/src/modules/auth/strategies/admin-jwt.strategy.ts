import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('admin.jwtSecret') ?? '',
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!admin) throw new UnauthorizedException('Admin not found or inactive');
    return admin;
  }
}
