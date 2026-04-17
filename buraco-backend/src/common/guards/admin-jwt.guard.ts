import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminJwtGuard extends AuthGuard('admin-jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) throw err || new UnauthorizedException('Admin access required');
    return user;
  }
}
