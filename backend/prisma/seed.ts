import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '../generated/prisma';

// Same cost factor as AuthService/UsersService (Blocks 2-3, NFR-01) — kept
// consistent across every place a password gets hashed.
const BCRYPT_SALT_ROUNDS = 12;

export interface AdminCredentials {
  email: string;
  password: string;
}

/**
 * Minimal shape of a Prisma client this script needs — lets tests pass a
 * mock instead of a live `PrismaClient` (same rationale as
 * `auth/auth.controller.spec.ts`, Block 2: no live Postgres guaranteed in
 * every environment this runs).
 */
export interface SeedPrismaClient {
  user: {
    findFirst: (args: { where: { role: UserRole } }) => Promise<{ id: string } | null>;
    create: (args: {
      data: { email: string; name: string; passwordHash: string; role: UserRole };
    }) => Promise<unknown>;
  };
}

/**
 * Reads the initial Admin's credentials from the environment. Never falls
 * back to a hardcoded default — an incomplete env is a hard failure with an
 * explicit message naming what is missing (spec-FEAT-001.md, Block 4,
 * "Error handling").
 */
export function readAdminCredentials(env: NodeJS.ProcessEnv = process.env): AdminCredentials {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  const missing: string[] = [];
  if (!email) {
    missing.push('ADMIN_EMAIL');
  }
  if (!password) {
    missing.push('ADMIN_PASSWORD');
  }
  if (missing.length > 0) {
    throw new Error(
      `No se puede ejecutar el seed del Admin inicial: falta la variable de entorno ${missing.join(', ')}.`,
    );
  }

  return { email: email as string, password: password as string };
}

/**
 * Idempotent (AC-09): if any Admin already exists, does nothing. Otherwise
 * creates one with the credentials read from `env` (AC-08).
 */
export async function seedAdmin(
  prisma: SeedPrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { email, password } = readAdminCredentials(env);

  const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  await prisma.user.create({ data: { email, name: 'Admin', passwordHash, role: UserRole.ADMIN } });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/* istanbul ignore next -- exercised via `npx prisma db seed`, not unit tests */
if (require.main === module) {
  main()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Seed del Admin inicial completado.');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(message);
      process.exitCode = 1;
    });
}
