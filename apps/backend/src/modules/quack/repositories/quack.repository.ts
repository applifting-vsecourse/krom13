import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { buildPollResults } from '@/modules/quack/domain/poll';
import { Mood, Quack } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

type PrismaQuackWithPoll = PrismaQuack & {
  user?: PrismaUser;
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
   */
  async getQuacks(
    viewerId: string,
    filter?: { words?: string[]; authorId?: string },
  ): Promise<Quack[]> {
    const words = filter?.words;
    const quacks = await this.prisma.quack.findMany({
      where: {
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
    return this.attachPolls(quacks, viewerId);
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

  /**
   * Deletes the quack only when `userId` wrote it, in one statement, so the
   * author check and the delete can't be separated by a race. The poll, its
   * answers and its votes go with it (cascading foreign keys).
   */
  async deleteOwnQuack(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.quack.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }

  /** Moderators only: deletes the quack whoever wrote it. */
  async deleteQuack(id: string): Promise<boolean> {
    const { count } = await this.prisma.quack.deleteMany({ where: { id } });
    return count > 0;
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
    return mapped;
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
