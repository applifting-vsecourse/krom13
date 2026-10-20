import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date"
import { MOOD_EMOJI } from "@/lib/moods"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { DeleteQuackDialog } from "@/features/quack/components/DeleteQuackDialog"
import { PollView } from "@/features/quack/components/PollView"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = { quack: Quack; currentUserId?: string }

export function QuackItem({ quack, currentUserId }: QuackItemProps) {
  const { name, username } = quack.user
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const isMine = currentUserId === quack.userId

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <article className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0">
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
          {isMine ? (
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
        {quack.mood ? (
          <span className="w-fit rounded-md border border-border px-2 text-xs text-muted-foreground">
            <span aria-hidden="true">{MOOD_EMOJI[quack.mood]}</span> {quack.mood}
          </span>
        ) : null}
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {quack.poll ? (
          <PollView
            quackId={quack.id}
            poll={quack.poll}
            canClose={isMine}
          />
        ) : null}
      </div>

      {isMine ? (
        <DeleteQuackDialog
          quackId={quack.id}
          hasPoll={quack.poll !== null}
          isOpen={isConfirmingDelete}
          onOpenChange={setIsConfirmingDelete}
        />
      ) : null}
    </article>
  )
}
