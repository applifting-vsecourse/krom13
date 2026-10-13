import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { percentOf } from "@/features/quack/api/pollMath"
import type { Poll } from "@/features/quack/api/quackSchemas"
import { useClosePoll } from "@/features/quack/hooks/useClosePoll"
import { isPollClosedError, useVote } from "@/features/quack/hooks/useVote"

type PollViewProps = {
  quackId: string
  poll: Poll
  // Only the author gets the Close button.
  canClose?: boolean
}

export function PollView({ quackId, poll, canClose }: PollViewProps) {
  const vote = useVote()
  const closePoll = useClosePoll()
  const [isConfirming, setIsConfirming] = useState(false)
  const isClosed = poll.closedAt !== null

  const choose = (optionId: string) => {
    if (isClosed || optionId === poll.myOptionId) return
    vote.mutate({ quackId, optionId })
  }

  const votesLabel =
    poll.totalVotes === 0
      ? "No votes yet"
      : `${poll.totalVotes} ${poll.totalVotes === 1 ? "vote" : "votes"}`

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div
        role="group"
        aria-label="Poll answers"
        className="flex flex-col gap-2"
      >
        {poll.options.map((option) => {
          const isMine = option.id === poll.myOptionId
          const percent = percentOf(option.votes, poll.totalVotes)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isMine}
              disabled={isClosed}
              onClick={() => choose(option.id)}
              className={cn(
                "relative overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none enabled:hover:bg-accent disabled:cursor-default",
                isMine ? "border-primary" : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0",
                  isMine ? "bg-primary/20" : "bg-secondary",
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-baseline justify-between gap-3">
                <span className="break-words">
                  {option.text}
                  {isMine ? (
                    <span className="ml-2 text-xs text-muted-foreground">Your vote</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {option.votes} ({percent}%)
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {vote.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            {isPollClosedError(vote.error) ? (
              <span>This poll closed before your vote.</span>
            ) : (
              <>
                <span>Your vote didn&apos;t go through.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => vote.mutate(vote.variables)}
                >
                  Retry
                </Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {votesLabel}
          {isClosed ? " · Closed" : ""}
        </span>
        {canClose && !isClosed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirming(true)}
          >
            Close poll
          </Button>
        ) : null}
      </div>

      <Dialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this poll?</DialogTitle>
            <DialogDescription>
              Nobody can vote or change their vote afterwards, and it can&apos;t be reopened. The
              final counts stay visible.
            </DialogDescription>
          </DialogHeader>
          {closePoll.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{closePoll.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={closePoll.isPending}
              onClick={() =>
                closePoll.mutate(quackId, {
                  onSuccess: () => setIsConfirming(false),
                })
              }
            >
              {closePoll.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Close poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
