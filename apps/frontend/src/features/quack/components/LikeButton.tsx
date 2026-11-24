// Stub: the like button comes with the feature (docs/adr/0007-likes.md).
type LikeButtonProps = {
  quackId: string
  likeCount: number
  likedByMe: boolean
  // False for a visitor who is not signed in: the count shows, the button is off.
  canLike: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LikeButton(props: LikeButtonProps): React.ReactNode {
  throw new Error("not implemented")
}
