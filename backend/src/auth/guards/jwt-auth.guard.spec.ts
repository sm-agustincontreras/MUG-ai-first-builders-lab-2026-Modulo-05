import { Controller, Get, INestApplication, Module, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';

// Throwaway controller, local to this spec, used only to verify the
// behaviour of JwtAuthGuard on any protected endpoint (reused as-is on
// Blocks 3/4 endpoints, not re-tested there).
@Controller('protected-probe')
class ProtectedProbeController {
  @UseGuards(JwtAuthGuard)
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [ProtectedProbeController] })
class ProtectedProbeModule {}

describe('JwtAuthGuard', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, ProtectedProbeModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: jest.fn(), update: jest.fn() } })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin header Authorization responde 401 (AC-03)', async () => {
    const response = await request(app.getHttpServer()).get('/protected-probe');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });

  it('con un token expirado responde 401 (AC-03)', async () => {
    // Relies on the default secret/config wired by AuthModule's
    // JwtModule.registerAsync (JWT_ACCESS_SECRET) — same one JwtStrategy
    // validates against.
    const expiredToken = await jwtService.signAsync(
      { sub: 'usr_1', email: 'user@tabsum.test', role: 'PM' },
      { expiresIn: '-10s' },
    );

    const response = await request(app.getHttpServer())
      .get('/protected-probe')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });
});
