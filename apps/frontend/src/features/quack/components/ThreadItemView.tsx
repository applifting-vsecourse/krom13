import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date"
import { MOOD_EMOJI } from "@/lib/moods"

import type { ThreadItem } from "@/features/quack/api/quackSchemas"
import { DeleteQuackDialog } from "@/features/quack/components/DeleteQuackDialog"
import { PollView } from "@/features/quack/components/PollView"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"
import { initialsOf } from "@/features/quack/lib/initials"

type ThreadItemViewProps = {
  item: ThreadItem
  /** Replies that answer this item directly; they stay if it is deleted. */
  answerCount: number
  currentUserId?: string
  isModerator?: boolean
  /** Not offered for the placeholder of a deleted quack. */
  onReply?: () => void
  /** A reply inside a thread's indented part: a smaller avatar. */
  isNested?: boolean
}

/** The top-level quack or one reply on the thread page. */
export function ThreadItemView({
  item,
  answerCount,
  currentUserId,
  isModerator = false,
  onReply,
  isNested = false,
}: ThreadItemViewProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // Nothing of a deleted quack is shown, only that its replies belong somewhere.
  if (item.deleted || !item.user) {
    return (
      <article className="border-b border-border pt-2 pb-4 last:border-b-0">
        <p className="text-sm text-muted-foreground italic">This quack was deleted.</p>
      </article>
    )
  }

  const { name, username } = item.user
  const isMine = currentUserId === item.userId
  const canDelete = isMine || isModerator

  return (
    <article className="flex w-full gap-3 border-b border-border pt-2 pb-4 last:border-b-0">
      <Avatar className={isNested ? "size-8" : "size-12"}>
        <AvatarFallback>{initialsOf(name)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</time>
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              aria-label="Delete quack"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete
            </Button>
          ) : null}
        </div>
        {item.inReplyTo ? (
          <p className="text-xs text-muted-foreground">
            {item.inReplyTo.deleted || !item.inReplyTo.username
              ? "in reply to a deleted quack"
              : `in reply to @${item.inReplyTo.username}`}
          </p>
        ) : null}
        {item.mood ? (
          <span className="w-fit rounded-md border border-border px-2 text-xs text-muted-foreground">
            <span aria-hidden="true">{MOOD_EMOJI[item.mood]}</span> {item.mood}
          </span>
        ) : null}
        <p className="text-sm break-words whitespace-pre-line">{item.text}</p>
        {item.poll ? (
          <PollView
            quackId={item.id}
            poll={item.poll}
            canClose={isMine}
          />
        ) : null}
        {onReply ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 w-fit text-muted-foreground"
            aria-label={`Reply to @${username}`}
            onClick={onReply}
          >
            Reply
          </Button>
        ) : null}
      </div>

      {canDelete ? (
        <DeleteQuackDialog
          quackId={item.id}
          authorUsername={isMine ? undefined : username}
          hasPoll={item.poll !== null}
          replyCount={answerCount}
          isOpen={isConfirmingDelete}
          onOpenChange={setIsConfirmingDelete}
        />
      ) : null}
    </article>
  )
}
