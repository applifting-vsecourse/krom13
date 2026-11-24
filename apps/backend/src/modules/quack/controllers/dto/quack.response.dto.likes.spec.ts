// Unit tests for likes (cases.md R11): the like fields in the responses.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackResponseDto, ThreadItemDto } from './quack.response.dto';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'bob',
  parentId: null,
  rootId: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'bob', name: 'Bob', username: 'bob' },
  ...overrides,
});

describe('like fields in responses', () => {
  // R11: a quack nobody liked shows 0, never blank or missing.
  it('shows 0 likes and not liked for a quack nobody liked', () => {
    expect(QuackResponseDto.fromDomain(aQuack())).toMatchObject({
      likeCount: 0,
      likedByMe: false,
    });
    expect(ThreadItemDto.fromDomain(aQuack())).toMatchObject({
      likeCount: 0,
      likedByMe: false,
    });
  });

  it("passes the count and the viewer's own like through", () => {
    const liked = aQuack({ likeCount: 3, likedByMe: true });

    expect(QuackResponseDto.fromDomain(liked)).toMatchObject({
      likeCount: 3,
      likedByMe: true,
    });
    expect(ThreadItemDto.fromDomain(liked)).toMatchObject({
      likeCount: 3,
      likedByMe: true,
    });
  });
});
