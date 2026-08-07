import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { UserRole } from '../../generated/prisma';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UsersModule } from './users.module';

/**
 * Integration tests for UsersController (POST /users).
 *
 * Same rationale as `auth/auth.controller.spec.ts` (Block 2): there is no
 * live Postgres reachable in this sandbox, so `PrismaService` is mocked at
 * the I/O boundary while the rest of the stack (controller, guards,
 * service, passport strategies) is exercised end-to-end via supertest.
 */

const VALID_PASSWORD = 'ValidPass123';
const NEW_USER_PASSWORD = 'BrandNewPass123';

interface MockUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  refreshTokenHash: string | null;
  createdAt: Date;
}

function buildTestUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'usr_1',
    email: 'admin@tabsum.test',
    name: 'Admin User',
    passwordHash: bcrypt.hashSync(VALID_PASSWORD, 12),
    role: UserRole.ADMIN,
    refreshTokenHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock(seedUsers: MockUser[]) {
  const users = [...seedUsers];
  let counter = 0;

  const findUnique = jest.fn(({ where }: { where: { email?: string; id?: string } }) => {
    const found = users.find(
      (u) => (where.email !== undefined && u.email === where.email) || (where.id !== undefined && u.id === where.id),
    );
    return Promise.resolve(found ?? null);
  });

  const create = jest.fn(
    ({ data }: { data: { email: string; name: string; passwordHash: string; role: UserRole } }) => {
      counter += 1;
      const created: MockUser = {
        id: `usr_new_${counter}`,
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role,
        refreshTokenHash: null,
        createdAt: new Date('2026-08-05T00:00:00.000Z'),
      };
      users.push(created);
      return Promise.resolve(created);
    },
  );

  const update = jest.fn(
    ({ where, data }: { where: { id: string }; data: Partial<MockUser> }) => {
      const idx = users.findIndex((u) => u.id === where.id);
      if (idx === -1) {
        return Promise.resolve(null);
      }
      users[idx] = { ...users[idx], ...data };
      return Promise.resolve(users[idx]);
    },
  );

  return { users, user: { findUnique, create, update } };
}

async function buildApp(prismaMock: ReturnType<typeof createPrismaMock>): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, UsersModule],
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

async function loginAs(
  app: INestApplication,
  credentials: { email: string; password: string },
): Promise<string> {
  const response = await request(app.getHttpServer()).post('/auth/login').send(credentials);
  return response.body.accessToken as string;
}

describe('POST /users', () => {
  it('autenticado como Admin con datos válidos responde 201 y el usuario creado puede loguearse con el rol asignado (AC-04)', async () => {
    const admin = buildTestUser();
    const prismaMock = createPrismaMock([admin]);
    const app = await buildApp(prismaMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });

    const createResponse = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'nuevo.leader@tabsum.test',
        name: 'Nuevo Leader',
        password: NEW_USER_PASSWORD,
        role: 'LEADER',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      email: 'nuevo.leader@tabsum.test',
      name: 'Nuevo Leader',
      role: 'LEADER',
    });
    expect(createResponse.body.id).toEqual(expect.any(String));
    expect(createResponse.body.passwordHash).toBeUndefined();

    const newUserLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nuevo.leader@tabsum.test', password: NEW_USER_PASSWORD });

    expect(newUserLogin.status).toBe(200);
    expect(newUserLogin.body.user.role).toBe('LEADER');

    await app.close();
  });

  it('autenticado como no-Admin (PM/Líder/Recurso) responde 403 (AC-05)', async () => {
    const pmUser = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const prismaMock = createPrismaMock([pmUser]);
    const app = await buildApp(prismaMock);

    const pmToken = await loginAs(app, { email: pmUser.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ email: 'otro@tabsum.test', password: NEW_USER_PASSWORD, role: 'RESOURCE' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('No tenés permiso para realizar esta acción');

    await app.close();
  });

  it('sin autenticar responde 401', async () => {
    const prismaMock = createPrismaMock([]);
    const app = await buildApp(prismaMock);

    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'otro@tabsum.test', password: NEW_USER_PASSWORD, role: 'RESOURCE' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('No autenticado');

    await app.close();
  });

  it('con un email ya existente responde 409 y no crea un registro duplicado (AC-06)', async () => {
    const admin = buildTestUser();
    const existing = buildTestUser({
      id: 'usr_existing',
      email: 'ya.existe@tabsum.test',
      role: UserRole.RESOURCE,
    });
    const prismaMock = createPrismaMock([admin, existing]);
    const app = await buildApp(prismaMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });
    const usersBefore = prismaMock.users.length;

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: existing.email, name: 'Alguien', password: NEW_USER_PASSWORD, role: 'RESOURCE' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Ya existe una cuenta con ese email');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.users.length).toBe(usersBefore);

    await app.close();
  });

  it('con role fuera del enum UserRole responde 400', async () => {
    const admin = buildTestUser();
    const prismaMock = createPrismaMock([admin]);
    const app = await buildApp(prismaMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'invalido@tabsum.test', password: NEW_USER_PASSWORD, role: 'SUPERADMIN' });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('sin name responde 400 (AC-02)', async () => {
    const admin = buildTestUser();
    const prismaMock = createPrismaMock([admin]);
    const app = await buildApp(prismaMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'sin.nombre@tabsum.test', password: NEW_USER_PASSWORD, role: 'RESOURCE' });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('con name de 101 caracteres responde 400 (AC-02)', async () => {
    const admin = buildTestUser();
    const prismaMock = createPrismaMock([admin]);
    const app = await buildApp(prismaMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'nombre.largo@tabsum.test',
        name: 'a'.repeat(101),
        password: NEW_USER_PASSWORD,
        role: 'RESOURCE',
      });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('con name de solo espacios responde 400 (mitigación threat model)', async () => {
    const admin = buildTestUser();
    const prismaMock = createPrismaMock([admin]);
    const app = await buildApp(prismaMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'solo.espacios@tabsum.test',
        name: '   ',
        password: NEW_USER_PASSWORD,
        role: 'RESOURCE',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('El nombre no puede estar vacío');
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    await app.close();
  });
});
