import type { Quack, Thread, ThreadItem } from "@/features/quack/api/quackSchemas"

type Likeable = { id: string; likeCount?: number; likedByMe?: boolean }

function flip<T extends Likeable>(item: T, quackId: string): T {
  if (item.id !== quackId) return item
  const isLiked = item.likedByMe ?? false
  const count = item.likeCount ?? 0
  return { ...item, likedByMe: !isLiked, likeCount: isLiked ? count - 1 : count + 1 }
}

export function flipLikeInList(quacks: Quack[], quackId: string): Quack[] {
  return quacks.map((quack) => flip(quack, quackId))
}

export function flipLikeInThread(thread: Thread, quackId: string): Thread {
  return {
    ...thread,
    quack: flip<ThreadItem>(thread.quack, quackId),
    replies: thread.replies.map((reply) => flip<ThreadItem>(reply, quackId)),
  }
}
