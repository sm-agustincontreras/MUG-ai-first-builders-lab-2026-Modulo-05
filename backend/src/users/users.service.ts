import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

// Same cost factor as AuthService (Block 2, NFR-01) — kept consistent
// across every place a password gets hashed.
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Explicit check first (FR-07/AC-06): gives a clean 409 with a clear
      // message. The `@@unique([email])` constraint in the schema is the
      // final safety net against a race between this check and the
      // `create` below, not a replacement for it.
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: dto.role },
    });

    return UserResponseDto.fromEntity(user);
  }
}
