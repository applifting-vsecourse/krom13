import { PollResults } from '@/modules/quack/domain/poll';

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export const MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type Mood = (typeof MOODS)[number];

export type Quack = {
  id: string;
  text: string;
  mood: Mood | null;
  // null once the quack is emptied (deletedAt is set): nothing of it is kept.
  userId: string | null;
  // What this answers, and the top-level quack of its thread. null for a
  // top-level quack.
  parentId: string | null;
  rootId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
  poll?: PollResults | null;
  // Live replies in the thread. Only filled in for top-level quacks.
  replyCount?: number;
};

export type Thread = {
  quack: Quack;
  // Oldest first, flat. May include emptied replies that still have replies.
  replies: Quack[];
};
