// Unit tests for likes (cases.md, section 1 "Rules"). The repository is
// mocked, so these check what the service decides, not what Postgres stores:
// the stored-row cases (R3, R7, R10) are proven end to end in
// quacks.likes.int-spec.ts.
import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { NotFoundException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const ann = { id: 'ann' } as Identity;

describe('QuacksService likes', () => {
  let repository: MockProxy<QuackRepository>;
  let service: QuacksService;

  beforeEach(() => {
    repository = mock<QuackRepository>();
    service = new QuacksService(repository, mock<PollRepository>());
  });

  // R1
  it('likes a quack that is not liked yet: liked, count 1', async () => {
    repository.toggleLike.mockResolvedValue({
      outcome: 'liked',
      likeCount: 1,
    });

    await expect(service.toggleLike(ann, 'q1')).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });
    expect(repository.toggleLike).toHaveBeenCalledWith('q1', 'ann');
  });

  // R2
  it('takes a like back: not liked, count 0', async () => {
    repository.toggleLike.mockResolvedValue({
      outcome: 'unliked',
      likeCount: 0,
    });

    await expect(service.toggleLike(ann, 'q1')).resolves.toEqual({
      liked: false,
      likeCount: 0,
    });
  });

  // R3 (the stored rows are in the integration test)
  it("toggles only the viewer's own like and reports the count left over", async () => {
    repository.toggleLike.mockResolvedValue({
      outcome: 'unliked',
      likeCount: 1,
    });

    await expect(service.toggleLike(ann, 'q1')).resolves.toEqual({
      liked: false,
      likeCount: 1,
    });
    expect(repository.toggleLike).toHaveBeenCalledTimes(1);
    expect(repository.toggleLike).toHaveBeenCalledWith('q1', 'ann');
  });

  // R4
  it('lets the author like their own quack', async () => {
    repository.toggleLike.mockResolvedValue({
      outcome: 'liked',
      likeCount: 1,
    });

    await expect(
      service.toggleLike({ id: 'bob' } as Identity, 'q1'),
    ).resolves.toEqual({ liked: true, likeCount: 1 });
  });

  // R5
  it('likes the reply itself, not the quack it answers', async () => {
    repository.toggleLike.mockResolvedValue({
      outcome: 'liked',
      likeCount: 1,
    });

    await expect(service.toggleLike(ann, 'reply-1')).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });

    expect(repository.toggleLike).toHaveBeenCalledTimes(1);
    expect(repository.toggleLike).toHaveBeenCalledWith('reply-1', 'ann');
  });

  // R6
  it('rejects a like on an emptied quack as not found', async () => {
    repository.toggleLike.mockResolvedValue({ outcome: 'quack_deleted' });

    const result = service.toggleLike(ann, 'q1');

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toThrow('Quack not found');
  });

  // R8
  it('rejects a like on an unknown quack as not found', async () => {
    repository.toggleLike.mockResolvedValue({ outcome: 'quack_not_found' });

    const result = service.toggleLike(ann, 'nope');

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toThrow('Quack not found');
  });

  // R10 (the stored rows are in the integration test)
  it('two toggles in a row end where they started', async () => {
    repository.toggleLike
      .mockResolvedValueOnce({ outcome: 'liked', likeCount: 1 })
      .mockResolvedValueOnce({ outcome: 'unliked', likeCount: 0 });

    await expect(service.toggleLike(ann, 'q1')).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });
    await expect(service.toggleLike(ann, 'q1')).resolves.toEqual({
      liked: false,
      likeCount: 0,
    });
  });
});
