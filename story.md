# Story: search the feed

As a reader, I want to type a word or an author's name and see only the posts that match, so I can find a post I saw last week.

## Acceptance criteria

- A search box sits above the feed. The query is not stored in the URL, so a reload resets it.
- The list updates as you type, about 300 ms after the last keystroke. There is no submit button.
- A post matches if it matches the query in one field: its text, the author's display name, or the author's username. Mood is not searched.
- Matching ignores case and works on substrings, so "duck" finds "Duckling". Accents are not ignored.
- With several words, one field must contain all of them. For example, "duck pond" matches only if the text, or the display name, or the username, contains both. A word in the author's name and another in the text does not match.
- The query is trimmed. Anything shorter than 2 characters is ignored and the full feed shows. The maximum is 100 characters, and the server rejects longer queries with a 400.
- `%`, `_` and `\` are treated literally, so "100%" finds posts containing "100%".
- Filtering happens on the server through `GET /api/quacks?q=`. The newest-first order stays.
- If nothing matches, the feed shows "No quacks match '<query>'" and a Clear button. Emptying the box also resets the feed.
- The existing loading, error-with-retry, and refetch-on-focus behavior still applies to searched results.
- On each search the server logs the query length and the result count, not the query text.

## Defaults chosen by the developer (not specified by the product owner)

- A query of 1 character shows the full feed, with no hint.
- The search box has a visible label, per `DESIGN.md`.
- The server logs only searches that pass the 2-character minimum.

## Decisions

See [ADR 0001](docs/adr/0001-feed-search.md).
