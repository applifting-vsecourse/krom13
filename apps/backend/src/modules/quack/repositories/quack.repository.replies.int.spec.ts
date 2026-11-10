// Integration test against a real Postgres: "a reply survives its quack's
// delete" and "nothing of a deleted quack stays" are guarantees of the
// transaction, the foreign keys and the CHECK constraints (docs/adr/0005), so
// mocks can't prove them.
//
// Skipped unless DATABASE_URL is set:
//   DATABASE_URL=postgresql://… pnpm backend test quack.repository.replies.int
import { PrismaService } from '@/core/prisma/prisma.service';
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from './quack.repository';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('QuackRepository replies (database)', () => {
  const prefix = `inttest-rep-${Date.now()}`;
  const prisma = new PrismaService();
  const quacks = new QuackRepository(prisma);
  const [ann, bob] = [`${prefix}-ann`, `${prefix}-bob`];
  const created: string[] = [];

  const post = async (userId = ann, pollOptions?: string[]): Promise<Quack> => {
    const quack = await quacks.createQuack({
      text: 'a quack',
      userId,
      pollOptions,
    });
    created.push(quack.id);
    return quack;
  };

  const reply = async (parentId: string, userId = bob): Promise<Quack> => {
    const result = await quacks.createReply({
      text: 'a reply',
      mood: 'happy',
      userId,
      parentId,
    });
    if (result.outcome !== 'created') throw new Error(result.outcome);
    created.push(result.quack.id);
    return result.quack;
  };

  const row = (id: string): Promise<Record<string, unknown> | null> =>
    prisma.quack.findUnique({ where: { id } });

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.createMany({
      data: [ann, bob].map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
  });

  afterAll(async () => {
    // The reply links are RESTRICT, so unlink before deleting.
    await prisma.quack.updateMany({
      where: { id: { in: created } },
      data: { parentId: null, rootId: null },
    });
    await prisma.quack.deleteMany({ where: { id: { in: created } } });
    await prisma.user.deleteMany({ where: { id: { in: [ann, bob] } } });
    await prisma.$disconnect();
  });

  it('roots every reply at the top-level quack, also a reply to a reply', async () => {
    const top = await post();
    const first = await reply(top.id);
    const second = await reply(first.id, ann);

    expect(first).toMatchObject({ parentId: top.id, rootId: top.id });
    expect(second).toMatchObject({ parentId: first.id, rootId: top.id });
  });

  it('keeps replies out of the feed and counts them per quack', async () => {
    const top = await post();
    const first = await reply(top.id);
    await reply(first.id, ann);

    const feed = await quacks.getQuacks(ann);
    expect(feed.map((q) => q.id)).toContain(top.id);
    expect(feed.map((q) => q.id)).not.toContain(first.id);
    expect(feed.find((q) => q.id === top.id)?.replyCount).toBe(2);

    const mine = await quacks.getQuacks(bob, { authorId: bob });
    expect(mine.map((q) => q.id)).not.toContain(first.id);
  });

  it('lists a thread oldest first and not for a reply id', async () => {
    const top = await post();
    const first = await reply(top.id);
    const second = await reply(top.id, ann);

    const thread = await quacks.getThread(top.id, ann);
    expect(thread?.replies.map((r) => r.id)).toEqual([first.id, second.id]);
    expect(thread?.quack.replyCount).toBe(2);
    await expect(quacks.getThread(first.id, ann)).resolves.toBeNull();
  });

  it('hard-deletes a quack without replies, poll and votes with it', async () => {
    const top = await post(ann, ['Pizza', 'Sushi']);
    await prisma.pollVote.create({
      data: { quackId: top.id, userId: bob, optionId: top.poll!.options[0].id },
    });

    await expect(quacks.deleteOwnQuack(top.id, ann)).resolves.toBe(true);

    await expect(row(top.id)).resolves.toBeNull();
    await expect(
      prisma.pollVote.count({ where: { quackId: top.id } }),
    ).resolves.toBe(0);
  });

  it('does not let someone else empty or delete my quack', async () => {
    const top = await post();
    await reply(top.id);

    await expect(quacks.deleteOwnQuack(top.id, bob)).resolves.toBe(false);
    await expect(row(top.id)).resolves.toMatchObject({
      userId: ann,
      deletedAt: null,
    });
  });

  it('empties a quack with replies: nothing is left, the replies stay', async () => {
    const top = await post(ann, ['Pizza', 'Sushi']);
    await prisma.pollVote.create({
      data: { quackId: top.id, userId: bob, optionId: top.poll!.options[0].id },
    });
    await prisma.quack.update({ where: { id: top.id }, data: { mood: 'sad' } });
    const kept = await reply(top.id);

    await expect(quacks.deleteOwnQuack(top.id, ann)).resolves.toBe(true);

    await expect(row(top.id)).resolves.toMatchObject({
      text: '',
      mood: null,
      userId: null,
      deletedAt: expect.any(Date),
    });
    await expect(
      prisma.poll.count({ where: { quackId: top.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.pollOption.count({ where: { quackId: top.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.pollVote.count({ where: { quackId: top.id } }),
    ).resolves.toBe(0);
    await expect(row(kept.id)).resolves.toMatchObject({
      userId: bob,
      text: 'a reply',
    });

    // Gone from the feed, still a thread with its reply, not deletable again.
    const feed = await quacks.getQuacks(ann);
    expect(feed.map((q) => q.id)).not.toContain(top.id);
    const thread = await quacks.getThread(top.id, ann);
    expect(thread?.quack.deletedAt).not.toBeNull();
    expect(thread?.replies.map((r) => r.id)).toEqual([kept.id]);
    await expect(quacks.deleteOwnQuack(top.id, ann)).resolves.toBe(false);
    await expect(quacks.deleteQuack(top.id)).resolves.toBe(false);
  });

  it('refuses a reply to a quack that was emptied or does not exist', async () => {
    const top = await post();
    await reply(top.id);
    await quacks.deleteOwnQuack(top.id, ann);

    await expect(
      quacks.createReply({ text: 'x', userId: bob, parentId: top.id }),
    ).resolves.toEqual({ outcome: 'parent_deleted' });
    await expect(
      quacks.createReply({ text: 'x', userId: bob, parentId: 'nope' }),
    ).resolves.toEqual({ outcome: 'parent_not_found' });
  });

  it('removes an emptied quack when its last reply is deleted', async () => {
    const top = await post();
    const first = await reply(top.id);
    const second = await reply(top.id, ann);
    await quacks.deleteOwnQuack(top.id, ann);

    await quacks.deleteOwnQuack(first.id, bob);
    await expect(row(top.id)).resolves.not.toBeNull();

    await quacks.deleteOwnQuack(second.id, ann);
    await expect(row(top.id)).resolves.toBeNull();
  });

  it('walks up: an emptied reply and its emptied top-level quack both go', async () => {
    const top = await post();
    const middle = await reply(top.id);
    const leaf = await reply(middle.id, ann);
    await quacks.deleteOwnQuack(top.id, ann);
    await quacks.deleteOwnQuack(middle.id, bob);
    await expect(row(middle.id)).resolves.toMatchObject({
      deletedAt: expect.any(Date),
    });

    await quacks.deleteOwnQuack(leaf.id, ann);

    await expect(row(leaf.id)).resolves.toBeNull();
    await expect(row(middle.id)).resolves.toBeNull();
    await expect(row(top.id)).resolves.toBeNull();
  });

  it('stops walking at a live quack', async () => {
    const top = await post();
    const middle = await reply(top.id);
    const leaf = await reply(middle.id, ann);

    await quacks.deleteOwnQuack(leaf.id, ann);

    await expect(row(top.id)).resolves.toMatchObject({ deletedAt: null });
    await expect(row(middle.id)).resolves.toMatchObject({ deletedAt: null });
  });

  it('lets the database refuse what the service must never do', async () => {
    const top = await post();
    await reply(top.id);

    // a reply's parent can't be deleted underneath it
    await expect(
      prisma.quack.delete({ where: { id: top.id } }),
    ).rejects.toThrow();
    // an emptied row can't keep text or an author
    await expect(
      prisma.quack.update({
        where: { id: top.id },
        data: { deletedAt: new Date() },
      }),
    ).rejects.toThrow();
    // a reply needs both links
    await expect(
      prisma.quack.create({
        data: { text: 'x', userId: ann, parentId: top.id },
      }),
    ).rejects.toThrow();
  });
});
