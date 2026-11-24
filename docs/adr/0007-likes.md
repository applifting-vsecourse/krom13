# 0007: Likes

Status: accepted (2026-11-24)

## Context

People want to show they like a quack without replying. The product owner asked for a like button and a like count on every quack and reply, one like per person, and the option to take it back. The cases are in [cases.md](../../cases.md).

Decisions already made in the story:

- Only signed-in people can like. Anonymous visitors see the count.
- You can like your own quack. Replies get likes too.
- A like is a toggle: one call flips the state.
- An emptied quack ([0005](0005-emptied-quacks-keep-replies.md)) loses its likes and can't be liked.
- Out of scope: who liked, sort or filter by likes, notifications, rate limiting.

The storage shape is baked into the schema, the feed query and every delete path, so it is chosen now. The app already has the same problem solved for polls ([0002](0002-polls.md)): counts come from rows, and "one per person" is a primary key.

## Decision

Likes live in their own table, **one row per person per quack**, and the count is **derived from those rows on every read**.

- New table `quack_like`: `quackId`, `userId`, `createdAt`. Primary key `(quackId, userId)`, index on `userId`. Foreign keys to `quack` and `user` with `onDelete: Cascade`, so a hard-deleted quack or user takes its likes along.
- No counter column on `quack`. The feed query returns `likeCount` (rows per quack) and `likedByMe` (a row for the viewer, always `false` when signed out) for every quack and reply on the page.
- **Toggle** is one transaction: take `FOR SHARE` on the quack row and check `deletedAt IS NULL` (404 if not), delete the viewer's row; if nothing was deleted, insert it. The response is `{ liked, likeCount }`, counted after the write. Two simultaneous toggles from one person can't produce two rows, because the primary key refuses it.
- **Emptying** a quack ([0005](0005-emptied-quacks-keep-replies.md)) deletes its like rows in the same transaction as the other erase steps. The `FOR SHARE` lock in the toggle conflicts with that update, so a like can't slip in after the erase.
- `POST /api/quacks/:id/like` toggles. It is the same endpoint for quacks and replies, requires a session (401 otherwise) and returns 404 for an unknown or emptied quack.
- The UI is optimistic with rollback and a Retry next to the button, and ignores clicks on a button while its request is in flight (the toggle makes a double-click undo itself otherwise).

## Options considered

| Option                                       | Why / why not                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Like table, count derived (chosen)**       | Same pattern as `poll_vote`. The count can't drift and every viewer sees the same number. The database enforces one like per person. Costs a grouped count on each feed read, fine at this scale.                                                                                                                                                                    |
| Like table plus `likeCount` on `quack`       | Reads are a plain column, and a future "most liked" sort would be cheap. But two writes must stay in step, and a bug, manual SQL or a user-deletion cascade (which can't update the counter without a trigger) makes the number lie. It breaks the [CLAUDE.md](../../CLAUDE.md) rule that totals are derived on the server. Can be added later if the feed needs it. |
| Counter column only                          | Smallest change, but it can't know who liked. "Once per person", taking a like back and `likedByMe` are impossible. Fails the story itself.                                                                                                                                                                                                                          |
| Array of user ids on `quack` (`likedBy[]`)   | No foreign keys, so a deleted user stays in every array. Every toggle rewrites and locks the whole quack row. The array is unbounded. The database can't count or index it well.                                                                                                                                                                                     |
| Separate idempotent `PUT` and `DELETE` calls | Safer against retries and double-clicks. Rejected by the product owner in favour of one toggle call; the UI guard above covers the double-click.                                                                                                                                                                                                                     |

## Consequences

- **Every read of quacks must also return `likeCount` and `likedByMe`.** The feed, search, Mine and reply lists all go through one query shape, so a new list (profile pages, exports) must include them too.
- **New erase step.** The emptying code and its test must delete likes. Hard deletes get it from the cascade, but the migration for `quack_like` is the only place that relies on it, so the integration test must prove both paths leave no like rows.
- **Feed cost.** Each page groups the likes of its quacks. Fine at this scale; if the feed grows, paginate first and only then consider a counter ([option 2](#options-considered)) — adding one later is additive.
- **Toggle is not idempotent.** A retried request or a stale second tab flips the state back. The UI blocks double-clicks on a button while a request is in flight; the server can't tell a retry from a deliberate second click.
- **Likes are anonymous in the API.** Only the count and the viewer's own state are returned, never names. A "who liked" list would be a new story but needs no schema change: the rows already hold it.
- **Deleting a user** removes their likes (and lowers the counts) through the cascade.
- **The migration is additive**: one new table, no change to existing rows.
- **Tests.** The guarantees live in Postgres, so a `quack-like.repository.int.spec.ts` proves the primary key, the concurrent toggle and the erase on emptying; API behaviour goes in an `*.int-spec.ts` ([0006](0006-ci-test-layers.md)).
