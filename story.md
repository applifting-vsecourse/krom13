# Story: delete my quacks, see only mine

As an author, I want to delete my own quacks and see only mine, so I can clean up what I posted.

Status: **ready.** All decisions answered. The previous stories (change username, search the feed, polls) are in git history and the ADRs.

## Acceptance criteria

### Deleting

- Each of my quacks has a Delete action. Quacks by other people don't.
- Before deleting, the app asks me to confirm (a dialog with "Delete" and "Cancel"). After deleting, the quack disappears from the feed.
- If the delete fails (network or server error), the quack stays and the dialog shows the error so I can try again.
- Nobody can delete someone else's quack, not even by calling the API directly: the server answers 403. Admins are not an exception.
- A quack that has a poll can be deleted the same way. Its answers and everyone's votes are deleted with it, and the confirmation says so.
- If the quack is already gone (deleted in another tab), the delete counts as done: the dialog closes and the feed refreshes.

### Filter

- Above the feed there are two tabs: All and Mine. Mine shows only my quacks, newest first.
- The selected tab is kept in the URL (`/quacks?tab=mine`), so a reload or a shared link keeps it. No tab in the URL means All.
- The search box works inside the active tab: on Mine it searches only my quacks.
- When I have no quacks, Mine says so and offers to write the first one (the button focuses the quack form).
- Signed-out visitors can't reach the feed, same as today.

## Out of scope

- Editing a quack, undoing a delete, soft delete or a "recently deleted" list.
- Deleting several quacks at once.
- Admins deleting other people's quacks, moderation of any kind.
- Filtering by other people ("Theirs", per-author pages).
- Remembering the tab anywhere except the URL.

## When there's nothing to show

- Mine with no quacks: "You haven't posted any quacks yet." plus a "Write a quack" button.
- Mine with a search that matches nothing: the existing "No quacks match …" message with Clear. The "write the first one" prompt appears only when I have no quacks at all.
- All with no quacks: unchanged ("No quacks yet. Post the first one.").
- Loading and error states are unchanged and apply to both tabs.

## Defaults chosen by the developer (not specified by the product owner)

- Deleting is not optimistic: the quack leaves the feed when the server confirms, because a failure would have to put a post back.
- A successful delete is a permanent removal from the database (hard delete).
- The server returns 204 on success, 403 for someone else's quack, 404 if it doesn't exist.
- The tab list is `GET /api/quacks?author=me`; the server filters, the browser never hides rows.
