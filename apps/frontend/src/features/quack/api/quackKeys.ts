export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, tab: "all" | "mine" = "all") =>
    [...quackKeys.lists(), tab, search] as const,
  vote: () => ["quacks", "vote"] as const,
}
