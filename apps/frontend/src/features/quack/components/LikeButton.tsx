import { Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"

import { useLike } from "@/features/quack/hooks/useLike"

type LikeButtonProps = {
  quackId: string
  likeCount: number
  likedByMe: boolean
}

export function LikeButton({ quackId, likeCount, likedByMe: isLiked }: LikeButtonProps) {
  const like = useLike()

  const toggle = () => {
    if (like.isPending) return
    like.mutate(quackId)
  }

  return (
    <div className="flex items-center gap-2">
      <Toggle
        size="sm"
        className="text-muted-foreground"
        pressed={isLiked}
        onPressedChange={toggle}
      >
        <Heart
          aria-hidden="true"
          className={isLiked ? "fill-current" : undefined}
        />
        <span className="sr-only">Like</span>
        <span>{likeCount}</span>
      </Toggle>
      {like.isError ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          Your like didn&apos;t go through.
          <Button
            variant="outline"
            size="sm"
            onClick={() => like.mutate(quackId)}
          >
            Retry
          </Button>
        </p>
      ) : null}
    </div>
  )
}
