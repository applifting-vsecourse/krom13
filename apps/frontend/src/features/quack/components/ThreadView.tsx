import { useState } from "react"

import type { Mood } from "@/lib/moods"

import type { Thread, ThreadItem } from "@/features/quack/api/quackSchemas"
import { ReplyBranch } from "@/features/quack/components/ReplyBranch"
import { ReplyForm } from "@/features/quack/components/ReplyForm"
import { ThreadItemView } from "@/features/quack/components/ThreadItemView"

type ThreadViewProps = {
  thread: Thread
  currentUserId?: string
  isModerator?: boolean
  defaultMood?: Mood
}

type ReplyTarget = { id: string; username: string }

export function ThreadView({ thread, currentUserId, isModerator, defaultMood }: ThreadViewProps) {
  const { quack, replies } = thread
  // Answering a reply; otherwise the form answers the top-level quack.
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)

  const answerCount = (id: string) => replies.filter((reply) => reply.parentId === id).length
  const branches = groupIntoBranches(quack.id, replies)
  const rootTarget =
    quack.deleted || !quack.user ? null : { id: quack.id, username: quack.user.username }

  return (
    <div className="flex flex-col gap-6">
      <ThreadItemView
        item={quack}
        answerCount={answerCount(quack.id)}
        currentUserId={currentUserId}
        isModerator={isModerator}
      />

      <section
        aria-labelledby="replies-heading"
        className="flex flex-col"
      >
        <h2
          id="replies-heading"
          className="mb-2 text-lg font-semibold tracking-tight"
        >
          Replies
        </h2>
        {replies.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No replies yet. Be the first.</p>
        ) : (
          branches.map(({ head, descendants }) => (
            <ReplyBranch
              key={head.id}
              head={head}
              descendants={descendants}
              answerCount={answerCount}
              currentUserId={currentUserId}
              isModerator={isModerator}
              replyTargetId={replyTarget?.id}
              replyForm={
                replyTarget ? (
                  <ReplyForm
                    // A new target is a new reply: start with an empty form.
                    key={replyTarget.id}
                    targetId={replyTarget.id}
                    targetUsername={replyTarget.username}
                    onCancelTarget={() => setReplyTarget(null)}
                    defaultMood={defaultMood}
                    shouldFocus
                  />
                ) : null
              }
              onReply={(item) =>
                setReplyTarget({ id: item.id, username: item.user?.username ?? "" })
              }
            />
          ))
        )}
      </section>

      {/* Answering the top-level quack: the form sits at the bottom. */}
      {!replyTarget && rootTarget ? (
        <ReplyForm
          key={rootTarget.id}
          targetId={rootTarget.id}
          defaultMood={defaultMood}
        />
      ) : null}
    </div>
  )
}

/**
 * Groups the flat, oldest-first replies by the direct reply to the quack they
 * descend from. A head is always older than its descendants, so it comes first.
 */
function groupIntoBranches(
  rootId: string,
  replies: ThreadItem[],
): { head: ThreadItem; descendants: ThreadItem[] }[] {
  const byId = new Map(replies.map((reply) => [reply.id, reply]))
  const headOf = (reply: ThreadItem): string => {
    let current = reply
    while (current.parentId && current.parentId !== rootId) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
    }
    return current.id
  }

  const branches = new Map<string, { head: ThreadItem; descendants: ThreadItem[] }>()
  for (const reply of replies) {
    const headId = headOf(reply)
    const branch = branches.get(headId)
    if (!branch) branches.set(reply.id, { head: reply, descendants: [] })
    else branch.descendants.push(reply)
  }
  return [...branches.values()]
}
