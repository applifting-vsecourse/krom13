import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { buildPollResults } from '@/modules/quack/domain/poll';
import { Mood, Quack, Thread } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

type PrismaQuackWithPoll = PrismaQuack & {
  user?: PrismaUser | null;
  poll?: (PrismaPoll & { options: PrismaPollOption[] }) | null;
};

const POLL_INCLUDE = { options: true } as const;

const mapPrismaQuackToDomain = (
  quack: PrismaQuackWithPoll,
  poll: Quack['poll'] = null,
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  parentId: quack.parentId,
  rootId: quack.rootId,
  deletedAt: quack.deletedAt,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
  poll,
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * With `words`, a quack matches when ONE of its text, author name or author
   * username contains every word (case-insensitive). Prisma's `contains`
   * escapes %, _ and \, so the words are matched literally.
   * With `authorId`, only that person's quacks are returned.
   * Only live, top-level quacks: replies live on the thread page, and emptied
   * quacks (deletedAt set) are not feed items.
   */
  async getQuacks(
    viewerId: string,
    filter?: { words?: string[]; authorId?: string },
  ): Promise<Quack[]> {
    const words = filter?.words;
    const quacks = await this.prisma.quack.findMany({
      where: {
        parentId: null,
        deletedAt: null,
        userId: filter?.authorId,
        OR: words && [
          {
            AND: words.map((word) => ({
              text: { contains: word, mode: 'insensitive' },
            })),
          },
          {
            AND: words.map((word) => ({
              user: { name: { contains: word, mode: 'insensitive' } },
            })),
          },
          {
            AND: words.map((word) => ({
              user: { username: { contains: word, mode: 'insensitive' } },
            })),
          },
        ],
      },
      include: { user: true, poll: { include: POLL_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    return this.attachReplyCounts(await this.attachPolls(quacks, viewerId));
  }

  /**
   * A top-level quack with all replies of its thread, oldest first. Returns
   * null for an unknown id and for a reply's id (only top-level quacks have
   * a thread page). The quack may be emptied; its replies are still there.
   */
  async getThread(id: string, viewerId: string): Promise<Thread | null> {
    const quack = await this.getQuack(id, viewerId);
    if (!quack || quack.parentId) return null;
    const rows = await this.prisma.quack.findMany({
      where: { rootId: id },
      include: { user: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const replies = rows.map((row) => mapPrismaQuackToDomain(row));
    return {
      quack: {
        ...quack,
        replyCount: replies.filter((reply) => !reply.deletedAt).length,
      },
      replies,
    };
  }

  async getQuack(id: string, viewerId: string): Promise<Quack | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id },
      include: { user: true, poll: { include: POLL_INCLUDE } },
    });
    if (!quack) return null;
    const [mapped] = await this.attachPolls([quack], viewerId);
    return mapped;
  }

  /** Deletes (or empties, see `removeOrEmpty`) the quack only when `userId` wrote it. */
  async deleteOwnQuack(id: string, userId: string): Promise<boolean> {
    return this.removeOrEmpty(id, userId);
  }

  /** Moderators only: the same, whoever wrote the quack. */
  async deleteQuack(id: string): Promise<boolean> {
    return this.removeOrEmpty(id);
  }

  /**
   * Deleting a quack never deletes somebody else's reply (docs/adr/0005).
   *
   * - No replies: the row is deleted; its poll, answers and votes cascade.
   * - Replies: the row is emptied in place (text, mood, poll and author gone,
   *   `deletedAt` set) so the replies stay threaded under it.
   * - Afterwards, emptied ancestors that no longer have a reply are deleted.
   *
   * The owner is part of the statement that locks the row, so the author check
   * and the write can't be separated by a race. The lock also keeps a new
   * reply (which takes FOR SHARE on its parent) from sneaking in between
   * counting the replies and deleting. Returns false when there is nothing to
   * delete: unknown, already emptied, or not the owner's.
   */
  private async removeOrEmpty(id: string, ownerId?: string): Promise<boolean> {
    const owner = ownerId ?? null;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ parentId: string | null }[]>`
        SELECT "parentId" FROM "quack"
        WHERE "id" = ${id} AND "deletedAt" IS NULL
          AND (${owner}::text IS NULL OR "userId" = ${owner})
        FOR UPDATE`;
      if (rows.length === 0) return false;

      if ((await tx.quack.count({ where: { parentId: id } })) > 0) {
        await tx.poll.deleteMany({ where: { quackId: id } });
        await tx.quack.update({
          where: { id },
          data: { text: '', mood: null, userId: null, deletedAt: new Date() },
        });
        return true;
      }

      await tx.quack.delete({ where: { id } });
      let parentId = rows[0].parentId;
      while (parentId) {
        const parents = await tx.$queryRaw<{ parentId: string | null }[]>`
          SELECT "parentId" FROM "quack"
          WHERE "id" = ${parentId} AND "deletedAt" IS NOT NULL
          FOR UPDATE`;
        if (parents.length === 0) break;
        if ((await tx.quack.count({ where: { parentId } })) > 0) break;
        await tx.quack.delete({ where: { id: parentId } });
        parentId = parents[0].parentId;
      }
      return true;
    });
  }

  /**
   * Adds a reply. The parent row is locked FOR SHARE while we read it, so it
   * can't be emptied or deleted between the check and the insert. `rootId` is
   * set here, once, and never changes.
   */
  async createReply(data: {
    text: string;
    mood?: Mood;
    userId: string;
    parentId: string;
  }): Promise<
    | { outcome: 'created'; quack: Quack }
    | { outcome: 'parent_not_found' | 'parent_deleted' }
  > {
    return this.prisma.$transaction(async (tx) => {
      const parents = await tx.$queryRaw<
        { id: string; rootId: string | null; deletedAt: Date | null }[]
      >`SELECT "id", "rootId", "deletedAt" FROM "quack"
        WHERE "id" = ${data.parentId} FOR SHARE`;
      if (parents.length === 0) return { outcome: 'parent_not_found' };
      const [parent] = parents;
      if (parent.deletedAt) return { outcome: 'parent_deleted' };

      const reply = await tx.quack.create({
        data: {
          text: data.text,
          mood: data.mood,
          userId: data.userId,
          parentId: parent.id,
          rootId: parent.rootId ?? parent.id,
        },
        include: { user: true },
      });
      return { outcome: 'created', quack: mapPrismaQuackToDomain(reply) };
    });
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: Mood;
    userId: string;
    pollOptions?: string[];
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
        poll: createQuackData.pollOptions && {
          create: {
            options: {
              create: createQuackData.pollOptions.map((text, position) => ({
                text,
                position,
              })),
            },
          },
        },
      },
      include: { user: true, poll: { include: POLL_INCLUDE } },
    });
    const [mapped] = await this.attachPolls([quack], createQuackData.userId);
    return { ...mapped, replyCount: 0 };
  }

  /** One grouped count for the whole page — no query per quack. */
  private async attachReplyCounts(quacks: Quack[]): Promise<Quack[]> {
    if (quacks.length === 0) return quacks;
    const counts = await this.prisma.quack.groupBy({
      by: ['rootId'],
      where: { rootId: { in: quacks.map((q) => q.id) }, deletedAt: null },
      _count: { _all: true },
    });
    const byRoot = new Map(counts.map((c) => [c.rootId, c._count._all]));
    return quacks.map((quack) => ({
      ...quack,
      replyCount: byRoot.get(quack.id) ?? 0,
    }));
  }

  /**
   * Counts every poll on the page with one grouped query and finds the
   * viewer's own votes with another — no query per poll.
   */
  private async attachPolls(
    quacks: PrismaQuackWithPoll[],
    viewerId: string,
  ): Promise<Quack[]> {
    const pollIds = quacks.filter((quack) => quack.poll).map((q) => q.id);
    if (pollIds.length === 0) {
      return quacks.map((quack) => mapPrismaQuackToDomain(quack));
    }

    const [counts, mine] = await Promise.all([
      this.prisma.pollVote.groupBy({
        by: ['quackId', 'optionId'],
        where: { quackId: { in: pollIds } },
        _count: { _all: true },
      }),
      this.prisma.pollVote.findMany({
        where: { quackId: { in: pollIds }, userId: viewerId },
      }),
    ]);
    const myOptionByPoll = new Map(mine.map((v) => [v.quackId, v.optionId]));

    return quacks.map((quack) => {
      if (!quack.poll) return mapPrismaQuackToDomain(quack);
      const pollCounts = new Map(
        counts
          .filter((count) => count.quackId === quack.id)
          .map((count) => [count.optionId, count._count._all]),
      );
      return mapPrismaQuackToDomain(
        quack,
        buildPollResults({
          options: quack.poll.options,
          counts: pollCounts,
          myOptionId: myOptionByPoll.get(quack.id) ?? null,
          closedAt: quack.poll.closedAt,
        }),
      );
    });
  }
}
