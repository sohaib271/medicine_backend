import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { compare } from 'bcryptjs';
import { Model } from 'mongoose';
import type { CookieOptions, Response } from 'express';
import type { User } from '../database/schemas';
import { Public } from './auth.guard';
import type { AuthRequest } from './auth.guard';
import { LoginDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    @InjectModel('User') private users: Model<User>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api',
    };
  }
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.users
      .findOne({ email: dto.email.toLowerCase().trim(), active: true })
      .select('+passwordHash');
    // Always run bcrypt, including unknown accounts, to avoid a quick account-existence check.
    const valid = await compare(
      dto.password,
      user?.passwordHash ??
        '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
    );
    if (!user || !valid)
      throw new UnauthorizedException('Email or password is incorrect.');
    const token = await this.jwt.signAsync({
      sub: user._id.toString(),
      version: user.tokenVersion,
    });
    res.cookie('session', token, {
      ...this.cookieOptions(),
      maxAge: 20 * 24 * 60 * 60 * 1000,
    });
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
  @Get('me') me(@Req() req: AuthRequest) {
    return req.user;
  }
  @Post('logout') async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.users.updateOne(
      { _id: req.user.id },
      { $inc: { tokenVersion: 1 } },
    );
    res.clearCookie('session', this.cookieOptions());
    return { success: true };
  }
}
