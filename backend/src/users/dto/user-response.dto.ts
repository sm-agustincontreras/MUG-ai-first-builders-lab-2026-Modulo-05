import { UserRole } from '../../../generated/prisma';

export interface UserEntityLike {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/**
 * Shape returned by any endpoint that exposes a `User` (login, refresh,
 * user creation in Block 3). Deliberately excludes `passwordHash` and
 * `refreshTokenHash` — the mapper only ever reads the whitelisted fields off
 * the source entity, so there is no field to accidentally leak.
 */
export class UserResponseDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly createdAt: Date;

  private constructor(id: string, email: string, name: string, role: UserRole, createdAt: Date) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.role = role;
    this.createdAt = createdAt;
  }

  static fromEntity(user: UserEntityLike): UserResponseDto {
    return new UserResponseDto(user.id, user.email, user.name, user.role, user.createdAt);
  }
}
