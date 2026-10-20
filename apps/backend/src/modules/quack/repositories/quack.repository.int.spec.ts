// Integration test against a real Postgres: "only the author can delete" and
// "the poll goes with its quack" are guarantees of the database statement and
// the cascading foreign keys, so mocks can't prove them.
//
// Skipped unless DATABASE_URL is set:
//   DATABASE_URL=postgresql://… pnpm backend test quack.repository.int
import { PrismaService } from '@/core/prisma/prisma.service';
import { QuackRepository } from './quack.repository';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('QuackRepository delete and author filter (database)', () => {
  const prefix = `inttest-del-${Date.now()}`;
  const prisma = new PrismaService();
  const quacks = new QuackRepository(prisma);
  const [author, other] = [`${prefix}-author`, `${prefix}-other`];

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.createMany({
      data: [author, other].map((id) => ({
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
    await prisma.user.deleteMany({ where: { id: { in: [author, other] } } });
    await prisma.$disconnect();
  });

  it("does not delete someone else's quack", async () => {
    const quack = await quacks.createQuack({ text: 'mine', userId: author });

    await expect(quacks.deleteOwnQuack(quack.id, other)).resolves.toBe(false);
    await expect(quacks.getQuack(quack.id, author)).resolves.not.toBeNull();
  });

  it('deletes my quack together with its poll and votes', async () => {
    const quack = await quacks.createQuack({
      text: 'Lunch?',
      userId: author,
      pollOptions: ['Pizza', 'Sushi'],
    });
    await prisma.pollVote.create({
      data: {
        quackId: quack.id,
        userId: other,
        optionId: quack.poll!.options[0].id,
      },
    });

    await expect(quacks.deleteOwnQuack(quack.id, author)).resolves.toBe(true);

    await expect(quacks.getQuack(quack.id, author)).resolves.toBeNull();
    await expect(
      prisma.pollVote.count({ where: { quackId: quack.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.pollOption.count({ where: { quackId: quack.id } }),
    ).resolves.toBe(0);
  });

  it('deleting a missing quack changes nothing', async () => {
    await expect(quacks.deleteOwnQuack(`${prefix}-nope`, author)).resolves.toBe(
      false,
    );
  });

  it('lists only the given author’s quacks', async () => {
    const mine = await quacks.createQuack({ text: 'a', userId: author });
    const theirs = await quacks.createQuack({ text: 'b', userId: other });

    const ids = (await quacks.getQuacks(author, { authorId: author })).map(
      (quack) => quack.id,
    );

    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });
});
