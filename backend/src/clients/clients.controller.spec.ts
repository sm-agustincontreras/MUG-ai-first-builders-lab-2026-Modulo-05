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
import { ClientsModule } from './clients.module';

/**
 * Integration tests for ClientsController (POST/GET /clients).
 *
 * Same rationale as `users/users.controller.spec.ts`: there is no live
 * Postgres reachable in this sandbox, so `PrismaService` is mocked at the
 * I/O boundary while the rest of the stack (controller, guards, service,
 * passport strategies) is exercised end-to-end via supertest.
 */

const VALID_PASSWORD = 'ValidPass123';

interface MockUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  refreshTokenHash: string | null;
  createdAt: Date;
}

interface MockClient {
  id: string;
  name: string;
  nameNormalized: string;
  description: string;
  createdAt: Date;
}

function buildTestUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'usr_1',
    email: 'pm@tabsum.test',
    name: 'Test PM',
    passwordHash: bcrypt.hashSync(VALID_PASSWORD, 12),
    role: UserRole.PM,
    refreshTokenHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createUserPrismaMock(seedUsers: MockUser[]) {
  const users = [...seedUsers];

  const findUnique = jest.fn(({ where }: { where: { email?: string; id?: string } }) => {
    const found = users.find(
      (u) => (where.email !== undefined && u.email === where.email) || (where.id !== undefined && u.id === where.id),
    );
    return Promise.resolve(found ?? null);
  });

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

  return { findUnique, update };
}

function createClientPrismaMock(seedClients: MockClient[] = []) {
  const clients = [...seedClients];
  let counter = 0;

  const findUnique = jest.fn(({ where }: { where: { nameNormalized?: string; id?: string } }) => {
    const found = clients.find(
      (c) =>
        (where.nameNormalized !== undefined && c.nameNormalized === where.nameNormalized) ||
        (where.id !== undefined && c.id === where.id),
    );
    return Promise.resolve(found ?? null);
  });

  const create = jest.fn(
    ({ data }: { data: { name: string; nameNormalized: string; description: string } }) => {
      counter += 1;
      const created: MockClient = {
        id: `client_new_${counter}`,
        name: data.name,
        nameNormalized: data.nameNormalized,
        description: data.description,
        createdAt: new Date(`2026-08-05T00:00:0${counter}.000Z`),
      };
      clients.push(created);
      return Promise.resolve(created);
    },
  );

  const findMany = jest.fn(({ orderBy }: { orderBy?: { createdAt?: 'asc' | 'desc' } } = {}) => {
    const sorted = [...clients];
    if (orderBy?.createdAt === 'asc') {
      sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return Promise.resolve(sorted);
  });

  return { clients, client: { findUnique, create, findMany } };
}

async function buildApp(
  userMock: ReturnType<typeof createUserPrismaMock>,
  clientMock: ReturnType<typeof createClientPrismaMock>,
): Promise<INestApplication> {
  const prismaMock = { user: userMock, client: clientMock.client };

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, ClientsModule],
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

describe('POST /clients', () => {
  it('autenticado como PM con datos válidos responde 201 con el cliente creado (AC-01)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Acme', description: 'Cliente de prueba' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Acme', description: 'Cliente de prueba' });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.nameNormalized).toBeUndefined();

    await app.close();
  });

  it('autenticado como no-PM (Admin/Líder/Recurso) responde 403 (AC-02)', async () => {
    const leader = buildTestUser({ id: 'usr_leader', email: 'leader@tabsum.test', role: UserRole.LEADER });
    const userMock = createUserPrismaMock([leader]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'Acme', description: 'Cliente de prueba' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('No tenés permiso para realizar esta acción');

    await app.close();
  });

  it('sin autenticar responde 401 (AC-02)', async () => {
    const userMock = createUserPrismaMock([]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const response = await request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'Acme', description: 'Cliente de prueba' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('No autenticado');

    await app.close();
  });

  it('con un name ya existente (mismo casing) responde 409 y no crea un registro duplicado (AC-03)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock([
      { id: 'client_1', name: 'Acme', nameNormalized: 'acme', description: 'Ya existente', createdAt: new Date('2026-01-01') },
    ]);
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });
    const clientsBefore = clientMock.clients.length;

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Acme', description: 'Otro cliente' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Ya existe un cliente con ese nombre');
    expect(clientMock.client.create).not.toHaveBeenCalled();
    expect(clientMock.clients.length).toBe(clientsBefore);

    await app.close();
  });

  it('con un name ya existente (distinto casing, "acme" vs "Acme") responde 409 (AC-03)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock([
      { id: 'client_1', name: 'Acme', nameNormalized: 'acme', description: 'Ya existente', createdAt: new Date('2026-01-01') },
    ]);
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'ACME', description: 'Otro cliente' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Ya existe un cliente con ese nombre');
    expect(clientMock.client.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('con name de 31 caracteres responde 400 (AC-04)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'a'.repeat(31), description: 'Cliente de prueba' });

    expect(response.status).toBe(400);
    expect(clientMock.client.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('con description de 256 caracteres responde 400 (AC-04)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Acme', description: 'a'.repeat(256) });

    expect(response.status).toBe(400);
    expect(clientMock.client.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('con name o description vacíos responde 400 (AC-05)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const emptyName = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: '', description: 'Cliente de prueba' });
    expect(emptyName.status).toBe(400);

    const emptyDescription = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Acme', description: '' });
    expect(emptyDescription.status).toBe(400);

    expect(clientMock.client.create).not.toHaveBeenCalled();

    await app.close();
  });
});

describe('GET /clients', () => {
  it('con rol PM y clientes existentes responde 200 con la lista ordenada por createdAt (AC-06)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock([
      { id: 'client_2', name: 'Beta', nameNormalized: 'beta', description: 'Segundo', createdAt: new Date('2026-02-01') },
      { id: 'client_1', name: 'Acme', nameNormalized: 'acme', description: 'Primero', createdAt: new Date('2026-01-01') },
    ]);
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${pmToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((c: { name: string }) => c.name)).toEqual(['Acme', 'Beta']);

    await app.close();
  });

  it('con rol PM y sin clientes responde 200 con [] (AC-06/AC-07)', async () => {
    const pm = buildTestUser();
    const userMock = createUserPrismaMock([pm]);
    const clientMock = createClientPrismaMock([]);
    const app = await buildApp(userMock, clientMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${pmToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    await app.close();
  });

  it('con rol distinto de PM responde 403 (AC-02)', async () => {
    const resource = buildTestUser({ id: 'usr_resource', email: 'resource@tabsum.test', role: UserRole.RESOURCE });
    const userMock = createUserPrismaMock([resource]);
    const clientMock = createClientPrismaMock();
    const app = await buildApp(userMock, clientMock);

    const resourceToken = await loginAs(app, { email: resource.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${resourceToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('No tenés permiso para realizar esta acción');

    await app.close();
  });
});
