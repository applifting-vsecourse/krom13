# 0005: Deleting a quack with replies empties it

Status: accepted (2026-11-10)

## Context

People can now reply to a quack ([story.md](../../story.md)). Two promises pull against each other:

1. Replies belong to the people who wrote them. Deleting a quack must not delete someone else's reply.
2. A deleted quack really disappears: its text, mood, poll, votes and author are gone from the database, not hidden.

Until now deleting was a plain hard delete (`deleteMany`) and every `quack` row was live content with an author (`userId NOT NULL`). Replies are stored as quacks, linked by `parentId` (what it answers) and `rootId` (the thread's top-level quack). Whatever we pick here is baked into the `quack` table, every query that reads it and every delete path, and can't be changed later without a data migration.

## Decision

A quack or reply **with replies is emptied in place**; one **without replies is hard-deleted**, as today.

- Emptied means, in one transaction: the poll is deleted (options and votes cascade), `text = ''`, `mood = NULL`, `userId = NULL`, `deletedAt = now`. The row keeps its id and its links, so replies stay threaded under a "This quack was deleted" placeholder.
- When the last reply under an emptied row is deleted, the emptied row is deleted too, and so on up the chain. Nothing of a deleted quack outlives its replies.
- `parentId` and `rootId` use `onDelete: Restrict`. The database refuses any delete that would orphan a reply.
- A CHECK constraint says a row is either live (`deletedAt IS NULL AND userId IS NOT NULL`) or hollow (`deletedAt IS NOT NULL AND userId IS NULL AND text = '' AND mood IS NULL`).
- The feed, search, Mine and reply counts read only `deletedAt IS NULL`. An emptied top-level quack is not a feed item; its replies are reached by link.

## Options considered

| Option                                                  | Why not                                                                                                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tombstone (chosen)**                                  | Costs a nullable `userId`, a flag every read must filter on, and a delete that is a small transaction instead of one statement.                                                                                        |
| Hard delete, replies detach (`parentId` SET NULL)       | Simplest, and the database guarantees the content is gone. But replies lose their thread, siblings are no longer grouped, and a reply-to-a-reply loses its target. The lost link can't be recovered later.             |
| Hard delete, but keep a content-free `Thread` row       | Content really goes and the thread survives. But it needs an extra table and join on every read, two writes that must stay in step, and a backfill of every existing quack. A reply-to-a-reply still loses its target. |
| Delete the replies together with the quack (cascade)    | Suggested by the product owner, then withdrawn: it breaks promise 1.                                                                                                                                                   |
| Keep the author on the emptied row ("Deleted by @name") | Leftover data about a deleted quack, and it leaks a name into the "in reply to" labels. It also ties the row to the user's cascade.                                                                                    |
| Nullable `text` on the emptied row                      | Every reader would have to handle null for a case that exists only for emptied rows. `''` plus the CHECK is enough.                                                                                                    |
| Keep emptied rows forever once their replies are gone   | Dead rows pile up, every query filters them, and a deleted quack would outlive its thread.                                                                                                                             |

## Consequences

What changes for the rest of the app:

- **`Quack.userId` is nullable.** Every type and query that reads the author (`QuackAuthor`, the response DTOs, the moderator log, "Mine", search by author) must handle a missing author. Live quacks always have one.
- **Every read of live content filters `deletedAt IS NULL`.** A new query that forgets it shows empty rows. The feed, search, Mine, reply counts and any future list (profile pages, notifications, exports) must apply it. This is the standing cost of the decision.
- **New content columns must be added to the erase step.** If `Quack` gains a column (an image, a link preview), the emptying code and its test must clear it, or "really disappears" stops being true. This rule is in [CLAUDE.md](../../CLAUDE.md).
- **One delete path.** Author delete ([0003](0003-delete-own-quacks.md)) and moderator delete ([0004](0004-moderator-deletes-any-quack.md)) both go through delete-or-empty. The owner check stays inside the write; the moderator log line stays.
- **Deleting a user account is blocked while others have replied** (`Restrict`). No such feature exists; a future story must decide it.
- **The delete dialog** says how many replies stay.
- **Integration tests** (`quack.repository.int.spec.ts`) must prove each case: no replies, has replies, the cleanup walk, nothing left on an emptied row, and that the feed, search and counts leave emptied rows out.
- **The migration is additive** (nullable columns, one relaxed `NOT NULL`, two CHECKs added `NOT VALID`) and runs on a database that already has data. It can't be reversed once emptied rows exist.
