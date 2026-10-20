# 0004: Moderator deletes any quack

Status: accepted (2026-10-20)

## Context

Abusive quacks stay up when their author won't delete them. We need someone who can remove any quack. The story is in [story.md](../../story.md). It reverses the "admins get no exception" decision of [0003](0003-delete-own-quacks.md).

## Decisions

| Question           | Decision                                                                                                              | Alternatives rejected                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Who is a moderator | The existing `admin` role, read from the session on every request. Set in the seed or by hand in the database.        | A new `moderator` role and migration; role UI |
| Endpoint           | Same `DELETE /api/quacks/:id` → 204 / 403 / 404. For `admin` the owner check is skipped; 404 stays 404.               | A separate `/moderation` endpoint             |
| Delete statement   | `QuackRepository.deleteQuack(id)` for moderators; `deleteOwnQuack(id, userId)` stays the only path for everyone else. | One method with an optional owner             |
| Trace              | One `Logger` line (moderator, quack, author) when the author is someone else. No table, no author notification.       | Audit-log table; a reason field               |
| UI                 | Delete on every quack for admins; the dialog names the author when it isn't their own quack.                          | Moderator-only view or tab                    |

## Consequences

- Moderation is permanent, like author deletes: hard delete, poll and votes cascade, no undo.
- The log line is the only record. If we need history or a reason, that is a new story with an audit table.
- Anyone given `admin` in the database can now delete all content.
