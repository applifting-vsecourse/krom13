# Story: change my username

As a user, I want to change my username, so people can find me under a name I actually like.

Status: **ready.** All open questions answered. The search story that was here before is in git history (`a1e3b68`) and ADR 0001.

## Acceptance criteria

### Username

- A new Settings page is reachable from the user menu in the header.
- The username field starts with my current username.
- A username is 3–30 characters: letters, numbers, dots and underscores.
- If someone else already has it, the message appears next to the username field and what I typed stays there.
- After saving I see a confirmation, and my new @username shows everywhere straight away (feed, header/user menu) without a reload.
- I can discard my changes and get back to what is saved.

### Also on the page

- Display name: required.
- Bio: optional, at most 160 characters.
- Both follow the same save and discard rules as the username.
- Default mood for new posts: none, happy, sad, angry or silly. The post form starts with it selected.

## Answers from the product owner

- Username characters: ASCII only (a–z, 0–9, `.`, `_`), case-insensitive. "Duck" and "duck" are the same name; stored lowercase.
- One form with one Save button. Username, display name, bio and default mood save together; one Discard resets all of them.
- An account with no username shows an empty field and must set one to save.
- Display name is at most 50 characters. The default mood only pre-selects the post form; I can still pick another mood per post.

## Confirmed by the product owner

Out of scope:

- Email, password, avatar, deleting the account.
- Rewriting history: old posts show the new name because they point at the user, nothing is copied.
- Reserved or offensive usernames.
- Warning me when I leave the page with unsaved changes.

When there's nothing to show:

- No bio: the field is empty and a counter shows 0/160.
- No default mood: none is selected, and the post form starts with none selected.
- Settings needs a signed-in user, same as the feed.

Behaviour:

- After a failed save (taken name), Discard resets to the last saved values, not to the failed attempt.
- Changing the default mood applies to the post form the next time it renders (e.g. after saving, since the feed is a different page), not to text I'm halfway through typing.
- The username is trimmed; whitespace inside it is invalid.
