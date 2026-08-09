import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AssignResourceDto } from './dto/assign-resource.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamCompositionResponseDto } from './dto/team-composition-response.dto';
import { TeamMemberResponseDto } from './dto/team-member-response.dto';
import { TeamResponseDto } from './dto/team-response.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto, ownerId: string): Promise<TeamResponseDto> {
    const trimmedName = dto.name.trim();
    const trimmedDescription = dto.description.trim();
    const nameNormalized = trimmedName.toLowerCase();

    const existing = await this.prisma.team.findUnique({ where: { nameNormalized } });
    if (existing) {
      throw new ConflictException('Ya existe un equipo con ese nombre');
    }

    const team = await this.prisma.team.create({
      data: { name: trimmedName, nameNormalized, description: trimmedDescription, ownerId },
    });
    return TeamResponseDto.fromEntity(team);
  }

  async assignResource(teamId: string, resourceId: string, requesterId: string): Promise<TeamMemberResponseDto> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Equipo no encontrado');
    }
    if (team.ownerId !== requesterId) {
      // Mitigación IDOR del threat model (AC-06): la propiedad del equipo se
      // verifica en el service, independiente del RolesGuard de rol.
      throw new ForbiddenException('No tenés permiso para realizar esta acción');
    }

    const resource = await this.prisma.user.findUnique({ where: { id: resourceId } });
    if (!resource || resource.role !== UserRole.RESOURCE) {
      throw new NotFoundException('Recurso no encontrado');
    }

    // Mitigación de condición de carrera del threat model: actualización
    // condicional atómica en vez de findUnique+update separados. Si count===0,
    // otra request ya asignó este recurso entre el check y este punto.
    const result = await this.prisma.user.updateMany({
      where: { id: resourceId, teamId: null },
      data: { teamId },
    });
    if (result.count === 0) {
      throw new ConflictException('El recurso ya pertenece a un equipo');
    }

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: resourceId } });
    return TeamMemberResponseDto.fromEntity(updated);
  }

  async listAvailableResources(): Promise<TeamMemberResponseDto[]> {
    const resources = await this.prisma.user.findMany({
      where: { role: UserRole.RESOURCE, teamId: null },
    });
    return resources.map((r) => TeamMemberResponseDto.fromEntity(r));
  }

  async listOwnedByLeader(ownerId: string): Promise<TeamResponseDto[]> {
    const teams = await this.prisma.team.findMany({ where: { ownerId } });
    return teams.map((t) => TeamResponseDto.fromEntity(t));
  }

  async listAllComposition(): Promise<TeamCompositionResponseDto[]> {
    const teams = await this.prisma.team.findMany({
      include: { owner: true, members: true },
      orderBy: { name: 'asc' },
    });
    return teams.map((t) => TeamCompositionResponseDto.fromEntity(t));
  }
}
