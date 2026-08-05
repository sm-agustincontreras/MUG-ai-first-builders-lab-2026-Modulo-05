import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects POST /auth/refresh: requires a valid `refresh_token` cookie. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  // Overrides Passport's default `UnauthorizedException()` (message
  // "Unauthorized") so every rejection resolved AT THIS GUARD — missing
  // cookie, invalid signature, expired token — surfaces the spec-mandated
  // message (spec-FEAT-001.md, Block 2, "Error handling"). Reuse-after-
  // rotation is detected downstream in `AuthService.refresh` (the guard
  // lets a signature/expiration-valid token through; `handleRequest` is not
  // involved there), which already throws the same message on that path.
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Sesión expirada, iniciá sesión nuevamente');
    }
    return user;
  }
}
