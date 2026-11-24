// Integration tests for likes (cases.md, section 2 "API behaviour"): real HTTP
// requests to the Nest app and the real quacker_test database. The like rows
// are read with raw SQL so these tests describe the table of
// docs/adr/0007-likes.md ("quack_like") without depending on generated code.
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import { createTestApp, TestApp } from '@/test-int/test-app';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { QuacksController } from './quacks.controller';

type Agent = Awaited<ReturnType<TestApp['signIn']>>;

describe('likes (integration)', () => {
  let t: TestApp;
  let ann: Agent;
  let bob: Agent;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await t.cleanDatabase();
    ann = await t.signIn({
      email: 'ann@example.com',
      username: 'ann',
      name: 'Ann',
    });
    bob = await t.signIn({
      email: 'bob@example.com',
      username: 'bob',
      name: 'Bob',
    });
  });

  afterAll(async () => {
    await t.close();
  });

  type Liked = { liked: boolean; likeCount: number };
  type Item = {
    id: string;
    userId?: string;
    likeCount: number;
    likedByMe: boolean;
  };

  const post = async (agent: Agent, text = 'a quack'): Promise<Item> =>
    (await agent.post('/api/quacks').send({ text }).expect(201)).body as Item;

  const reply = async (
    agent: Agent,
    parentId: string,
    text = 'a reply',
  ): Promise<Item> =>
    (
      await agent
        .post(`/api/quacks/${parentId}/replies`)
        .send({ text })
        .expect(201)
    ).body as Item;

  const toggle = (agent: Agent, id: string) =>
    agent.post(`/api/quacks/${id}/like`);

  const like = async (agent: Agent, id: string): Promise<Liked> =>
    (await toggle(agent, id).expect(200)).body as Liked;

  const feed = async (agent: Agent, query = ''): Promise<Item[]> =>
    (await agent.get(`/api/quacks${query}`).expect(200)).body as Item[];

  const feedItem = async (agent: Agent, id: string): Promise<Item> =>
    (await feed(agent)).find((quack) => quack.id === id)!;

  const thread = async (
    agent: Agent,
    id: string,
  ): Promise<{ quack: Item & { deleted: boolean }; replies: Item[] }> =>
    (await agent.get(`/api/quacks/${id}`).expect(200)).body as {
      quack: Item & { deleted: boolean };
      replies: Item[];
    };

  const likeRows = async (...quackIds: string[]): Promise<number> => {
    const rows = await t.prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM "quack_like"
      WHERE "quackId" = ANY(${quackIds}::text[])`;
    return rows[0].count;
  };

  const userId = async (email: string): Promise<string> =>
    (await t.prisma.user.findUniqueOrThrow({ where: { email } })).id;

  // R9 — a rule, kept here because the unit run cannot load the auth guard.
  it('R9: the like route is POST :id/like, behind the sign-in guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, QuacksController)).toContain(
      AuthenticatedUserGuard,
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, QuacksController.prototype.like),
    ).toBe(':id/like');
    expect(
      Reflect.getMetadata(METHOD_METADATA, QuacksController.prototype.like),
    ).toBe(RequestMethod.POST);
  });

  // A1 — the product owner's first example: 0 → 1.
  it('A1: liking a quack with 0 likes makes it 1', async () => {
    const quack = await post(bob);

    const response = await toggle(ann, quack.id).expect(200);

    expect(response.body).toEqual({ liked: true, likeCount: 1 });
  });

  // A2 — the product owner's second example: 1 → 0.
  it('A2: liking again takes the like back, 1 → 0', async () => {
    const quack = await post(bob);
    await like(ann, quack.id);

    const response = await toggle(ann, quack.id).expect(200);

    expect(response.body).toEqual({ liked: false, likeCount: 0 });
  });

  // A3
  it("A3: taking my like back leaves other people's likes alone", async () => {
    const quack = await post(ann);
    await like(ann, quack.id);
    await like(bob, quack.id);

    const response = await toggle(ann, quack.id).expect(200);

    expect(response.body).toEqual({ liked: false, likeCount: 1 });
    expect((await feedItem(bob, quack.id)).likedByMe).toBe(true);
  });

  // A4
  it('A4: the feed tells me the count and that I liked it', async () => {
    const quack = await post(bob);
    await like(ann, quack.id);

    expect(await feedItem(ann, quack.id)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  // A5
  it("A5: the feed shows someone else's like as a count, not as mine", async () => {
    const quack = await post(bob);
    await like(ann, quack.id);

    expect(await feedItem(bob, quack.id)).toMatchObject({
      likeCount: 1,
      likedByMe: false,
    });
  });

  // A7
  it('A7: a signed-out visitor cannot like, and nothing is stored', async () => {
    const quack = await post(bob);

    await t.anonymous().post(`/api/quacks/${quack.id}/like`).expect(401);

    expect(await likeRows(quack.id)).toBe(0);
  });

  // A8
  it('A8: liking an unknown quack is "Quack not found"', async () => {
    const response = await toggle(ann, 'no-such-quack').expect(404);

    // A missing route is a 404 too; the message proves the quack was looked up.
    expect(response.body).toMatchObject({ message: 'Quack not found' });
  });

  // A9
  it('A9: liking an emptied quack is "Quack not found" and stores nothing', async () => {
    const quack = await post(ann);
    await reply(bob, quack.id);
    await ann.delete(`/api/quacks/${quack.id}`).expect(204);

    const response = await toggle(bob, quack.id).expect(404);

    expect(response.body).toMatchObject({ message: 'Quack not found' });
    expect(await likeRows(quack.id)).toBe(0);
  });

  // A10 + R7 (erasing the likes belongs to the same transaction as emptying)
  it("A10/R7: emptying a quack erases its likes but not its replies' likes", async () => {
    const quack = await post(ann);
    const answer = await reply(bob, quack.id);
    await like(ann, quack.id);
    await like(bob, quack.id);
    await like(ann, answer.id);

    await ann.delete(`/api/quacks/${quack.id}`).expect(204);

    expect((await thread(ann, quack.id)).quack.deleted).toBe(true);
    expect(await likeRows(quack.id)).toBe(0);
    expect(await likeRows(answer.id)).toBe(1);
  });

  // A11
  it('A11: deleting a quack without replies removes it and its likes', async () => {
    const quack = await post(ann);
    await like(ann, quack.id);
    await like(bob, quack.id);

    await ann.delete(`/api/quacks/${quack.id}`).expect(204);

    expect(await likeRows(quack.id)).toBe(0);
    expect(
      await t.prisma.quack.findUnique({ where: { id: quack.id } }),
    ).toBeNull();
  });

  // A12
  it('A12: a moderator deleting a liked quack erases its likes too', async () => {
    await t.signIn({
      email: 'mod@example.com',
      username: 'mod',
      name: 'Mod',
    });
    await t.prisma.user.update({
      where: { email: 'mod@example.com' },
      data: { role: 'admin' },
    });
    const moderator = t.anonymous();
    await moderator
      .post('/api/auth/sign-in/email')
      .set('Origin', 'http://localhost:3050')
      .send({ email: 'mod@example.com', password: 'password1234' })
      .expect(200);
    const plain = await post(ann, 'no replies');
    const withReply = await post(ann, 'has a reply');
    await reply(bob, withReply.id);
    await like(bob, plain.id);
    await like(bob, withReply.id);

    await moderator.delete(`/api/quacks/${plain.id}`).expect(204);
    await moderator.delete(`/api/quacks/${withReply.id}`).expect(204);

    expect(await likeRows(plain.id, withReply.id)).toBe(0);
  });

  // A13
  it('A13: the author can like their own quack', async () => {
    const quack = await post(ann);

    const response = await toggle(ann, quack.id).expect(200);

    expect(response.body).toEqual({ liked: true, likeCount: 1 });
  });

  // A14
  it("A14: a reply has its own likes; the quack's count does not move", async () => {
    const quack = await post(ann);
    const answer = await reply(bob, quack.id);

    const response = await toggle(ann, answer.id).expect(200);

    expect(response.body).toEqual({ liked: true, likeCount: 1 });
    expect((await feedItem(ann, quack.id)).likeCount).toBe(0);
    const { replies } = await thread(ann, quack.id);
    expect(replies[0]).toMatchObject({
      id: answer.id,
      likeCount: 1,
      likedByMe: true,
    });
  });

  // A15
  it('A15: two toggles at the same instant never make two likes or a 500', async () => {
    const quack = await post(bob);

    const responses = await Promise.all([
      toggle(ann, quack.id),
      toggle(ann, quack.id),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const rows = await likeRows(quack.id);
    expect(rows).toBeLessThanOrEqual(1);
    expect((await feedItem(ann, quack.id)).likeCount).toBe(rows);
  });

  // A16
  it('A16: the count is the number of like rows, with no counter column', async () => {
    const quack = await post(ann);
    await like(ann, quack.id);
    await like(bob, quack.id);

    expect(await likeRows(quack.id)).toBe(2);
    expect((await feedItem(ann, quack.id)).likeCount).toBe(2);
    const columns = await t.prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quack' AND column_name ILIKE '%like%'`;
    expect(columns).toEqual([]);
  });

  // A17 — the database, not only the service, refuses a second like.
  it('A17: the database refuses a second like row for the same person and quack', async () => {
    const quack = await post(bob);
    const annId = await userId('ann@example.com');
    const insert = () =>
      t.prisma.$executeRaw`
        INSERT INTO "quack_like" ("quackId", "userId")
        VALUES (${quack.id}, ${annId})`;

    await expect(insert()).resolves.toBe(1);
    await expect(insert()).rejects.toThrow(/23505|duplicate key|unique/i);
  });

  // A18
  it('A18: no like row outlives its quack when the last reply goes', async () => {
    const quack = await post(ann);
    const answer = await reply(bob, quack.id);
    await like(ann, quack.id);
    await like(bob, answer.id);
    await like(ann, answer.id);
    await ann.delete(`/api/quacks/${quack.id}`).expect(204);
    expect(await likeRows(quack.id)).toBe(0);

    await bob.delete(`/api/quacks/${answer.id}`).expect(204);

    expect(
      await t.prisma.quack.findUnique({ where: { id: quack.id } }),
    ).toBeNull();
    expect(await likeRows(quack.id, answer.id)).toBe(0);
  });

  // A19
  it('A19: Mine is not changed by likes, and every row carries the like fields', async () => {
    const mine = await post(ann, 'mine');
    const theirs = await post(bob, 'theirs');
    await like(ann, theirs.id);

    const rows = await feed(ann, '?author=me');

    expect(rows.map((quack) => quack.id)).toEqual([mine.id]);
    expect(rows[0]).toMatchObject({ likeCount: 0, likedByMe: false });
    const all = await feed(ann);
    expect(all.find((quack) => quack.id === theirs.id)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });
});
