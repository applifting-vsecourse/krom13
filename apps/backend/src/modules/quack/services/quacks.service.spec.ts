// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
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

    const service = new QuacksService(repository);

    await expect(service.getQuacks(viewer)).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('ignores a search shorter than 2 characters', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository);
    await service.getQuacks(viewer, ' a ');

    expect(repository.getQuacks).toHaveBeenCalledWith('u1');
  });

  it('searches for every trimmed word', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([aQuack()]);

    const service = new QuacksService(repository);
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

    const service = new QuacksService(repository);
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

    const service = new QuacksService(repository);
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

    const service = new QuacksService(repository);
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
});
