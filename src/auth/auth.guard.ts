import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Request } from 'express';
import type { Role, User } from '../database/schemas';

export const Public = () => SetMetadata('public', true);
export const Permit = (permission: string) =>
  SetMetadata('permission', permission);
export interface AuthRequest extends Request {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  };
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    @InjectModel('User') private users: Model<User>,
    @InjectModel('Role') private roles: Model<Role>,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.session;
    if (!token) throw new UnauthorizedException('Please sign in.');
    let payload: { sub: string; version: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    if (!/^[a-f\d]{24}$/i.test(payload.sub ?? ''))
      throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub).lean();
    if (!user?.active || user.tokenVersion !== payload.version)
      throw new UnauthorizedException();
    const role = await this.roles.findOne({ name: user.role }).lean();
    const needed = this.reflector.getAllAndOverride<string>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (needed && !role?.permissions.includes(needed))
      throw new ForbiddenException('Your role cannot perform this action.');
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: role?.permissions ?? [],
    };
    return true;
  }
}
