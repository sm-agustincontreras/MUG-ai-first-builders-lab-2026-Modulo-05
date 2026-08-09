import { TeamCompositionMemberDto, TeamCompositionMemberEntityLike } from './team-composition-member.dto';

export interface TeamCompositionEntityLike {
  id: string;
  name: string;
  description: string;
  owner: TeamCompositionMemberEntityLike;
  members: TeamCompositionMemberEntityLike[];
}

/**
 * Shape returned by `GET /teams/composition`: a team's name, description,
 * owner and members — read-only, no action/mutation fields (threat model
 * mitigation 4).
 */
export class TeamCompositionResponseDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly owner: TeamCompositionMemberDto;
  readonly members: TeamCompositionMemberDto[];

  private constructor(
    id: string,
    name: string,
    description: string,
    owner: TeamCompositionMemberDto,
    members: TeamCompositionMemberDto[],
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.owner = owner;
    this.members = members;
  }

  static fromEntity(team: TeamCompositionEntityLike): TeamCompositionResponseDto {
    return new TeamCompositionResponseDto(
      team.id,
      team.name,
      team.description,
      TeamCompositionMemberDto.fromEntity(team.owner),
      team.members.map((m) => TeamCompositionMemberDto.fromEntity(m)),
    );
  }
}
