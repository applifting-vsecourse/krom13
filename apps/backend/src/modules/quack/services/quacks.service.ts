import { Mood, Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable, Logger } from '@nestjs/common';

// Anything shorter is ignored and the full feed is returned.
const MIN_SEARCH_LENGTH = 2;

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(query?: string): Promise<Quack[]> {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return this.quackRepository.getQuacks();
    }

    const quacks = await this.quackRepository.getQuacks({
      words: trimmed.split(/\s+/),
    });
    // Length and count only — what people type is not stored.
    this.logger.log(
      `Quack search: queryLength=${trimmed.length} results=${quacks.length}`,
    );
    return quacks;
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood?: Mood },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
