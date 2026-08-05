import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../../generated/prisma';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/**
 * Validates the access token sent via `Authorization: Bearer <token>`.
 * Used by `JwtAuthGuard` on every protected endpoint (this block and
 * Blocks 3/4).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AccessTokenPayload): AccessTokenPayload {
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
