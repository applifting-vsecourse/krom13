// Jest does not apply moduleNameMapper to globalSetup, so resolve `@/` here.
import 'tsconfig-paths/register';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { testDatabaseUrl } from './env';

/** Throws unless the URL points at a database named `*_test`. */
export function assertTestDatabase(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/_test$/.test(name)) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in "_test".`,
    );
  }
  return name;
}

// Once per run: create quacker_test if missing, then apply the Prisma migrations.
export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  const name = assertTestDatabase(url);

  // Connect to the maintenance database to create the test one.
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
  });
  try {
    const rows = await admin.$queryRawUnsafe<unknown[]>(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      name,
    );
    if (rows.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: __dirname + '/../..',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
