// Integration test against a real Postgres: the guarantees in the story
// ("one person, one vote", "a vote never counts after the close") live in the
// database, so mocks can't prove them.
//
// Skipped unless DATABASE_URL is set:
//   DATABASE_URL=postgresql://… pnpm backend test poll.repository.int
import { PrismaService } from '@/core/prisma/prisma.service';
import { PollResults } from '@/modules/quack/domain/poll';
import { PollRepository } from './poll.repository';
import { QuackRepository } from './quack.repository';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('PollRepository (database)', () => {
  const prefix = `inttest-${Date.now()}`;
  const prisma = new PrismaService();
  const polls = new PollRepository(prisma);
  const quacks = new QuackRepository(prisma);
  const userIds = Array.from({ length: 12 }, (_, i) => `${prefix}-u${i}`);
  let quackId: string;
  let optionIds: string[];

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.createMany({
      data: userIds.map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
  });

  beforeEach(async () => {
    const created = await quacks.createQuack({
      text: 'Lunch?',
      userId: userIds[0],
      pollOptions: ['Pizza', 'Sushi', 'Soup'],
    });
    quackId = created.id;
    optionIds = created.poll!.options.map((option) => option.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  const results = async (): Promise<PollResults> =>
    (await quacks.getQuack(quackId, userIds[1]))!.poll!;

  it('counts one vote per person even when they vote many times at once', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        polls.vote({
          quackId,
          userId: userIds[1],
          optionId: optionIds[i % 3],
        }),
      ),
    );

    const poll = await results();
    expect(poll.totalVotes).toBe(1);
    expect(poll.myOptionId).not.toBeNull();
  });

  it('moves a vote instead of adding one', async () => {
    await polls.vote({ quackId, userId: userIds[1], optionId: optionIds[0] });
    await polls.vote({ quackId, userId: userIds[1], optionId: optionIds[1] });

    const poll = await results();
    expect(poll.options.map((o) => o.votes)).toEqual([0, 1, 0]);
    expect(poll.myOptionId).toBe(optionIds[1]);
  });

  it('adds up concurrent votes from different people exactly', async () => {
    await Promise.all(
      userIds.map((userId, i) =>
        polls.vote({ quackId, userId, optionId: optionIds[i % 2] }),
      ),
    );

    const poll = await results();
    expect(poll.totalVotes).toBe(12);
    expect(poll.options.map((o) => o.votes)).toEqual([6, 6, 0]);
  });

  it('rejects an answer from another poll', async () => {
    const other = await quacks.createQuack({
      text: 'Other?',
      userId: userIds[0],
      pollOptions: ['A', 'B'],
    });

    await expect(
      polls.vote({
        quackId,
        userId: userIds[1],
        optionId: other.poll!.options[0].id,
      }),
    ).resolves.toBe('bad_option');
    expect((await results()).totalVotes).toBe(0);
  });

  it('rejects votes on a closed poll and keeps the final counts', async () => {
    await polls.vote({ quackId, userId: userIds[1], optionId: optionIds[0] });
    await polls.close(quackId);

    await expect(
      polls.vote({ quackId, userId: userIds[2], optionId: optionIds[1] }),
    ).resolves.toBe('closed');
    await expect(
      polls.vote({ quackId, userId: userIds[1], optionId: optionIds[2] }),
    ).resolves.toBe('closed');

    const poll = await results();
    expect(poll.options.map((o) => o.votes)).toEqual([1, 0, 0]);
    expect(poll.closedAt).not.toBeNull();
  });

  it('never counts a vote that raced the close after the close', async () => {
    // Fire votes and the close together; whatever the interleaving, every
    // vote the database reported as "voted" is in the final count, and no
    // vote lands after it.
    const outcomes = await Promise.all([
      ...userIds.map((userId) =>
        polls.vote({ quackId, userId, optionId: optionIds[0] }),
      ),
      polls.close(quackId),
    ]);
    const accepted = outcomes.filter((o) => o === 'voted').length;

    const poll = await results();
    expect(poll.closedAt).not.toBeNull();
    expect(poll.totalVotes).toBe(accepted);

    // and nothing is accepted from now on
    await expect(
      polls.vote({ quackId, userId: userIds[11], optionId: optionIds[1] }),
    ).resolves.toBe('closed');
    expect((await results()).totalVotes).toBe(accepted);
  });

  it('keeps the first close time when closed twice', async () => {
    await polls.close(quackId);
    const first = (await results()).closedAt;
    await polls.close(quackId);
    expect((await results()).closedAt).toEqual(first);
  });
});
