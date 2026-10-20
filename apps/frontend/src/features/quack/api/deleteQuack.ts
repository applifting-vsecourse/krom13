import { api, HTTPError } from "@/lib/api-client"

export async function deleteQuack(quackId: string): Promise<void> {
  try {
    await api.delete(`quacks/${quackId}`)
  } catch (error) {
    // Already gone (deleted in another tab): the quack is not there, which is
    // what the person wanted.
    if (error instanceof HTTPError && error.response.status === 404) return
    throw error
  }
}
