import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma';

export const ROLES_KEY = 'roles';

/**
 * Marks a handler/controller as requiring one of the given `UserRole`s.
 * Read by `RolesGuard` via `Reflector`. Reusable by any future domain
 * module, not just `users`.
 */
export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);
