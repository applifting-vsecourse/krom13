# Plan: polls in quacks

Implements [story.md](story.md). Follows the quack pattern: schema → repository → service → controller/DTO → zod → TanStack Query → UI.

## Approach in one paragraph

A poll is a quack with an optional `Poll`. Votes are stored one row per person per poll, and results are always counted from those rows when read — no counters to drift, so everyone sees the same numbers. The database enforces "one person, one vote" and "the answer belongs to this poll"; the service enforces "not closed" under a row lock so a vote and a close can't both win. The frontend updates the cache optimistically and rolls back on failure.

## Data model (Prisma, one migration)

```prisma
model Quack {
  // existing fields …
  poll Poll?
}

model Poll {
  quackId  String       @id
  quack    Quack        @relation(fields: [quackId], references: [id], onDelete: Cascade)
  closedAt DateTime?
  options  PollOption[]
  votes    PollVote[]

  @@map("poll")
}

model PollOption {
  id       String     @default(cuid())
  quackId  String
  poll     Poll       @relation(fields: [quackId], references: [quackId], onDelete: Cascade)
  text     String     @db.VarChar(80)
  position Int
  votes    PollVote[]

  @@id([quackId, id])   // lets votes reference (poll, option) together
  @@unique([quackId, position])
  @@map("poll_option")
}

model PollVote {
  quackId   String
  userId    String
  optionId  String
  poll      Poll       @relation(fields: [quackId], references: [quackId], onDelete: Cascade)
  option    PollOption @relation(fields: [quackId, optionId], references: [quackId, id], onDelete: Cascade)
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@id([quackId, userId])   // one person, one vote per poll — enforced by the DB
  @@index([quackId, optionId])
  @@map("poll_vote")
}
```

- `PollVote`'s composite foreign key means a vote can never point at another poll's answer, even if the service had a bug.
- Changing a vote is an upsert on `(quackId, userId)` that sets `optionId`.
- `User` gets `pollVotes PollVote[]`.
- Counts: `groupBy` on `PollVote` by `(quackId, optionId)` for all polls on the page in one query, plus one query for the current user's votes. No N+1.

## API (all behind `AuthenticatedUserGuard`, DTO-validated)

| Endpoint                          | Purpose                           | Notes                                                                                                                                                                       |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/quacks`                | Create a quack, optionally a poll | Body gains `poll?: { options: string[] }`. 2–6 options, each trimmed 1–80, distinct ignoring case. 400 otherwise. Quack and poll are created in one transaction.            |
| `GET /api/quacks`                 | Feed                              | Each quack gains `poll: null` or `{ options: [{ id, text, votes }], totalVotes, myOptionId, closedAt }`. Same `?q=` search on question text.                                |
| `PUT /api/quacks/:id/vote`        | Vote or change vote               | Body `{ optionId }`. Returns the poll results. 404 no such poll, 400 option not in this poll, 409 poll closed. Idempotent: the same choice twice is a no-op, same response. |
| `POST /api/quacks/:id/poll/close` | Close a poll                      | Author only (403 otherwise), 404 if no poll. Idempotent. Returns the poll results.                                                                                          |

`PUT` for voting because the request sets "my vote on this poll" to a value; repeating it is harmless.

The vote runs in one interactive transaction: lock the poll row (`SELECT … FOR SHARE`), reject if `closedAt` is set, upsert the vote. Closing is `UPDATE poll SET closedAt = now() WHERE closedAt IS NULL`, which needs an exclusive lock, so a vote either lands before the close or is rejected with 409 — never counted after it.

Backend structure: new files next to the existing ones in `modules/quack` — `poll` types in `domain/quack.ts`, `PollRepository` (counts, vote, close), `QuacksService.vote` / `closePoll`, DTOs `create-poll.dto.ts`, `vote.dto.ts`, `poll.response.dto.ts`, two handlers in `QuacksController`. Search code is untouched.

## Frontend

- `quackSchemas.ts`: zod `pollSchema`; `quackSchema` gains `poll: pollSchema.nullable()`.
- `api/voteOnPoll.ts`, `api/closePoll.ts`, `hooks/useVote.ts`, `hooks/useClosePoll.ts`.
- `useVote`: `onMutate` cancels in-flight list queries, snapshots the lists, and applies the vote locally (move one count, set `myOptionId`); `onError` restores the snapshot and records the failure for that poll (message plus Retry); `onSettled` invalidates the lists so the server's numbers win. A 409 shows "This poll closed before your vote." and refetches instead of offering Retry.
- Feed query: `refetchInterval: 10_000` on the quacks list, paused while a vote mutation is pending so a refresh can't overwrite the optimistic state. Refetch on focus stays on.
- Components: `PollView` (answers as `<button>`s with `aria-pressed`, count, percentage, bar, "Your vote", total, error + Retry, closed label), `PollFields` for the form, a close dialog (existing `dialog` kit component). Bars use token colours (`bg-primary` for mine, `bg-secondary` for others); no new components outside the kit. `QuackForm` gains the toggle.
- Layout per DESIGN.md: the poll sits inside the quack's card with spacing and no nested card.

## Build order

Each step ends with `pnpm check-all` green and is one commit.

1. **Docs**: this plan and the story (done).
2. **Schema + migration**: the three models, `pnpm backend prisma:migrations:run`.
3. **Read path**: domain types, repository counts, response DTO, `GET` returns `poll`. Seed adds an open and a closed poll with votes. Unit tests for the result shaping (totals, `myOptionId`, empty poll).
4. **Create path**: `CreateQuackDto.poll` validation, transactional create. Tests: 1 or 7 options, empty, duplicate, 81 characters, no poll.
5. **Vote**: endpoint, locked transaction, errors. Tests: first vote, change vote, same vote twice, wrong option, closed poll, and a concurrent-votes check against Postgres that one person never ends with two rows or a wrong total.
6. **Close**: endpoint and permissions. Tests: author, non-author, twice, vote-after-close; the vote-vs-close race.
7. **Frontend read**: schemas, `PollView` (read-only), list tests including 0 votes, 1 vs many votes, closed.
8. **Frontend create**: toggle and fields with client validation mirroring the server. Tests for the rules in the story.
9. **Frontend voting**: `useVote` with optimistic update, rollback, Retry, closed-race message. Tests for each.
10. **Frontend close**: button for the author only, confirmation dialog.
11. **Refresh**: 10-second interval, paused during a pending vote; test with fake timers.
12. **Wrap-up**: ADR 0002 (results counted on read; DB-enforced vote uniqueness; locking against close), final `pnpm check-all`, walk through the acceptance criteria with the product owner.

## Risks and notes

- **Feed size**: counts for every poll are grouped on each 10-second refetch. Fine for a teaching app; if it grows, add pagination before caching counts.
- **Rounded percentages** may not add up to 100; counts are exact (story default).
- **`config/react-query.ts` says "no polling"**: the interval is scoped to the feed query only, and the comment there will be updated in step 11.
- **Existing quacks** have no `Poll`, so nothing needs backfilling.
