import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../generated/prisma';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user?: { role?: UserRole };
}

/**
 * Enforces the roles declared with `@Roles(...)` on a handler/controller.
 * Must run after `JwtAuthGuard` — it reads `request.user.role`, populated
 * by `JwtStrategy` from the access token payload (Block 2). Reusable by any
 * future domain module (NFR-03).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tenés permiso para realizar esta acción');
    }

    return true;
  }
}
