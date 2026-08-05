import * as bcrypt from 'bcrypt';
import { UserRole } from '../../generated/prisma';
import { readAdminCredentials, seedAdmin, SeedPrismaClient } from '../../prisma/seed';

/**
 * Unit tests for `prisma/seed.ts`.
 *
 * `seed.ts` is a standalone script (run via `ts-node`, outside Nest's DI
 * container), not an HTTP endpoint — there is nothing here to hit with
 * supertest. Same rationale as `auth/auth.controller.spec.ts` (Block 2):
 * mock the Prisma client at the I/O boundary and exercise the real
 * `seedAdmin`/`readAdminCredentials` logic against it.
 */

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

function createSeedPrismaMock(seedUsers: MockUser[] = []): SeedPrismaClient & { users: MockUser[] } {
  const users = [...seedUsers];
  let counter = users.length;

  const findFirst = jest.fn(({ where }: { where: { role: UserRole } }) => {
    const found = users.find((u) => u.role === where.role);
    return Promise.resolve(found ?? null);
  });

  const create = jest.fn(
    ({ data }: { data: { email: string; passwordHash: string; role: UserRole } }) => {
      counter += 1;
      const created: MockUser = {
        id: `usr_seed_${counter}`,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
      };
      users.push(created);
      return Promise.resolve(created);
    },
  );

  return { users, user: { findFirst, create } };
}

describe('readAdminCredentials', () => {
  it('lee ADMIN_EMAIL/ADMIN_PASSWORD del env recibido', () => {
    const credentials = readAdminCredentials({
      ADMIN_EMAIL: 'admin@tabsum.test',
      ADMIN_PASSWORD: 'AdminPass123',
    });

    expect(credentials).toEqual({ email: 'admin@tabsum.test', password: 'AdminPass123' });
  });

  it('lanza un error explícito si falta ADMIN_PASSWORD', () => {
    expect(() => readAdminCredentials({ ADMIN_EMAIL: 'admin@tabsum.test' })).toThrow(/ADMIN_PASSWORD/);
  });

  it('lanza un error explícito si falta ADMIN_EMAIL', () => {
    expect(() => readAdminCredentials({ ADMIN_PASSWORD: 'AdminPass123' })).toThrow(/ADMIN_EMAIL/);
  });
});

describe('seedAdmin', () => {
  const env = { ADMIN_EMAIL: 'admin@tabsum.test', ADMIN_PASSWORD: 'AdminPass123' };

  it('sobre una base de datos vacía crea exactamente un Admin con las credenciales del env (AC-08)', async () => {
    const prismaMock = createSeedPrismaMock([]);

    await seedAdmin(prismaMock, env);

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.users).toHaveLength(1);
    const [created] = prismaMock.users;
    expect(created.email).toBe(env.ADMIN_EMAIL);
    expect(created.role).toBe(UserRole.ADMIN);
    expect(created.passwordHash).not.toBe(env.ADMIN_PASSWORD);
    await expect(bcrypt.compare(env.ADMIN_PASSWORD, created.passwordHash)).resolves.toBe(true);
  });

  it('ejecutado una segunda vez sobre la misma base no crea un segundo Admin (AC-09)', async () => {
    const prismaMock = createSeedPrismaMock([]);

    await seedAdmin(prismaMock, env);
    await seedAdmin(prismaMock, env);

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.users).toHaveLength(1);
  });

  it('sin ADMIN_PASSWORD definida termina en error y no crea ningún usuario', async () => {
    const prismaMock = createSeedPrismaMock([]);

    await expect(
      seedAdmin(prismaMock, { ADMIN_EMAIL: 'admin@tabsum.test' }),
    ).rejects.toThrow(/ADMIN_PASSWORD/);

    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.users).toHaveLength(0);
  });
});
