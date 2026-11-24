// Stub: the like call comes with the feature (docs/adr/0007-likes.md).
export type LikeResult = { liked: boolean; likeCount: number }

// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
export async function toggleLike(quackId: string): Promise<LikeResult> {
  throw new Error("not implemented")
}
