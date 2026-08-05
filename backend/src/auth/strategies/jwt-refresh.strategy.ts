import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface RefreshTokenPayload {
  sub: string;
}

function extractRefreshTokenFromCookie(req: Request): string | null {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.refresh_token ?? null;
}

/**
 * Validates the refresh token carried by the httpOnly `refresh_token`
 * cookie (never a header, since the access token is already expired by the
 * time `/auth/refresh` is called). Only checks signature/expiration —
 * rotation/reuse detection against the stored hash happens in
 * `AuthService.refresh`.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: RefreshTokenPayload): RefreshTokenPayload {
    return { sub: payload.sub };
  }
}
