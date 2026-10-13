import { PrismaService } from '@/core/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

export type VoteOutcome = 'voted' | 'poll_not_found' | 'bad_option' | 'closed';
export type CloseOutcome = 'closed' | 'poll_not_found';

@Injectable()
export class PollRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the user's vote, or moves it if they already voted.
   *
   * The poll row is locked with FOR SHARE while we check `closedAt` and write,
   * and closing needs an exclusive lock on the same row. So a vote either
   * lands before the close, or sees it and is rejected — it is never counted
   * after the poll closed. The (quackId, userId) primary key plus
   * ON CONFLICT means two requests from one person can't make two votes.
   */
  async vote(params: {
    quackId: string;
    userId: string;
    optionId: string;
  }): Promise<VoteOutcome> {
    const { quackId, userId, optionId } = params;
    return this.prisma.$transaction(async (tx) => {
      const polls = await tx.$queryRaw<{ closedAt: Date | null }[]>`
        SELECT "closedAt" FROM "poll" WHERE "quackId" = ${quackId} FOR SHARE`;
      if (polls.length === 0) return 'poll_not_found';
      if (polls[0].closedAt) return 'closed';

      const option = await tx.pollOption.findUnique({
        where: { quackId_id: { quackId, id: optionId } },
      });
      if (!option) return 'bad_option';

      await tx.$executeRaw`
        INSERT INTO "poll_vote" ("quackId", "userId", "optionId", "createdAt", "updatedAt")
        VALUES (${quackId}, ${userId}, ${optionId}, now(), now())
        ON CONFLICT ("quackId", "userId")
        DO UPDATE SET "optionId" = EXCLUDED."optionId", "updatedAt" = now()`;
      return 'voted';
    });
  }

  /** Closing twice is fine: the first close time is kept. */
  async close(quackId: string): Promise<CloseOutcome> {
    const poll = await this.prisma.poll.findUnique({ where: { quackId } });
    if (!poll) return 'poll_not_found';
    await this.prisma.poll.updateMany({
      where: { quackId, closedAt: null },
      data: { closedAt: new Date() },
    });
    return 'closed';
  }
}
