import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { UserRole } from '../../generated/prisma';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';

/**
 * Integration tests for AuthController (POST /auth/login, POST /auth/refresh).
 *
 * There is no live Postgres reachable in this sandbox (no docker, no local
 * postgres install, no sudo to install one) — the same condition that makes
 * `prisma.service.spec.ts` (Block 1) fail here today with
 * "Can't reach database server at `localhost:5432`". Per
 * `.daw/rules/testing.instructions.md` ("Mock the I/O layer... in unit
 * tests"), these tests mock `PrismaService` at the I/O boundary instead of
 * hitting a real database — the app (controller + guards + service +
 * passport strategies) is still exercised end-to-end via supertest.
 */

const VALID_PASSWORD = 'ValidPass123';

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  refreshTokenHash: string | null;
  createdAt: Date;
}

function buildTestUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'usr_1',
    email: 'user@tabsum.test',
    passwordHash: bcrypt.hashSync(VALID_PASSWORD, 12),
    role: UserRole.PM,
    refreshTokenHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

function extractRefreshCookie(setCookieHeader: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ''];
  const raw = cookies.find((cookie) => cookie.startsWith('refresh_token='));
  if (!raw) {
    throw new Error('refresh_token cookie not found in response');
  }
  return raw.split(';')[0].split('=')[1];
}

async function buildApp(prismaMock: ReturnType<typeof createPrismaMock>): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  await app.init();
  return app;
}

describe('POST /auth/login', () => {
  let app: INestApplication;
  const testUser = buildTestUser();

  beforeAll(async () => {
    const prismaMock = createPrismaMock();
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === testUser.email || where.id === testUser.id) {
          return Promise.resolve(testUser);
        }
        return Promise.resolve(null);
      },
    );
    prismaMock.user.update.mockResolvedValue(testUser);
    app = await buildApp(prismaMock);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con accessToken y setea la cookie refresh_token con credenciales válidas (AC-01)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.refreshTokenHash).toBeUndefined();
    expect(extractRefreshCookie(response.headers['set-cookie'])).toEqual(expect.any(String));
  });

  it('responde 401 con mensaje genérico cuando la password es incorrecta (AC-02)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: 'WrongPass123' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Credenciales inválidas');
  });

  it('responde 401 con el mismo mensaje genérico cuando el email no existe (AC-02)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'no-existe@tabsum.test', password: VALID_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Credenciales inválidas');
  });

  it('responde 400 cuando el DTO es inválido (email mal formado)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: VALID_PASSWORD });

    expect(response.status).toBe(400);
  });
});

describe('POST /auth/login — rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = createPrismaMock();
    prismaMock.user.findUnique.mockResolvedValue(null);
    app = await buildApp(prismaMock);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 429 al superar el límite de 5 intentos por minuto', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      // Sequential on purpose: the throttler counts requests as they are
      // processed, so this must not race.
      // eslint-disable-next-line no-await-in-loop
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'flood@tabsum.test', password: 'WrongPass123' });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});

describe('POST /auth/refresh', () => {
  it('con una cookie de refresh token válida responde 200 con un nuevo accessToken y rota la cookie', async () => {
    let testUser = buildTestUser();
    const prismaMock = createPrismaMock();
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === testUser.email || where.id === testUser.id) {
          return Promise.resolve(testUser);
        }
        return Promise.resolve(null);
      },
    );
    prismaMock.user.update.mockImplementation(
      ({ data }: { data: { refreshTokenHash: string | null } }) => {
        testUser = { ...testUser, refreshTokenHash: data.refreshTokenHash };
        return Promise.resolve(testUser);
      },
    );
    const app = await buildApp(prismaMock);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: VALID_PASSWORD });
    const firstCookie = extractRefreshCookie(loginResponse.headers['set-cookie']);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${firstCookie}`]);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    const rotatedCookie = extractRefreshCookie(refreshResponse.headers['set-cookie']);
    expect(rotatedCookie).not.toBe(firstCookie);

    await app.close();
  });

  it('reusando un refresh token ya rotado responde 401 e invalida la sesión', async () => {
    let testUser = buildTestUser();
    const prismaMock = createPrismaMock();
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === testUser.email || where.id === testUser.id) {
          return Promise.resolve(testUser);
        }
        return Promise.resolve(null);
      },
    );
    prismaMock.user.update.mockImplementation(
      ({ data }: { data: { refreshTokenHash: string | null } }) => {
        testUser = { ...testUser, refreshTokenHash: data.refreshTokenHash };
        return Promise.resolve(testUser);
      },
    );
    const app = await buildApp(prismaMock);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: VALID_PASSWORD });
    const oldCookie = extractRefreshCookie(loginResponse.headers['set-cookie']);

    const firstRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${oldCookie}`]);
    const rotatedCookie = extractRefreshCookie(firstRefresh.headers['set-cookie']);

    // Reuse the already-rotated (old) cookie: simulates a stolen/replayed token.
    const reuseResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${oldCookie}`]);
    expect(reuseResponse.status).toBe(401);
    expect(reuseResponse.body.message).toBe('Sesión expirada, iniciá sesión nuevamente');

    // The whole session must be invalidated: even the legitimately rotated
    // cookie no longer works afterwards.
    const followUp = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${rotatedCookie}`]);
    expect(followUp.status).toBe(401);
    expect(followUp.body.message).toBe('Sesión expirada, iniciá sesión nuevamente');

    await app.close();
  });

  it('sin cookie refresh_token responde 401', async () => {
    const prismaMock = createPrismaMock();
    const app = await buildApp(prismaMock);

    const response = await request(app.getHttpServer()).post('/auth/refresh');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Sesión expirada, iniciá sesión nuevamente');

    await app.close();
  });

  it('con una cookie cuyo token tiene firma inválida o está expirado responde 401', async () => {
    const prismaMock = createPrismaMock();
    const app = await buildApp(prismaMock);
    const jwtService = app.get(JwtService);

    const invalidSignatureToken = await jwtService.signAsync(
      { sub: 'usr_1' },
      { secret: 'a-secret-that-does-not-match-config', expiresIn: '7d' },
    );

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${invalidSignatureToken}`]);
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Sesión expirada, iniciá sesión nuevamente');

    await app.close();
  });
});
