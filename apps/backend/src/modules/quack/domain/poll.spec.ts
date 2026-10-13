import { buildPollResults } from './poll';

const options = [
  { id: 'b', text: 'Sushi', position: 1 },
  { id: 'a', text: 'Pizza', position: 0 },
  { id: 'c', text: 'Soup', position: 2 },
];

describe('buildPollResults', () => {
  it('keeps the author order and counts a missing option as 0', () => {
    const results = buildPollResults({
      options,
      counts: new Map([
        ['a', 3],
        ['b', 1],
      ]),
      myOptionId: 'b',
      closedAt: null,
    });

    expect(results.options).toEqual([
      { id: 'a', text: 'Pizza', votes: 3 },
      { id: 'b', text: 'Sushi', votes: 1 },
      { id: 'c', text: 'Soup', votes: 0 },
    ]);
    expect(results.totalVotes).toBe(4);
    expect(results.myOptionId).toBe('b');
  });

  it('reports an empty poll', () => {
    const results = buildPollResults({
      options,
      counts: new Map(),
      myOptionId: null,
      closedAt: null,
    });

    expect(results.totalVotes).toBe(0);
    expect(results.myOptionId).toBeNull();
  });

  it('carries the closing time', () => {
    const closedAt = new Date('2026-01-01T12:00:00Z');
    expect(
      buildPollResults({
        options,
        counts: new Map(),
        myOptionId: null,
        closedAt,
      }).closedAt,
    ).toBe(closedAt);
  });
});
