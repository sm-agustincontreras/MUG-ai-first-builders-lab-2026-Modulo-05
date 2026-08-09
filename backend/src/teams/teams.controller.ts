import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../generated/prisma';
import { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignResourceDto } from './dto/assign-resource.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamCompositionResponseDto } from './dto/team-composition-response.dto';
import { TeamMemberResponseDto } from './dto/team-member-response.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamsService } from './teams.service';

// Reuses `AccessTokenPayload` (exported from `auth/strategies/jwt.strategy.ts`)
// instead of hand-narrowing a third `{ sub: string }` shape in the repo
// (arch-auditor finding from PLAN — closes the same divergent pattern
// already duplicated in `auth.controller.ts`).
interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // JwtAuthGuard must run before RolesGuard: it populates `request.user`
  // from the access token payload, which RolesGuard then checks against
  // @Roles(UserRole.LEADER).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LEADER)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@Body() dto: CreateTeamDto, @Req() req: AuthenticatedRequest): Promise<TeamResponseDto> {
    return this.teamsService.create(dto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LEADER)
  @HttpCode(HttpStatus.OK)
  @Post(':teamId/members')
  async assignResource(
    @Param('teamId') teamId: string,
    @Body() dto: AssignResourceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TeamMemberResponseDto> {
    return this.teamsService.assignResource(teamId, dto.resourceId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LEADER)
  @Get('available-resources')
  async listAvailableResources(): Promise<TeamMemberResponseDto[]> {
    return this.teamsService.listAvailableResources();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LEADER)
  @Get('mine')
  async listMine(@Req() req: AuthenticatedRequest): Promise<TeamResponseDto[]> {
    return this.teamsService.listOwnedByLeader(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PM, UserRole.LEADER, UserRole.RESOURCE)
  @Get('composition')
  async listComposition(): Promise<TeamCompositionResponseDto[]> {
    return this.teamsService.listAllComposition();
  }
}
