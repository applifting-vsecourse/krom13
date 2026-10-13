export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;
export const MAX_POLL_OPTION_LENGTH = 80;

export type PollOptionResult = {
  id: string;
  text: string;
  votes: number;
};

export type PollResults = {
  options: PollOptionResult[];
  totalVotes: number;
  // The signed-in viewer's answer, or null if they haven't voted.
  myOptionId: string | null;
  closedAt: Date | null;
};

/**
 * Results are always counted from the votes when read — nothing is stored
 * as a running tally, so every viewer sees the same numbers.
 */
export function buildPollResults(input: {
  options: { id: string; text: string; position: number }[];
  // votes per option id; options without votes may be missing
  counts: Map<string, number>;
  myOptionId: string | null;
  closedAt: Date | null;
}): PollResults {
  const options = [...input.options]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({
      id: option.id,
      text: option.text,
      votes: input.counts.get(option.id) ?? 0,
    }));
  return {
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myOptionId: input.myOptionId,
    closedAt: input.closedAt,
  };
}
