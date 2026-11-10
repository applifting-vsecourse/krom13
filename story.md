# Story: reply to a quack

As a person who reads the feed, I want to reply to a quack and see the replies under it, so a conversation shows what each answer is answering instead of loose "@name …" quacks.

Status: **implemented; migration and integration tests not yet run against a database.** All decisions answered (see Decisions). The previous story (moderators delete any quack) is in git history and [ADR 0004](docs/adr/0004-moderator-deletes-any-quack.md).

Two promises pull against each other, and the design exists to hold both:

1. **Replies belong to the people who wrote them.** Deleting a quack never deletes someone else's reply.
2. **A deleted quack really disappears.** Its text, mood, poll, votes and author are gone from the database, not hidden.

## Acceptance criteria

### Reading replies

- Each top-level quack in the feed shows its number of replies ("3 replies", "1 reply", and nothing, or "Reply", when there are none).
- Clicking it opens the thread page `/quacks/<id>`: the quack on top, its replies below, oldest first, then the reply form.
- Replies are grouped into conversations, like YouTube comments: each direct reply to the quack is a head, and every answer to it (or to an answer) sits indented under it behind a thin line, oldest first, one level deep. An answer carries the label "in reply to @name". A conversation with answers has a "Hide N replies" / "Show N replies" toggle, open by default.
- The feed (All, Mine, search) lists only top-level quacks. Replies never appear as feed items, and Mine does not include my replies.
- The thread page survives a reload and can be shared as a link.

### Writing a reply

- On the thread page I can post a reply: text (same limits as a quack) and an optional mood (same emoji toggle group). A reply cannot have a poll; the poll fields are not shown and the API rejects one with 400.
- Every reply has a "Reply" action. Using it posts a reply that is labelled "in reply to @name" of that reply's author. It still sits flat under the top-level quack.
- When I use a reply's "Reply" action, the reply box opens directly under that reply (above the next reply, and above its own answers), says "Replying to @name" and has the cursor in it. Cancel puts the box back at the bottom, where it answers the top-level quack.
- After posting, my reply shows at the bottom of the thread and the count in the feed goes up by one, without a manual reload.
- I cannot reply to a deleted quack or reply: the form and the "Reply" action are not offered for it, and the API answers 404 / 409 (see Decisions).
- If posting fails, the text I typed stays in the form and the error is shown next to it.

### Deleting

- Who may delete a reply: its author or an admin, with the same dialog and the same 204 / 403 / 404 as for a quack.
- **A quack or reply with no replies** is deleted for real, as today (poll, options and votes with it).
- **A quack or reply that has replies** is emptied: its text, mood, poll (with options and votes) and author are erased from the database and the row is marked deleted. Its replies stay, in place, under a placeholder "This quack was deleted".
- The delete dialog says so when replies exist: "N replies stay under a deleted-quack placeholder."
- A reply labelled "in reply to @name" whose target was deleted shows "in reply to a deleted quack". The name is not shown.
- When the last reply under an emptied quack is deleted, the emptied row is removed as well, and so on up the chain. Nothing of a deleted quack outlives its replies.
- An emptied quack no longer appears in the feed, in search or in Mine, and its author's count of "my quacks" drops. Its thread page still opens from a link and shows the placeholder and the surviving replies.
- A delete done by a moderator on someone else's quack behaves identically, and still writes the log line (moderator, quack, author).
- Deleting twice, or from two tabs: the second call is "already gone" (404 treated as done in the UI), as today.

### Counts

- The reply count is counted from the stored rows on every read and counts only live replies (not emptied ones). Every viewer sees the same number.

## Out of scope

- Notifications when someone replies; mentions: `@name` typed in text stays plain text, with no parsing or links.
- Editing a reply or a quack; reactions; polls on replies.
- Pagination of replies (the thread page loads all of them).
- A "my replies" page. A reply under a deleted top-level quack is reachable only by its link (known consequence, see Decisions).
- Converting existing "@name …" quacks into replies.
- Deleting a user account (no such feature exists; see Decisions for what the database does if it ever did).
- Moving replies, nesting beyond the flat thread.

## When there's nothing to show

- A quack with no replies: the thread page shows "No replies yet. Be the first." above the form; the feed shows no count.
- A thread whose top-level quack was deleted but which has replies: placeholder plus replies, no form.
- A thread id that does not exist, or whose rows were all removed: "This quack doesn't exist" with a link back to the feed (404 from the API).
- Loading and error states of the feed and of the thread page follow the existing patterns.

## Decisions

Each decision with the option we rejected and why.

| #   | Question                                  | Decision                                                                                                                                                                                                                                                                                          | Rejected, and why                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Thread depth                              | Two levels, YouTube style: replies can target replies, but are grouped under the direct reply they descend from (indented, one level deep, with a hide/show toggle) and carry "in reply to @name". The grouping is computed in the browser from `parentId`; the data model and API are unchanged. | _One level_: a back-and-forth between two people is unreadable, the `@name` habit returns. _Unlimited tree_: recursive reads, deep indentation, and deleting a middle node gets hard; shrinking later throws data away.                                                                                                                                                               |
| 2   | What survives a delete                    | **Tombstone.** A quack with replies is emptied in place, one self-relation `parentId`. Without replies it is hard-deleted as today.                                                                                                                                                               | _Hard delete with `parentId` SET NULL_: replies lose their thread, siblings are no longer grouped, and the link cannot be recovered later. _Separate `Thread` table_: extra table, extra join, two writes that must stay in step, and a reply-to-a-reply still loses its target.                                                                                                      |
| 3   | Is the author kept on the emptied row?    | No. `userId` becomes nullable and is set to NULL.                                                                                                                                                                                                                                                 | _Keep the author, show "Deleted by @name"_: it is leftover data about a deleted quack, leaks a name into the labels of replies, and ties the tombstone to the user's cascade.                                                                                                                                                                                                         |
| 4   | Where replies show                        | Only under their quack (thread page); the feed lists top-level quacks with a count.                                                                                                                                                                                                               | _Replies also in the feed_: context-less one-liners flood the feed and change what "All" means for existing users.                                                                                                                                                                                                                                                                    |
| 5   | Reply content                             | Text and optional mood. No poll.                                                                                                                                                                                                                                                                  | _Text only_: needlessly poorer than a quack. _Everything a quack has_: a poll on every reply costs a join on every thread read, and polls can never be taken out again once people have made them.                                                                                                                                                                                    |
| 6   | Emptied row whose replies are all deleted | Removed in the same transaction as the last reply, walking up the chain.                                                                                                                                                                                                                          | _Keep forever_: dead rows pile up that every feed query must filter, and a deleted quack would outlive its thread.                                                                                                                                                                                                                                                                    |
| 7   | Where replies are read and written        | A thread page `/quacks/$quackId`; reply count on feed items.                                                                                                                                                                                                                                      | _Inline expansion in the feed_: long jumpy feed, no URL per conversation, state lost on reload.                                                                                                                                                                                                                                                                                       |
| 8   | Defaults accepted                         | Replies are deleted by author or admin; oldest first; no pagination; same limits as a quack; existing "@name" quacks untouched.                                                                                                                                                                   | —                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | Tombstones in the feed?                   | No: an emptied top-level quack is not a feed item. Its replies are reached by link. Confirmed by the product owner.                                                                                                                                                                               | _Delete the replies together with a top-level quack_ (suggested, then withdrawn): breaks promise 1, replies belong to their authors. _Show a "deleted" placeholder in the feed_: a feed full of "This quack was deleted" rows; deleting would then not make anything disappear from the feed, which is what people expect from delete. Cheap to flip later: it is one `WHERE` clause. |
| 10  | Parent foreign keys                       | `onDelete: Restrict` on `parentId` and `rootId`. Account deletion stays out of scope; the product owner confirmed leaving it as is for now.                                                                                                                                                       | _SET NULL_: would silently turn replies into top-level quacks in the feed. _Cascade_: breaks promise 1. With Restrict the database refuses any delete that would orphan a reply; the delete service empties the row instead.                                                                                                                                                          |
| 11  | `rootId` stored beside `parentId`         | Stored, set once when the reply is created, never changed.                                                                                                                                                                                                                                        | _Walk `parentId` upwards (recursive CTE) on every thread read_: slower and more complex for the one query this feature exists for. _Composite foreign key `(parentId, rootId) → (id, rootId)` to make the database check it_: needs `rootId = id` on every top-level row and a backfill.                                                                                              |
| 12  | `text` on an emptied row                  | Stays `NOT NULL`, stored as `''`.                                                                                                                                                                                                                                                                 | _Nullable `text`_: every place that reads a quack would have to handle null for a case that only exists for emptied rows. A CHECK keeps `''` honest instead.                                                                                                                                                                                                                          |

## Where it lands in the code

- **Module:** `apps/backend/src/modules/quack` (no new module; a reply is a quack). Touches `quack.repository.ts` (feed filter `parentId IS NULL AND deletedAt IS NULL`, reply counts, thread read, delete-or-empty transaction), `quacks.service.ts`, `quacks.controller.ts` and DTOs, and the `Quack` domain type (`userId` can be null, `parentId`, `deletedAt`).
- **New endpoints:** `GET /api/quacks/:id` (thread: quack plus replies), `POST /api/quacks/:id/replies`. `DELETE /api/quacks/:id` keeps its shape and codes; its behaviour becomes delete-or-empty. `GET /api/quacks` gains `replyCount` per item.
- **Existing features touched:** feed list and search (filter), Mine (top-level only), delete own and moderator delete (both go through the one delete-or-empty path; `deleteOwnQuack`'s "owner in the statement" rule stays), polls (erased when a quack is emptied; not allowed on replies), moods (reused).
- **Frontend:** `features/quack` gets the thread route, reply form (reusing the mood toggle group), reply count on `QuackItem`, and reply delete. Features still don't import each other.
- **Docs to update in the implementation change:** a new ADR 0005, the Swagger description of `DELETE`, and the CLAUDE.md delete rule (already added).

## Proposed schema

Only `Quack` changes. `Poll`, `PollOption`, `PollVote`, `User` and the enums are untouched.

```prisma
model Quack {
  id        String    @id @default(cuid())
  text      String    @db.Text            // '' when deleted
  mood      Mood?
  user      User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String?                       // was required; NULL when deleted
  poll      Poll?

  parent    Quack?    @relation("Replies", fields: [parentId], references: [id], onDelete: Restrict)
  parentId  String?                       // what this answers; NULL for a top-level quack
  replies   Quack[]   @relation("Replies")
  root      Quack?    @relation("Thread", fields: [rootId], references: [id], onDelete: Restrict)
  rootId    String?                       // the top-level quack of the thread; NULL for a top-level quack
  thread    Quack[]   @relation("Thread")

  deletedAt DateTime?                     // set when emptied, row kept because replies remain
  createdAt DateTime  @default(now())
  updatedAt DateTime  @default(now()) @updatedAt

  @@index([userId])
  @@index([parentId])
  @@index([rootId, createdAt])
  @@map("quack")
}
```

Two constraints Prisma cannot express go into the migration as raw SQL:

```sql
-- A row is either live (has an author) or hollow (nothing of the quack is left).
ALTER TABLE quack ADD CONSTRAINT quack_live_or_hollow CHECK (
  ("deletedAt" IS NULL AND "userId" IS NOT NULL)
  OR ("deletedAt" IS NOT NULL AND "userId" IS NULL AND "text" = '' AND "mood" IS NULL)
);
-- A reply has both links, a top-level quack has neither.
ALTER TABLE quack ADD CONSTRAINT quack_reply_links CHECK (("parentId" IS NULL) = ("rootId" IS NULL));
```

The schema was checked with `prisma validate` on a scratch copy. `schema.prisma` itself is not changed yet.

### 1. Can everything the user sees be read with simple queries?

Yes. Four reads and no recursion:

1. **Feed:** `quack.findMany({ where: { parentId: null, deletedAt: null, userId?, search… }, include: user + poll })`. Same as today plus two conditions.
2. **Reply counts for the page:** one `quack.groupBy({ by: ['rootId'], where: { rootId: { in: ids }, deletedAt: null }, _count })`. Same pattern as `attachPolls`; nothing is stored.
3. **Thread page:** the root by id, then `quack.findMany({ where: { rootId: id }, include: user, orderBy: createdAt asc })`. Index `(rootId, createdAt)` covers it. The "in reply to @name" label is resolved in memory from the same result (the target is in the same thread; if its `userId` is null the label is "a deleted quack"). No extra join.
4. **Is a reply allowed / does a quack have replies:** `quack.findUnique({ id })` for `deletedAt`, and `quack.count({ where: { parentId: id } })` using the `parentId` index.

### 2. Is anything stored twice?

`rootId` duplicates what the `parentId` chain already says. It is stored so a thread is one indexed query instead of a recursive one. It is set exactly once, on insert, as `parent.rootId ?? parent.id`, and nothing ever changes `parentId` or `rootId` afterwards (no editing, no moving), so it cannot drift. The CHECK `quack_reply_links` keeps the pair consistent; the rest is covered by an integration test (a reply's `rootId` equals its parent's `rootId`, or the parent's id). The reply count is **not** stored; it is counted on every read.

### 3. What happens to related rows when a quack is deleted?

One transaction, with the quack row locked (`SELECT … FOR UPDATE`), so a reply arriving at the same moment either lands first (and the quack is emptied) or fails the foreign key:

| Case                                                      | Result                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No replies                                                | Row hard-deleted. Poll, options, votes cascade, as today.                                                                                                                                    |
| Has replies                                               | The poll is deleted (options and votes cascade). The row keeps its id and links and gets `text = ''`, `mood = NULL`, `userId = NULL`, `deletedAt = now`. Replies are untouched.              |
| The deleted row was a reply, its target is an emptied row | After the delete, if the emptied target has no other children, it is removed too; repeat up the chain. A chain ends at the top-level quack.                                                  |
| The deleted row was a reply, its target is live           | Nothing else changes.                                                                                                                                                                        |
| User account deleted (no such feature today)              | `userId` cascade would try to delete the user's live quacks; `Restrict` on the reply links makes the database refuse if others replied. Loud failure instead of silent loss; a future story. |

The moderator delete takes the same path; the owner check stays in the statement for authors.

### 4. Will the migration run on a production database that already has data?

Yes. Every change is additive or relaxing:

- `userId` loses `NOT NULL` (instant, no rewrite).
- `parentId`, `rootId`, `deletedAt` are added as nullable columns with no default (instant in Postgres, no table rewrite). Existing quacks become top-level, live quacks, which is correct.
- Both CHECK constraints are satisfied by every existing row (`deletedAt` NULL with `userId` set; both links NULL). They are added `NOT VALID` and then `VALIDATE CONSTRAINT`, so the table is not locked for a full scan.
- The three indexes lock writes to `quack` while building. Fine at this size; at larger sizes create them with `CREATE INDEX CONCURRENTLY` by hand.
- No backfill, no data conversion, and old app code keeps working with the new columns (it just ignores them), so the migration can ship before the code.
- Not reversible without loss once a reply or emptied row exists; `userId NOT NULL` can't be restored with emptied rows present.

The code (not the migration) is the risky part: everything that reads `quack.userId` must handle null, and the rule "the feed filters `deletedAt IS NULL`" must be applied in every query. The integration tests (`quack.repository.int.spec.ts`) must prove: delete-or-empty for each case in the table above, the cleanup walk, that no text/mood/poll/author remains on an emptied row, and that the feed, search and counts leave emptied rows out.
