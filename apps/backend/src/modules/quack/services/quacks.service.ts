import { PollResults } from '@/modules/quack/domain/poll';
import { Mood, Quack } from '@/modules/quack/domain/quack';
import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Anything shorter is ignored and the full feed is returned.
const MIN_SEARCH_LENGTH = 2;

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(
    private readonly quackRepository: QuackRepository,
    private readonly pollRepository: PollRepository,
  ) {}

  async getQuacks(user: Identity, query?: string): Promise<Quack[]> {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return this.quackRepository.getQuacks(user.id);
    }

    const quacks = await this.quackRepository.getQuacks(user.id, {
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
    quackData: { text: string; mood?: Mood; pollOptions?: string[] },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      pollOptions: quackData.pollOptions,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }

  async vote(
    user: Identity,
    quackId: string,
    optionId: string,
  ): Promise<PollResults> {
    const outcome = await this.pollRepository.vote({
      quackId,
      userId: user.id,
      optionId,
    });
    switch (outcome) {
      case 'poll_not_found':
        throw new NotFoundException('Poll not found');
      case 'bad_option':
        throw new BadRequestException('That answer is not part of this poll');
      case 'closed':
        throw new ConflictException('This poll is closed');
      case 'voted':
        return this.getPollResults(quackId, user.id);
    }
  }

  async closePoll(user: Identity, quackId: string): Promise<PollResults> {
    const quack = await this.quackRepository.getQuack(quackId, user.id);
    if (!quack?.poll) throw new NotFoundException('Poll not found');
    if (quack.userId !== user.id) {
      throw new ForbiddenException('Only the author can close a poll');
    }
    await this.pollRepository.close(quackId);
    return this.getPollResults(quackId, user.id);
  }

  private async getPollResults(
    quackId: string,
    viewerId: string,
  ): Promise<PollResults> {
    const quack = await this.quackRepository.getQuack(quackId, viewerId);
    if (!quack?.poll) throw new NotFoundException('Poll not found');
    return quack.poll;
  }
}
