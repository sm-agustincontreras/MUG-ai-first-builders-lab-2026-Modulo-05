import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientResponseDto } from './dto/client-response.dto';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto): Promise<ClientResponseDto> {
    const trimmedName = dto.name.trim();
    const trimmedDescription = dto.description.trim();
    const nameNormalized = trimmedName.toLowerCase();

    const existing = await this.prisma.client.findUnique({ where: { nameNormalized } });
    if (existing) {
      // Explicit check first (FR-02/AC-03): gives a clean 409 with a clear
      // message. The `@@unique([nameNormalized])` constraint in the schema
      // is the final safety net against a race between this check and the
      // `create` below, not a replacement for it (NFR-01).
      throw new ConflictException('Ya existe un cliente con ese nombre');
    }

    const client = await this.prisma.client.create({
      data: { name: trimmedName, nameNormalized, description: trimmedDescription },
    });

    return ClientResponseDto.fromEntity(client);
  }

  async findAll(): Promise<ClientResponseDto[]> {
    const clients = await this.prisma.client.findMany({ orderBy: { createdAt: 'asc' } });
    return clients.map(ClientResponseDto.fromEntity);
  }
}
