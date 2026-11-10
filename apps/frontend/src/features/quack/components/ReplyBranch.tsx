import { Fragment, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

import type { ThreadItem } from "@/features/quack/api/quackSchemas"
import { ThreadItemView } from "@/features/quack/components/ThreadItemView"

type ReplyBranchProps = {
  /** A direct reply to the top-level quack. */
  head: ThreadItem
  /** Everything below the head, oldest first: replies to it and to those. */
  descendants: ThreadItem[]
  answerCount: (id: string) => number
  currentUserId?: string
  isModerator?: boolean
  onReply: (item: ThreadItem) => void
  /** The reply being answered, if it is in this conversation. */
  replyTargetId?: string
  /** The form for that reply: shown right under it, so it is clear what it answers. */
  replyForm?: ReactNode
}

/**
 * One conversation under a quack, like a YouTube comment: the head reply, and
 * below it, indented behind a hairline, every answer to it. Answers stay flat
 * (no deeper indent) and say who they answer.
 */
export function ReplyBranch({
  head,
  descendants,
  answerCount,
  currentUserId,
  isModerator,
  onReply,
  replyTargetId,
  replyForm,
}: ReplyBranchProps) {
  const [isOpen, setIsOpen] = useState(true)
  const label = `${descendants.length} ${descendants.length === 1 ? "reply" : "replies"}`
  const owner = head.user ? `@${head.user.username}` : "a deleted quack"

  const viewFor = (item: ThreadItem, isNested: boolean) => (
    <Fragment key={item.id}>
      <ThreadItemView
        item={item}
        isNested={isNested}
        answerCount={answerCount(item.id)}
        currentUserId={currentUserId}
        isModerator={isModerator}
        onReply={item.deleted || !item.user ? undefined : () => onReply(item)}
      />
      {replyTargetId === item.id ? (
        <div className={isNested ? "py-3" : "py-3 pl-6"}>{replyForm}</div>
      ) : null}
    </Fragment>
  )

  return (
    <div className="flex flex-col">
      {viewFor(head, false)}
      {descendants.length > 0 ? (
        <div className="flex flex-col pl-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 w-fit text-muted-foreground"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)}
          >
            {isOpen ? `Hide ${label}` : `Show ${label}`}
          </Button>
          {isOpen ? (
            <div
              role="group"
              aria-label={`Replies to ${owner}`}
              className="flex flex-col border-l border-border pl-4"
            >
              {descendants.map((item) => viewFor(item, true))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
