import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Mood, Quack } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
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
   */
  async getQuacks(search?: { words: string[] }): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: search && {
        OR: [
          {
            AND: search.words.map((word) => ({
              text: { contains: word, mode: 'insensitive' },
            })),
          },
          {
            AND: search.words.map((word) => ({
              user: { name: { contains: word, mode: 'insensitive' } },
            })),
          },
          {
            AND: search.words.map((word) => ({
              user: { username: { contains: word, mode: 'insensitive' } },
            })),
          },
        ],
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: Mood;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
