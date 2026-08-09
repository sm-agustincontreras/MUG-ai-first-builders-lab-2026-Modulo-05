import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_SALT_ROUNDS = 12;
const GENERIC_CREDENTIALS_ERROR = 'Credenciales inválidas';
const SESSION_EXPIRED_ERROR = 'Sesión expirada, iniciá sesión nuevamente';

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  refreshTokenHash: string | null;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Fixed-cost bcrypt hash compared against when the email does not exist,
  // so a "no such user" login takes roughly the same time as a "wrong
  // password" one — mitigates user enumeration by response timing
  // (threat model, POST /auth/login, Spoofing).
  private readonly dummyHash = bcrypt.hashSync('dummy-password-never-matches', BCRYPT_SALT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = (await this.prisma.user.findUnique({
      where: { email: dto.email },
    })) as AuthenticatedUser | null;

    if (!user) {
      await bcrypt.compare(dto.password, this.dummyHash);
      this.logger.warn('Login failed: no account for the given email');
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.logger.warn(`Login failed: wrong password (userId=${user.id})`);
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }

    const { accessToken, refreshToken } = await this.issueTokens(user);
    this.logger.log(`Login success (userId=${user.id})`);

    return { accessToken, refreshToken, user: UserResponseDto.fromEntity(user) };
  }

  async refresh(userId: string, presentedRefreshToken: string): Promise<RefreshResult> {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as AuthenticatedUser | null;

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException(SESSION_EXPIRED_ERROR);
    }

    const matches = await bcrypt.compare(presentedRefreshToken, user.refreshTokenHash);
    if (!matches) {
      // Valid by signature/expiration but does not match the currently
      // stored hash: it was already rotated away — a sign of reuse/theft.
      // Invalidate the whole session and force a re-login (threat model,
      // POST /auth/refresh, Elevation of Privilege).
      await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
      this.logger.warn(`Refresh token reuse detected, session invalidated (userId=${userId})`);
      throw new UnauthorizedException(SESSION_EXPIRED_ERROR);
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    this.logger.log(`Logout success (userId=${userId})`);
  }

  private async issueTokens(
    user: Pick<AuthenticatedUser, 'id' | 'email' | 'role'>,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.configService.get<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );
    const refreshToken = await this.jwtService.signAsync(
      // `jti` guarantees each rotation issues a genuinely distinct token
      // even if two rotations happen within the same second (same `sub`
      // and `iat` would otherwise sign to an identical string, which would
      // defeat reuse detection).
      { sub: user.id, jti: randomUUID() },
      { secret: this.configService.get<string>('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash } });

    return { accessToken, refreshToken };
  }
}
