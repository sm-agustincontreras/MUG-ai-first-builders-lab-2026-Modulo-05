export interface TeamMemberEntityLike {
  id: string;
  email: string;
  name: string;
}

/**
 * Shape returned by any endpoint that exposes a `User` acting as a team
 * member/resource (assignment, listing of available resources).
 * Deliberately excludes `role` (and everything else, including
 * `passwordHash`/`refreshTokenHash`) — the only consumer of this DTO already
 * fixes `role: RESOURCE` in its own query, so echoing it back is redundant
 * surface (arch-auditor finding folded into the spec).
 */
export class TeamMemberResponseDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;

  private constructor(id: string, email: string, name: string) {
    this.id = id;
    this.email = email;
    this.name = name;
  }

  static fromEntity(user: TeamMemberEntityLike): TeamMemberResponseDto {
    return new TeamMemberResponseDto(user.id, user.email, user.name);
  }
}
