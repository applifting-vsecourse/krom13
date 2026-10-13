import { PrismaService } from '@/core/prisma/prisma.service';

type CreatePollParams = {
  text: string;
  userId: string;
  createdAt: Date;
  options: string[];
  // [userId, index of the chosen option]
  voters: [string, number][];
  isClosed?: boolean;
};

export async function createPoll(
  prisma: PrismaService,
  params: CreatePollParams,
): Promise<void> {
  const quack = await prisma.quack.create({
    data: {
      text: params.text,
      createdAt: params.createdAt,
      user: { connect: { id: params.userId } },
      poll: {
        create: {
          closedAt: params.isClosed ? new Date() : null,
          options: {
            create: params.options.map((text, position) => ({
              text,
              position,
            })),
          },
        },
      },
    },
    include: { poll: { include: { options: true } } },
  });

  const options = [...(quack.poll?.options ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  await prisma.pollVote.createMany({
    data: params.voters.map(([userId, index]) => ({
      quackId: quack.id,
      userId,
      optionId: options[index].id,
    })),
  });
}
