# Story: moderators delete any quack

As a moderator, I want to delete any quack, so I can remove abusive posts when their author won't.

Status: **implemented, e2e passing.** All decisions answered. The previous stories (change username, search the feed, polls, delete my quacks) are in git history and the ADRs.

"Moderator" is the existing `admin` role. There is no new role.

## Acceptance criteria

### Deleting as a moderator

- When I'm signed in as a moderator, every quack in the feed has a Delete action, whoever wrote it.
- Before deleting someone else's quack, the app asks me to confirm (a dialog with "Delete" and "Cancel"). The dialog names the author ("Delete @name's quack?") and says that a poll, its answers and everyone's votes are deleted with it.
- After deleting, the quack disappears from the feed.
- If the delete fails (network or server error), the quack stays and the dialog shows the error so I can try again.
- If the quack is already gone (deleted in another tab), the delete counts as done: the dialog closes and the feed refreshes.
- Deleting my own quack works as before, with the same dialog as before.
- The server enforces it: a moderator calling `DELETE /api/quacks/:id` on anyone's quack gets 204.

### Everyone else

- Regular users still see Delete only on their own quacks.
- A regular user calling the API directly on someone else's quack still gets 403.
- A moderator who loses the role (changed in the database) is treated as a regular user on the next request. The server reads the role from the session, never from the browser.

### Trace

- Each delete done by a moderator on someone else's quack writes one line to the server log: who (moderator id), what (quack id), whose (author id), when. Deleting your own quack writes no such line.

### Getting the role

- The seeded `superadmin` user is a moderator (already the case). Nobody else is, unless their `role` is set to `admin` in the database.

## Out of scope

- A role-management screen, promoting or demoting users in the app.
- A new `moderator` role or migration.
- An audit-log table, a moderation history page, or any UI for the log line.
- A reason for deleting, notifying the author, soft delete or undo.
- Banning or suspending users, editing quacks, deleting several quacks at once.
- Moderator-only tabs, filters or views (the All and Mine tabs behave the same for moderators).

## When there's nothing to show

- No quacks: unchanged ("No quacks yet. Post the first one.").
- Mine with no quacks, search with no match, loading and error states: unchanged.
- A moderator on a feed that holds only their own quacks sees the same Delete actions as any author.

## Defaults chosen by the developer (not specified by the product owner)

- Same endpoint and status codes as today (`DELETE /api/quacks/:id` → 204, 403, 404). A regular user still gets 403 for someone else's quack; for a moderator the "not the owner" check is skipped, 404 stays 404.
- Hard delete, as for authors; the poll goes with the quack through the existing cascading foreign keys.
- The browser learns the role from the session it already has, only to show or hide the button.
- The log line is an ordinary Nest `Logger` entry at info level.
- This reverses the earlier rule "Admins are not an exception": ADR 0003, the Swagger description and the `CLAUDE.md` ownership rule are updated in the same change.
- The existing e2e delete test is extended with a moderator case, using the seeded superadmin.
