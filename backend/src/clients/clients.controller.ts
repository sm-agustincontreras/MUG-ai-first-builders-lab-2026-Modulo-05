import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientsService } from './clients.service';
import { ClientResponseDto } from './dto/client-response.dto';
import { CreateClientDto } from './dto/create-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // JwtAuthGuard must run before RolesGuard: it populates `request.user`
  // from the access token payload, which RolesGuard then checks against
  // @Roles(UserRole.PM) (FR-03/AC-02).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PM)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.clientsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PM)
  @Get()
  async findAll(): Promise<ClientResponseDto[]> {
    return this.clientsService.findAll();
  }
}
