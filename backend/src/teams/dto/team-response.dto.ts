export interface TeamEntityLike {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
}

/**
 * Shape returned by any endpoint that exposes a `Team` (creation, listing).
 * Deliberately excludes `nameNormalized` — the mapper only ever reads the
 * five whitelisted fields off the source entity, same pattern as
 * `ClientResponseDto`.
 */
export class TeamResponseDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ownerId: string;
  readonly createdAt: Date;

  private constructor(id: string, name: string, description: string, ownerId: string, createdAt: Date) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.ownerId = ownerId;
    this.createdAt = createdAt;
  }

  static fromEntity(team: TeamEntityLike): TeamResponseDto {
    return new TeamResponseDto(team.id, team.name, team.description, team.ownerId, team.createdAt);
  }
}
