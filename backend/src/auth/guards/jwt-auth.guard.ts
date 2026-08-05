import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects any endpoint requiring a valid access token
 * (`Authorization: Bearer <token>`). Used directly in this block's tests
 * and reused as-is by Blocks 3/4.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Overrides Passport's default `UnauthorizedException()` (message
  // "Unauthorized") so every rejection at this guard — missing token,
  // invalid signature, expired token — surfaces the spec-mandated message
  // (AC-03, spec-FEAT-001.md, Block 2, "Error handling").
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('No autenticado');
    }
    return user;
  }
}
