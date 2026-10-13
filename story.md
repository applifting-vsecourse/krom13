# Story: polls in quacks

As a person who asks the group a question in a quack ("where do we go for lunch?"), I want to attach a few answers to it that everyone else can pick from, so nobody has to count replies by hand and the question doesn't get buried.

Status: **ready.** All decisions answered. The previous stories (change username, search the feed) are in git history and the ADRs.

## Acceptance criteria

### Asking

- In the quack form an "Add poll" toggle reveals answer fields. The quack text box is the question; mood still works.
- A poll has 2–6 answers, each 1–80 characters after trimming. It starts with 2 empty fields; "Add answer" adds one up to 6, and each field beyond the second can be removed.
- An empty answer, or two answers that match when ignoring case and surrounding spaces, are rejected with a message under the field. The server rejects them too (400).
- A poll shows up in the same feed as other quacks, newest first. Search finds it by its question text, not by its answers.
- Turning "Add poll" off before posting posts a normal quack.
- Once posted, a poll's question and answers cannot be edited.

### Voting

- Every signed-in person, including the author, can pick one answer on someone's poll. Choosing it highlights it and updates the numbers on screen immediately, before the server has answered.
- One person, one vote: a second vote by the same person never adds a count; it moves their vote.
- Choosing a different answer moves my vote: the old answer goes down by one, the new one goes up by one. Choosing the answer I already picked changes nothing. There is no way to remove a vote.
- If a vote doesn't go through (network or server error), the numbers and highlight return to what the server last said, and "Your vote didn't go through." appears under that poll with a Retry button. Retry sends the same choice again; the message disappears on success.
- Votes are anonymous: only counts are shown, never names.

### Results

- Everyone sees the results all the time, also before voting: for each answer its count, its percentage of all votes (rounded to a whole number) and a bar proportional to it, plus the total ("12 votes", "1 vote"). My answer is highlighted and also marked in text ("Your vote"), not by colour alone.
- Counts come from the server's votes, never from a tally kept in the browser, so every person sees the same numbers.
- Other people's votes appear within about 10 seconds while the feed is open, and straight away when the tab regains focus.

### Closing

- The author of a poll sees a "Close poll" button on it; nobody else does. It asks for confirmation first.
- Closing is permanent. A closed poll is labelled "Closed", shows its final counts and everyone's choice highlight, and cannot be voted on or changed.
- If a poll is closed while someone is about to vote, the vote is not counted: the poll switches to closed with the final numbers and says "This poll closed before your vote."
- Only the author can close it; anyone else gets a 403 from the server.

## Out of scope

- Editing a poll, deleting a poll, reopening a closed poll, taking a vote back without choosing another answer.
- Multiple choices per person, free-text answers, voter names, vote deadlines, notifications.
- Searching answer text, filtering the feed to polls only.
- Live push updates (websockets); the 10-second refresh is enough.

## When there's nothing to show

- A poll with no votes shows every answer at "0 (0%)" with empty bars and "No votes yet".
- A closed poll with no votes shows the same, labelled "Closed".
- The feed's existing empty, loading and error states are unchanged.

## Defaults chosen by the developer (not specified by the product owner)

- Percentages are rounded independently, so they can add up to 99% or 101%. The counts are exact.
- The "Close poll" confirmation is a dialog with "Close poll" and "Cancel".
- Answers appear in the order the author wrote them, not sorted by votes, so rows don't jump while people vote.
- Quacks with a poll keep working as quacks: text 1–280 characters, optional mood.
- Seeding adds one open and one closed poll with a few votes so the feature is visible in development.

## Decisions

See [plan.md](plan.md) for the data model, endpoints and build order.
