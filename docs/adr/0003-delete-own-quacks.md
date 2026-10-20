# 0003: Delete my quacks, see only mine

Status: accepted (2026-10-20)

## Context

Authors want to clean up what they posted and to see just their own quacks. The story is in [story.md](../../story.md).

## Decisions

| Question                  | Decision                                                                                                                | Alternatives rejected                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Who may delete            | Only the author, enforced on the server. Admins get no exception.                                                       | Hiding the button only; an admin override                      |
| How ownership is enforced | One statement, `deleteMany({ id, userId })`. The service looks the quack up only afterwards, to answer 403 or 404.      | Read, compare, then delete (a race between check and delete)   |
| Endpoint                  | `DELETE /api/quacks/:id` → 204; 403 someone else's; 404 missing. The client treats 404 as done.                         | Soft delete; `POST …/delete`                                   |
| Quacks with a poll        | Deletable. Poll, answers and votes go with it through the existing cascading foreign keys. The dialog says so.          | Forbidding it, which would leave polls undeletable forever     |
| Mine tab                  | `GET /api/quacks?author=me`; the server filters, the author comes from the session. Search works inside the active tab. | Hiding other people's rows in the browser; a separate endpoint |
| Tab state                 | `/quacks?tab=mine` in the URL, validated with zod; unknown values fall back to All. Cache key includes the tab.         | Local state, lost on reload                                    |
| Feedback                  | Confirmation dialog, then the feed refetches. Not optimistic: a failed delete would have to put a post back.            | Optimistic removal with rollback                               |

## Consequences

- Deleting is permanent and removes other people's votes on a poll too. There is no undo.
- The "write the first one" prompt shows only when Mine is empty without a search; with a search the usual "No quacks match" message wins.
- The guarantee lives in Postgres, so it is tested in `quack.repository.int.spec.ts` (runs when `DATABASE_URL` is set).
