# 0002: Polls in quacks

Status: accepted (2026-10-13)

## Context

People ask questions in posts and count the replies by hand, get the numbers wrong, and bury the post. The product owner wants a quack that carries a few answers, lets everyone pick one, and shows correct counts. The story is in [story.md](../../story.md), the build plan in [plan.md](../../plan.md).

## Decisions

| Question               | Decision                                                                                                                 | Alternatives rejected                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| What is a poll         | A quack with an optional poll (2–6 answers, 80 characters each)                                                          | A separate post type and page                                                  |
| Where counts live      | Counted from the vote rows on every read                                                                                 | Counter columns or browser tallies, which can drift and disagree between users |
| One person, one vote   | Primary key `(quackId, userId)` on `poll_vote`; changing a vote is an upsert                                             | Checking in the service only                                                   |
| Answer belongs to poll | Composite foreign key `(quackId, optionId)` to `poll_option`                                                             | Trusting the request                                                           |
| Vote vs close          | The vote transaction holds `FOR SHARE` on the poll row, closing needs an exclusive lock, so no vote counts after a close | Optimistic check without locking; a grace period                               |
| Voting endpoint        | `PUT /api/quacks/:id/vote`, idempotent; 404 / 400 / 409 for missing poll / foreign answer / closed                       | `POST` that adds votes                                                         |
| Instant feel           | Optimistic cache update, rollback to the server's numbers on error, message with Retry                                   | Waiting for the server; toast only                                             |
| Staying correct        | Refetch on focus plus every 10 s on the feed query, paused while a vote is in flight                                     | Websockets; refresh on focus only                                              |
| Vote visibility        | Anonymous: counts only, never names                                                                                      | Voter lists                                                                    |

## Consequences

- Each feed read groups the votes of all polls on the page. Fine at this scale; add pagination before caching counts if the feed grows.
- The 10-second interval is the only polling in the app and applies to the feed only.
- Percentages are rounded one by one and may add up to 99 or 101. The counts are exact.
- The guarantees live in the database, so they are tested against Postgres (`poll.repository.int.spec.ts`, runs when `DATABASE_URL` is set).
- Polls cannot be edited, deleted or reopened. Adding any of these later means deciding what happens to existing votes.
