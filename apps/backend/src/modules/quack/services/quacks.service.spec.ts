// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { PollResults } from '@/modules/quack/domain/poll';
import { Quack } from '@/modules/quack/domain/quack';
import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

const viewer = { id: 'u1' } as Identity;

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository, mock<PollRepository>());

    await expect(service.getQuacks(viewer)).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('ignores a search shorter than 2 characters', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository, mock<PollRepository>());
    await service.getQuacks(viewer, ' a ');

    expect(repository.getQuacks).toHaveBeenCalledWith('u1');
  });

  it('searches for every trimmed word', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([aQuack()]);

    const service = new QuacksService(repository, mock<PollRepository>());
    await expect(
      service.getQuacks(viewer, '  duck   pond '),
    ).resolves.toHaveLength(1);

    expect(repository.getQuacks).toHaveBeenCalledWith('u1', {
      words: ['duck', 'pond'],
    });
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository, mock<PollRepository>());
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: undefined,
      pollOptions: undefined,
      userId: 'u1',
    });
  });

  it('passes the mood through to the repository', async () => {
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(aQuack({ mood: 'silly' }));

    const service = new QuacksService(repository, mock<PollRepository>());
    const user = { id: 'u1' } as Identity;

    await service.createQuack(user, { text: 'hello', mood: 'silly' });
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: 'silly',
      pollOptions: undefined,
      userId: 'u1',
    });
  });

  it('passes poll answers through to the repository', async () => {
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(aQuack());

    const service = new QuacksService(repository, mock<PollRepository>());
    await service.createQuack(viewer, {
      text: 'Lunch?',
      pollOptions: ['Pizza', 'Sushi'],
    });

    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'Lunch?',
      mood: undefined,
      pollOptions: ['Pizza', 'Sushi'],
      userId: 'u1',
    });
  });

  describe('polls', () => {
    const aPoll = (overrides: Partial<PollResults> = {}): PollResults => ({
      options: [
        { id: 'o1', text: 'Pizza', votes: 1 },
        { id: 'o2', text: 'Sushi', votes: 0 },
      ],
      totalVotes: 1,
      myOptionId: 'o1',
      closedAt: null,
      ...overrides,
    });

    const setup = (): {
      quacks: MockProxy<QuackRepository>;
      polls: MockProxy<PollRepository>;
      service: QuacksService;
    } => {
      const quacks = mock<QuackRepository>();
      const polls = mock<PollRepository>();
      return { quacks, polls, service: new QuacksService(quacks, polls) };
    };

    it('returns fresh results after a vote', async () => {
      const { quacks, polls, service } = setup();
      polls.vote.mockResolvedValue('voted');
      quacks.getQuack.mockResolvedValue(aQuack({ poll: aPoll() }));

      await expect(service.vote(viewer, 'q1', 'o1')).resolves.toEqual(aPoll());
      // the voter comes from the session, never from the request
      expect(polls.vote).toHaveBeenCalledWith({
        quackId: 'q1',
        userId: 'u1',
        optionId: 'o1',
      });
    });

    it.each([
      ['poll_not_found', NotFoundException],
      ['bad_option', BadRequestException],
      ['closed', ConflictException],
    ] as const)('maps %s to an HTTP error', async (outcome, error) => {
      const { polls, service } = setup();
      polls.vote.mockResolvedValue(outcome);

      await expect(service.vote(viewer, 'q1', 'o1')).rejects.toBeInstanceOf(
        error,
      );
    });

    it('lets the author close the poll', async () => {
      const { quacks, polls, service } = setup();
      const closed = aPoll({ closedAt: new Date('2026-01-02T00:00:00Z') });
      quacks.getQuack
        .mockResolvedValueOnce(aQuack({ poll: aPoll() }))
        .mockResolvedValueOnce(aQuack({ poll: closed }));
      polls.close.mockResolvedValue('closed');

      await expect(service.closePoll(viewer, 'q1')).resolves.toEqual(closed);
      expect(polls.close).toHaveBeenCalledWith('q1');
    });

    it("refuses to close someone else's poll", async () => {
      const { quacks, polls, service } = setup();
      quacks.getQuack.mockResolvedValue(
        aQuack({ userId: 'someone-else', poll: aPoll() }),
      );

      await expect(service.closePoll(viewer, 'q1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(polls.close).not.toHaveBeenCalled();
    });

    it('answers 404 when the quack has no poll', async () => {
      const { quacks, service } = setup();
      quacks.getQuack.mockResolvedValue(aQuack({ poll: null }));

      await expect(service.closePoll(viewer, 'q1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
