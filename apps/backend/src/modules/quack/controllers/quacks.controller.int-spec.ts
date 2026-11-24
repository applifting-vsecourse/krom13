// Integration test: real HTTP requests to the Nest app, real Postgres
// (quacker_test), with and without a session.
import { createTestApp, TestApp } from '@/test-int/test-app';

describe('GET /api/quacks (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await t.cleanDatabase();
  });

  afterAll(async () => {
    await t.close();
  });

  it('returns 401 to a signed-out visitor', async () => {
    await t.anonymous().get('/api/quacks').expect(401);
  });

  it('returns 200 to a signed-in user', async () => {
    const user = await t.signIn();

    const response = await user.get('/api/quacks').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
