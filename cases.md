# Likes — cases

**Story:** As a signed-in person, I want to like a quack (or reply) without replying, so I can show I like it. Each person can like a quack once, and take the like back.

**Decisions**

- Only signed-in people can like. Anonymous visitors see the count.
- You can like your own quack.
- Like is a **toggle**: one call flips the state.
- Replies get likes too, same as quacks.
- Emptied (soft-deleted) quacks lose their likes and can't be liked.
- Count is derived from stored rows on every read; one like per person is a database constraint.
- Instant action: optimistic update, rollback on error, Retry next to the button.

**Out of scope:** list of who liked, sort/filter by likes, notifications to the author, rate limiting.

Names: "Ann" and "Bob" are signed-in users. `likeCount` and `likedByMe` are returned on every quack and reply.

## 1. Rules (unit tests)

Service and component level, repository mocked.

| #   | Given                                    | When                            | Then                                                                                                                               |
| --- | ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Ann hasn't liked quack Q, count 0        | Ann toggles like on Q           | Ann's like is stored; result is liked, count 1                                                                                     |
| R2  | Ann has liked Q, count 1                 | Ann toggles like on Q           | Ann's like is removed; result is not liked, count 0                                                                                |
| R3  | Ann and Bob both liked Q, count 2        | Ann toggles like on Q           | Count is 1; Bob's like is untouched, Bob still sees liked                                                                          |
| R4  | Ann is the author of Q                   | Ann toggles like on Q           | Like is stored, count 1 (own quacks allowed)                                                                                       |
| R5  | R is a reply to Q                        | Ann toggles like on R           | Like is stored on R; Q's count is unchanged                                                                                        |
| R6  | Q was emptied (`deletedAt` set)          | Ann toggles like on Q           | Rejected as not found; nothing stored                                                                                              |
| R7  | Q has 3 likes and replies                | Q is deleted (emptied in place) | Q's likes are erased in the same transaction as the other content                                                                  |
| R8  | Quack id doesn't exist                   | Ann toggles like                | Rejected as not found                                                                                                              |
| R9  | No signed-in user                        | Anyone toggles like             | Rejected as unauthorised; nothing stored                                                                                           |
| R10 | Ann liked Q twice in a row (two toggles) | —                               | Net result: not liked, count 0                                                                                                     |
| R11 | Q has 0 likes                            | Count is shown                  | Shows `0`, not blank                                                                                                               |
| R12 | Ann has liked Q                          | Q is rendered for Ann           | Heart is filled, `aria-pressed="true"`, count shown                                                                                |
| R13 | Ann hasn't liked Q                       | Q is rendered for Ann           | Heart is outline, `aria-pressed="false"`                                                                                           |
| R14 | Visitor is signed out                    | Q is rendered                   | Count is shown, button is disabled                                                                                                 |
| R15 | Ann clicks the heart                     | Request is in flight            | Heart and count flip immediately; further clicks on that button are ignored until it settles (stops double-click undoing the like) |
| R16 | Ann clicks the heart                     | Request fails                   | Heart and count revert; an error and a Retry button appear next to that quack's button; Retry sends the toggle again               |
| R17 | Like request is in flight                | Feed polling fires              | Polling is paused so it can't overwrite the optimistic state                                                                       |
| R18 | Quack is emptied                         | Rendered                        | No like button, no count                                                                                                           |

## 2. API behaviour (integration tests)

`*.int-spec.ts`, real app and `quacker_test` database, sign in with `signIn()`, `cleanDatabase()` in `beforeEach`.

Assumed endpoint: `POST /api/quacks/:id/like` toggles and returns `{ liked, likeCount }`. Replies use the same endpoint (they are quacks). Adjust the path if the design differs.

| #   | Given                                                                 | When                                                        | Then                                                                                                                |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A1  | Ann signed in, Q has 0 likes                                          | `POST /api/quacks/Q/like`                                   | 200, `{ liked: true, likeCount: 1 }`                                                                                |
| A2  | Ann has liked Q                                                       | Same call again                                             | 200, `{ liked: false, likeCount: 0 }`                                                                               |
| A3  | Ann and Bob liked Q                                                   | Ann toggles                                                 | 200, `likeCount` 1; Bob's `GET` shows `likedByMe: true`                                                             |
| A4  | Ann liked Q                                                           | `GET /api/quacks` as Ann                                    | Q has `likeCount: 1`, `likedByMe: true`                                                                             |
| A5  | Ann liked Q                                                           | `GET /api/quacks` as Bob                                    | Q has `likeCount: 1`, `likedByMe: false`                                                                            |
| A6  | Ann liked Q                                                           | `GET /api/quacks` without a session                         | Q has `likeCount: 1` and `likedByMe: false`; request succeeds if the feed is public today                           |
| A7  | No session                                                            | `POST /api/quacks/Q/like`                                   | 401; no like row created                                                                                            |
| A8  | Unknown quack id                                                      | `POST /api/quacks/<unknown>/like`                           | 404                                                                                                                 |
| A9  | Q was emptied (it has replies)                                        | `POST /api/quacks/Q/like`                                   | 404; no like row created                                                                                            |
| A10 | Q has likes and has replies                                           | Author deletes Q                                            | 204; Q is emptied; its like rows are gone; replies keep their own likes                                             |
| A11 | Q has likes and no replies                                            | Author deletes Q                                            | Q and its likes are gone; no error from the foreign key                                                             |
| A12 | Admin moderates (deletes) Q with likes                                | Admin deletes Q                                             | Same as A10/A11                                                                                                     |
| A13 | Ann is the author of Q                                                | Ann toggles like on Q                                       | 200, `likeCount` 1                                                                                                  |
| A14 | R is a reply                                                          | Ann toggles like on R                                       | 200, R's `likeCount` 1; parent's unchanged                                                                          |
| A15 | Ann sends two toggles at the same instant                             | Both land                                                   | No 500: the unique constraint holds, end state is a valid one (liked or not liked) with `likeCount` 0 or 1, never 2 |
| A16 | Ann liked Q                                                           | Count is read from the rows                                 | Count equals the number of like rows; no counter column exists                                                      |
| A17 | Like row for (Q, Ann) exists                                          | Insert a second row for (Q, Ann) directly in the repository | Database rejects it (unique constraint) — `poll`-style `*.int.spec.ts`                                              |
| A18 | Q is a reply to P; P was emptied and then its last reply R is deleted | R's likes are erased with R; P is removed too               | No orphan like rows remain                                                                                          |
| A19 | Feed filtered with Mine                                               | Ann has liked others' quacks                                | Filter is unaffected by likes; every row carries `likeCount` / `likedByMe`                                          |

## 3. End-to-end flows (Playwright)

Seeded users, running app (frontend :3050, backend :4050).

### E1 — Like and take it back (the product owner's examples)

- **Given** Ann is signed in and sees a quack with a like count of 0 and an outline heart
- **When** she clicks the heart
- **Then** the heart is filled and the count shows 1
- **And when** she reloads the page, it still shows filled and 1
- **When** she clicks the heart again
- **Then** the heart is outline and the count shows 0; after a reload it still shows 0

### E2 — Likes are shared between people

- **Given** Ann liked a quack
- **When** Bob signs in and opens the feed
- **Then** Bob sees count 1 and an outline heart
- **When** Bob likes it
- **Then** he sees count 2 and a filled heart; Ann, after reload, sees count 2 and her filled heart

### E3 — Signed-out visitor

- **Given** a visitor who is not signed in
- **When** they view a quack with 2 likes
- **Then** they see the count `2` and a disabled heart; clicking does nothing

### E4 — Replies can be liked

- **Given** a quack with a reply
- **When** Ann likes the reply
- **Then** the reply shows 1 and the parent quack's count is unchanged

### E5 — Failed like rolls back

- **Given** Ann is on the feed and the like request will fail (route intercepted to return 500)
- **When** she clicks the heart
- **Then** the heart returns to outline, the count returns to its old value, and an error with Retry appears next to that quack's heart
- **When** the request is allowed to succeed and she clicks Retry
- **Then** the heart is filled and the count has gone up by one

### E6 — Deleted quack with replies

- **Given** a quack with likes and a reply
- **When** its author deletes it
- **Then** the placeholder shows no heart and no count, and the reply is still there with its own like count
