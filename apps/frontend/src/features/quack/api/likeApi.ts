import { api } from "@/lib/api-client"

import { likeResultSchema, type LikeResult } from "@/features/quack/api/quackSchemas"

export type { LikeResult }

export async function toggleLike(quackId: string): Promise<LikeResult> {
  return likeResultSchema.parse(await api.post(`quacks/${quackId}/like`).json())
}
