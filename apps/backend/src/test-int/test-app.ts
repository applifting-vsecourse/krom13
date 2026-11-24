import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { PrismaService } from '@/core/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

export const FRONTEND_ORIGIN = 'http://localhost:3050';

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  /** A visitor who is not signed in (no cookies). */
  anonymous: () => ReturnType<typeof request.agent>;
  /** Signs a new user up and in; the returned agent keeps the session cookie. */
  signIn: (
    user?: Partial<TestUser>,
  ) => Promise<ReturnType<typeof request.agent>>;
  /** Empties every table, so each test starts from a clean database. */
  cleanDatabase: () => Promise<void>;
  close: () => Promise<void>;
};

type TestUser = {
  email: string;
  password: string;
  name: string;
  username: string;
};

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const http = app.getHttpServer();

  return {
    app,
    prisma,
    anonymous: () => request.agent(http),
    async signIn(overrides = {}): Promise<ReturnType<typeof request.agent>> {
      const user: TestUser = {
        email: 'tester@example.com',
        password: 'password1234',
        name: 'Tester',
        username: 'tester',
        ...overrides,
      };
      const agent = request.agent(http);
      // BetterAuth rejects cross-site POSTs, so act like the frontend does.
      await agent
        .post('/api/auth/sign-up/email')
        .set('Origin', FRONTEND_ORIGIN)
        .send({ email: user.email, password: user.password, name: user.name })
        .expect(200);
      await prisma.user.update({
        where: { email: user.email },
        data: { username: user.username },
      });
      await agent
        .post('/api/auth/sign-in/email')
        .set('Origin', FRONTEND_ORIGIN)
        .send({ email: user.email, password: user.password })
        .expect(200);
      return agent;
    },
    async cleanDatabase(): Promise<void> {
      const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      if (tables.length === 0) return;
      const list = tables.map((t) => `"${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
    },
    close: () => app.close(),
  };
}
