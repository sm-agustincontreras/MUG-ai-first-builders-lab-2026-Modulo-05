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
import { TeamsModule } from './teams.module';

/**
 * Integration tests for TeamsController (POST/GET /teams and friends).
 *
 * Same rationale as `clients/clients.controller.spec.ts`: `PrismaService` is
 * mocked at the I/O boundary while the rest of the stack (controller,
 * guards, service, passport strategies) is exercised end-to-end via
 * supertest.
 *
 * The `user.updateMany` mock below is deliberately a single synchronous
 * check-and-mutate step (no `await` before the array write) — that mirrors
 * what makes Postgres's `UPDATE ... WHERE id = ? AND team_id IS NULL`
 * atomic, and it is what makes the concurrent-assignment test below
 * deterministic: JS is single-threaded, so two calls into this mock can
 * never both observe `teamId === null` before either one writes.
 */

const VALID_PASSWORD = 'ValidPass123';

interface MockUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  refreshTokenHash: string | null;
  teamId: string | null;
  createdAt: Date;
}

interface MockTeam {
  id: string;
  name: string;
  nameNormalized: string;
  description: string;
  ownerId: string;
  createdAt: Date;
}

function buildTestUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'usr_1',
    email: 'leader@tabsum.test',
    name: 'Test Leader',
    passwordHash: bcrypt.hashSync(VALID_PASSWORD, 12),
    role: UserRole.LEADER,
    refreshTokenHash: null,
    teamId: null,
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

  const findUniqueOrThrow = jest.fn(({ where }: { where: { id: string } }) => {
    const found = users.find((u) => u.id === where.id);
    if (!found) {
      return Promise.reject(new Error('Record not found'));
    }
    return Promise.resolve(found);
  });

  const update = jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockUser> }) => {
    const idx = users.findIndex((u) => u.id === where.id);
    if (idx === -1) {
      return Promise.resolve(null);
    }
    users[idx] = { ...users[idx], ...data };
    return Promise.resolve(users[idx]);
  });

  // Synchronous check-and-mutate — see file header comment.
  const updateMany = jest.fn(
    ({ where, data }: { where: { id: string; teamId: null }; data: Partial<MockUser> }) => {
      const idx = users.findIndex((u) => u.id === where.id && u.teamId === where.teamId);
      if (idx === -1) {
        return Promise.resolve({ count: 0 });
      }
      users[idx] = { ...users[idx], ...data };
      return Promise.resolve({ count: 1 });
    },
  );

  const findMany = jest.fn(({ where }: { where?: { role?: UserRole; teamId?: null } } = {}) => {
    const filtered = users.filter((u) => {
      if (where?.role !== undefined && u.role !== where.role) return false;
      if (where && 'teamId' in where && u.teamId !== where.teamId) return false;
      return true;
    });
    return Promise.resolve(filtered);
  });

  return { users, user: { findUnique, findUniqueOrThrow, update, updateMany, findMany } };
}

/**
 * `seedUsers` is only consulted by `findMany` when called with `include`
 * (the shape `listAllComposition` uses) — it cross-references `ownerId`/
 * `teamId` against the seeded users to resolve the `owner`/`members`
 * relations, mirroring what Prisma's real `include` does.
 */
function createTeamPrismaMock(seedTeams: MockTeam[] = [], seedUsers: MockUser[] = []) {
  const teams = [...seedTeams];
  let counter = 0;

  const findUnique = jest.fn(({ where }: { where: { nameNormalized?: string; id?: string } }) => {
    const found = teams.find(
      (t) =>
        (where.nameNormalized !== undefined && t.nameNormalized === where.nameNormalized) ||
        (where.id !== undefined && t.id === where.id),
    );
    return Promise.resolve(found ?? null);
  });

  const create = jest.fn(
    ({
      data,
    }: {
      data: { name: string; nameNormalized: string; description: string; ownerId: string };
    }) => {
      counter += 1;
      const created: MockTeam = {
        id: `team_new_${counter}`,
        name: data.name,
        nameNormalized: data.nameNormalized,
        description: data.description,
        ownerId: data.ownerId,
        createdAt: new Date(`2026-08-08T00:00:0${counter}.000Z`),
      };
      teams.push(created);
      return Promise.resolve(created);
    },
  );

  const findMany = jest.fn(
    (
      args: {
        where?: { ownerId?: string };
        include?: { owner?: boolean; members?: boolean };
        orderBy?: { name?: 'asc' | 'desc' };
      } = {},
    ): Promise<(MockTeam & { owner?: MockUser | null; members?: MockUser[] })[]> => {
      let filtered =
        args.where?.ownerId !== undefined ? teams.filter((t) => t.ownerId === args.where!.ownerId) : [...teams];

      if (args.orderBy?.name) {
        const direction = args.orderBy.name;
        filtered = [...filtered].sort((a, b) =>
          direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
        );
      }

      if (args.include) {
        return Promise.resolve(
          filtered.map((t) => ({
            ...t,
            owner: seedUsers.find((u) => u.id === t.ownerId) ?? null,
            members: seedUsers.filter((u) => u.teamId === t.id),
          })),
        );
      }

      return Promise.resolve(filtered);
    },
  );

  return { teams, team: { findUnique, create, findMany } };
}

async function buildApp(
  userMock: ReturnType<typeof createUserPrismaMock>,
  teamMock: ReturnType<typeof createTeamPrismaMock>,
): Promise<INestApplication> {
  const prismaMock = { user: userMock.user, team: teamMock.team };

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, TeamsModule],
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

describe('POST /teams', () => {
  it('autenticado como LEADER con datos válidos responde 201 con el equipo creado (AC-01)', async () => {
    const leader = buildTestUser();
    const userMock = createUserPrismaMock([leader]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'Team Alpha', description: 'Equipo de prueba' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Team Alpha',
      description: 'Equipo de prueba',
      ownerId: leader.id,
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.nameNormalized).toBeUndefined();

    await app.close();
  });

  it('con name de 31 caracteres, description de 256, o alguno vacío responde 400 (AC-02)', async () => {
    const leader = buildTestUser();
    const userMock = createUserPrismaMock([leader]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const longName = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'a'.repeat(31), description: 'Equipo de prueba' });
    expect(longName.status).toBe(400);

    const longDescription = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'Team Alpha', description: 'a'.repeat(256) });
    expect(longDescription.status).toBe(400);

    const emptyName = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: '', description: 'Equipo de prueba' });
    expect(emptyName.status).toBe(400);

    expect(teamMock.team.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('autenticado como no-LEADER responde 403 (AC-03)', async () => {
    const pm = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const userMock = createUserPrismaMock([pm]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Team Alpha', description: 'Equipo de prueba' });

    expect(response.status).toBe(403);

    await app.close();
  });

  it('sin autenticar responde 401 (AC-03)', async () => {
    const userMock = createUserPrismaMock([]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const response = await request(app.getHttpServer())
      .post('/teams')
      .send({ name: 'Team Alpha', description: 'Equipo de prueba' });

    expect(response.status).toBe(401);

    await app.close();
  });

  it('con un nombre ya existente (normalizado) responde 409 (AC-04)', async () => {
    const leader = buildTestUser();
    const userMock = createUserPrismaMock([leader]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Ya existente',
        ownerId: leader.id,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'TEAM ALPHA', description: 'Otro equipo' });

    expect(response.status).toBe(409);
    expect(teamMock.team.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('un LEADER que ya es dueño de un equipo crea un segundo con el mismo ownerId (AC-05)', async () => {
    const leader = buildTestUser();
    const userMock = createUserPrismaMock([leader]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const first = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'Team Alpha', description: 'Primer equipo' });
    const second = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'Team Beta', description: 'Segundo equipo' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.ownerId).toBe(leader.id);
    expect(second.body.ownerId).toBe(leader.id);

    await app.close();
  });
});

describe('POST /teams/:teamId/members', () => {
  it('LEADER asigna un recurso libre a un equipo propio responde 200 y el recurso queda asignado (AC-06)', async () => {
    const leader = buildTestUser();
    const resource = buildTestUser({
      id: 'usr_resource',
      email: 'resource@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: null,
    });
    const userMock = createUserPrismaMock([leader, resource]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Equipo',
        ownerId: leader.id,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams/team_1/members')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ resourceId: resource.id });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: resource.id, email: resource.email, name: resource.name });
    expect(response.body.role).toBeUndefined();
    expect(userMock.users.find((u) => u.id === resource.id)?.teamId).toBe('team_1');

    await app.close();
  });

  it('LEADER intenta asignar un recurso que ya pertenece a otro equipo responde 409 (AC-07)', async () => {
    const leader = buildTestUser();
    const resource = buildTestUser({
      id: 'usr_resource',
      email: 'resource@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: 'team_other',
    });
    const userMock = createUserPrismaMock([leader, resource]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Equipo',
        ownerId: leader.id,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams/team_1/members')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ resourceId: resource.id });

    expect(response.status).toBe(409);

    await app.close();
  });

  it('LEADER intenta asignar un recurso a un equipo del que no es dueño responde 403 (AC-08)', async () => {
    const leader = buildTestUser();
    const otherLeader = buildTestUser({ id: 'usr_other_leader', email: 'other-leader@tabsum.test' });
    const resource = buildTestUser({
      id: 'usr_resource',
      email: 'resource@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: null,
    });
    const userMock = createUserPrismaMock([leader, otherLeader, resource]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Equipo',
        ownerId: otherLeader.id,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams/team_1/members')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ resourceId: resource.id });

    expect(response.status).toBe(403);

    await app.close();
  });

  it('LEADER intenta asignar a un teamId inexistente responde 404', async () => {
    const leader = buildTestUser();
    const resource = buildTestUser({
      id: 'usr_resource',
      email: 'resource@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: null,
    });
    const userMock = createUserPrismaMock([leader, resource]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .post('/teams/team_nonexistent/members')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ resourceId: resource.id });

    expect(response.status).toBe(404);

    await app.close();
  });

  it('LEADER intenta asignar un resourceId inexistente o de rol distinto de RESOURCE responde 404 en ambos casos', async () => {
    const leader = buildTestUser();
    const pm = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const userMock = createUserPrismaMock([leader, pm]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Equipo',
        ownerId: leader.id,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const nonexistentResource = await request(app.getHttpServer())
      .post('/teams/team_1/members')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ resourceId: 'usr_nonexistent' });
    expect(nonexistentResource.status).toBe(404);

    const wrongRoleResource = await request(app.getHttpServer())
      .post('/teams/team_1/members')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ resourceId: pm.id });
    expect(wrongRoleResource.status).toBe(404);

    await app.close();
  });

  it('dos requests concurrentes que asignan el mismo recurso a dos equipos distintos: exactamente una responde 200 y la otra 409 (mitigación de condición de carrera)', async () => {
    const leader = buildTestUser();
    const resource = buildTestUser({
      id: 'usr_resource',
      email: 'resource@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: null,
    });
    const userMock = createUserPrismaMock([leader, resource]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Equipo',
        ownerId: leader.id,
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'team_2',
        name: 'Team Beta',
        nameNormalized: 'team beta',
        description: 'Equipo',
        ownerId: leader.id,
        createdAt: new Date('2026-01-02'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/teams/team_1/members')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ resourceId: resource.id }),
      request(app.getHttpServer())
        .post('/teams/team_2/members')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ resourceId: resource.id }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalTeamId = userMock.users.find((u) => u.id === resource.id)?.teamId;
    expect(['team_1', 'team_2']).toContain(finalTeamId);
    expect(userMock.user.updateMany).toHaveBeenCalledTimes(2);

    await app.close();
  });
});

describe('GET /teams/available-resources', () => {
  it('devuelve solo usuarios RESOURCE con teamId nulo (AC-09)', async () => {
    const leader = buildTestUser();
    const freeResource = buildTestUser({
      id: 'usr_free',
      email: 'free@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: null,
    });
    const assignedResource = buildTestUser({
      id: 'usr_assigned',
      email: 'assigned@tabsum.test',
      role: UserRole.RESOURCE,
      teamId: 'team_1',
    });
    const pm = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const userMock = createUserPrismaMock([leader, freeResource, assignedResource, pm]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/available-resources')
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(freeResource.id);

    await app.close();
  });

  it('sin autenticar o con rol distinto de LEADER responde 401/403 (AC-10)', async () => {
    const pm = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const userMock = createUserPrismaMock([pm]);
    const teamMock = createTeamPrismaMock();
    const app = await buildApp(userMock, teamMock);

    const unauthenticated = await request(app.getHttpServer()).get('/teams/available-resources');
    expect(unauthenticated.status).toBe(401);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });
    const nonLeader = await request(app.getHttpServer())
      .get('/teams/available-resources')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(nonLeader.status).toBe(403);

    await app.close();
  });
});

describe('GET /teams/mine', () => {
  it('devuelve solo los equipos del LEADER autenticado, no los de otro LEADER', async () => {
    const leader = buildTestUser();
    const otherLeader = buildTestUser({ id: 'usr_other_leader', email: 'other-leader@tabsum.test' });
    const userMock = createUserPrismaMock([leader, otherLeader]);
    const teamMock = createTeamPrismaMock([
      {
        id: 'team_1',
        name: 'Team Alpha',
        nameNormalized: 'team alpha',
        description: 'Equipo propio',
        ownerId: leader.id,
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'team_2',
        name: 'Team Beta',
        nameNormalized: 'team beta',
        description: 'Equipo ajeno',
        ownerId: otherLeader.id,
        createdAt: new Date('2026-01-02'),
      },
    ]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: leader.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/mine')
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('team_1');

    await app.close();
  });
});

describe('createTeamPrismaMock findMany with include', () => {
  it('resuelve owner y members contra los usuarios sembrados cuando se llama con include', async () => {
    const owner = buildTestUser({ id: 'usr_owner', email: 'owner@tabsum.test', name: 'Ana Líder' });
    const member = buildTestUser({
      id: 'usr_member',
      email: 'member@tabsum.test',
      name: 'Beto Recurso',
      role: UserRole.RESOURCE,
      teamId: 'team_1',
    });
    const teamMock = createTeamPrismaMock(
      [
        {
          id: 'team_1',
          name: 'Equipo Alfa',
          nameNormalized: 'equipo alfa',
          description: 'Descripción',
          ownerId: owner.id,
          createdAt: new Date('2026-01-01'),
        },
      ],
      [owner, member],
    );

    const result = await teamMock.team.findMany({
      include: { owner: true, members: true },
      orderBy: { name: 'asc' },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.owner).toMatchObject({ id: owner.id, name: owner.name });
    expect(result[0]?.members).toHaveLength(1);
    expect(result[0]?.members?.[0]).toMatchObject({ id: member.id, name: member.name });
  });
});

describe('GET /teams/composition', () => {
  function buildCompositionScenario() {
    const owner = buildTestUser({ id: 'usr_owner', email: 'owner@tabsum.test', name: 'Ana Líder' });
    const member = buildTestUser({
      id: 'usr_member',
      email: 'member@tabsum.test',
      name: 'Beto Recurso',
      role: UserRole.RESOURCE,
      teamId: 'team_1',
    });
    const team: MockTeam = {
      id: 'team_1',
      name: 'Equipo Alfa',
      nameNormalized: 'equipo alfa',
      description: 'Equipo de prueba',
      ownerId: owner.id,
      createdAt: new Date('2026-01-01'),
    };
    return { owner, member, team };
  }

  it('PM autenticado recibe 200 con la composición completa de todos los equipos (AC-01)', async () => {
    const { owner, member, team } = buildCompositionScenario();
    const pm = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const userMock = createUserPrismaMock([owner, member, pm]);
    const teamMock = createTeamPrismaMock([team], [owner, member, pm]);
    const app = await buildApp(userMock, teamMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/composition')
      .set('Authorization', `Bearer ${pmToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: team.id,
        name: team.name,
        description: team.description,
        owner: { id: owner.id, name: owner.name },
        members: [{ id: member.id, name: member.name }],
      },
    ]);

    await app.close();
  });

  it('LEADER autenticado recibe 200 con la composición completa (AC-01)', async () => {
    const { owner, member, team } = buildCompositionScenario();
    const userMock = createUserPrismaMock([owner, member]);
    const teamMock = createTeamPrismaMock([team], [owner, member]);
    const app = await buildApp(userMock, teamMock);

    const leaderToken = await loginAs(app, { email: owner.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/composition')
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      name: team.name,
      description: team.description,
      owner: { id: owner.id, name: owner.name },
      members: [{ id: member.id, name: member.name }],
    });

    await app.close();
  });

  it('RESOURCE autenticado recibe 200 con la misma composición, sin campos de acción/mutación (AC-02)', async () => {
    const { owner, member, team } = buildCompositionScenario();
    const userMock = createUserPrismaMock([owner, member]);
    const teamMock = createTeamPrismaMock([team], [owner, member]);
    const app = await buildApp(userMock, teamMock);

    const resourceToken = await loginAs(app, { email: member.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/composition')
      .set('Authorization', `Bearer ${resourceToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: team.id,
        name: team.name,
        description: team.description,
        owner: { id: owner.id, name: owner.name },
        members: [{ id: member.id, name: member.name }],
      },
    ]);
    // El DTO no expone email/role/estado ni ningún campo de acción/mutación —
    // solo puede probarse leyendo la forma exacta del payload (AC-02).
    expect(Object.keys(response.body[0])).toEqual(['id', 'name', 'description', 'owner', 'members']);
    expect(Object.keys(response.body[0].owner)).toEqual(['id', 'name']);
    expect(Object.keys(response.body[0].members[0])).toEqual(['id', 'name']);

    await app.close();
  });

  it('sin autenticar responde 401 (AC-03)', async () => {
    const userMock = createUserPrismaMock([]);
    const teamMock = createTeamPrismaMock([], []);
    const app = await buildApp(userMock, teamMock);

    const response = await request(app.getHttpServer()).get('/teams/composition');

    expect(response.status).toBe(401);

    await app.close();
  });

  it('sin equipos creados responde 200 con [] (soporta AC-04)', async () => {
    const pm = buildTestUser({ id: 'usr_pm', email: 'pm@tabsum.test', role: UserRole.PM });
    const userMock = createUserPrismaMock([pm]);
    const teamMock = createTeamPrismaMock([], [pm]);
    const app = await buildApp(userMock, teamMock);

    const pmToken = await loginAs(app, { email: pm.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/composition')
      .set('Authorization', `Bearer ${pmToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    await app.close();
  });

  it('ADMIN autenticado (rol fuera de PM/LEADER/RESOURCE) recibe 403', async () => {
    const { owner, member, team } = buildCompositionScenario();
    const admin = buildTestUser({ id: 'usr_admin', email: 'admin@tabsum.test', role: UserRole.ADMIN });
    const userMock = createUserPrismaMock([owner, member, admin]);
    const teamMock = createTeamPrismaMock([team], [owner, member, admin]);
    const app = await buildApp(userMock, teamMock);

    const adminToken = await loginAs(app, { email: admin.email, password: VALID_PASSWORD });

    const response = await request(app.getHttpServer())
      .get('/teams/composition')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(403);

    await app.close();
  });
});
