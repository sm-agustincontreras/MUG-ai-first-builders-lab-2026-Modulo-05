export interface TeamCompositionMemberEntityLike {
  id: string;
  name: string;
}

/**
 * Shape returned by `GET /teams/composition` for a team's owner or a member.
 * Deliberately excludes `email`/`role`/`passwordHash`/`refreshTokenHash` —
 * same data-minimization criterion as `team-member-response.dto.ts`
 * (FEAT-003b), reinforced here because this endpoint is readable by
 * RESOURCE (threat model mitigation 2).
 */
export class TeamCompositionMemberDto {
  readonly id: string;
  readonly name: string;

  private constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  static fromEntity(user: TeamCompositionMemberEntityLike): TeamCompositionMemberDto {
    return new TeamCompositionMemberDto(user.id, user.name);
  }
}
