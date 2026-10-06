# 0001: Feed search

Status: accepted (2026-10-06)

## Context

People can't find a post they saw last week. They usually remember a word from it or who wrote it. The product owner wants a simple search first, to see whether people use it. The full story is in [story.md](../../story.md).

## Decisions

| Question            | Decision                                                                 | Alternatives rejected                                                                              |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Fields searched     | Post text, author display name, author username                          | Mood                                                                                               |
| Matching            | Case-insensitive substring                                               | Whole words only; accent-insensitive (a possible later addition for Czech users)                   |
| Multiple words      | One field must contain all words                                         | Any word; exact phrase; words spread across different fields                                       |
| Where it runs       | Server-side, `?q=` on `GET /api/quacks`                                  | Client-side filtering, which only finds posts already loaded and breaks once the feed is paginated |
| When it runs        | As you type, debounced (about 300 ms)                                    | Submit button                                                                                      |
| Placement and state | Above the feed, not in the URL                                           | URL-persisted `?q=` (shareable, but not wanted for now)                                            |
| Empty result        | Message naming the query, with a Clear button                            | Message only                                                                                       |
| Query limits        | Trimmed, minimum 2 characters, maximum 100 (server returns 400 above it) | No minimum                                                                                         |
| Special characters  | `%`, `_` and `\` are matched literally                                   | Leaving wildcard behavior as is                                                                    |
| Measuring use       | Server logs query length and result count per search                     | No measurement; logging the raw query                                                              |

## Consequences

- The raw query is never stored, which limits what we learn about what people look for, but avoids keeping what they type.
- The substring match is a simple scan and is fine at the current scale. Revisit it with full-text search or an index if the feed grows.
- "No words across fields" can surprise people who remember an author and a word. The behavior is easy to loosen later.
