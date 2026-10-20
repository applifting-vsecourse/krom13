# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm frontend e2e` — Playwright tests in `apps/frontend/e2e/` against the running app (frontend :3050, backend :4050, seeded users); not part of `check-all`
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

### Optional single-choice pickers are emoji toggle groups

A short, optional choice (like a quack's mood) is a `ToggleGroup type="single"` of emoji buttons, not a `Select`. Clicking the selected item clears it, so "no value" needs no empty option. Each item gets an `aria-label`, and the emoji map lives next to the zod schema (`MOOD_EMOJI`).

### Record app-wide rules here

When you hit a rule that applies across the app (not just to the feature at hand), add it to this file in the same change. Rules about how screens look go in [`DESIGN.md`](DESIGN.md) instead.

### Clearable form fields hold `null`, never `undefined`

react-hook-form turns an `undefined` value back into the field's default. Clearing a field that has a default (like the mood picker with a default mood) would silently re-select the default. Store `null` for "nothing chosen" in the form (`schema.nullable()`), and convert to `undefined` only when building the request.

### Features don't import each other

Shared constants and schemas (like `MOODS` and `moodSchema` in `src/lib/moods.ts`) live in `src/lib/`. A route may combine features and pass data down as props. ESLint enforces this.

### Counts and totals are derived on the server

Never keep a running tally in the browser or in a counter column. Count from the stored rows on every read so every viewer sees the same numbers. Rules like "one per person" belong in the database (primary key or unique constraint), not only in the service.

### Instant actions are optimistic with rollback

For actions that should feel instant (like voting): update the TanStack Query cache in `onMutate`, restore the snapshot in `onError`, invalidate in `onSettled`, and show the failure next to the thing that failed with a Retry. Pause any polling while the mutation is in flight.

### Ownership is checked in the write itself

"Only the author can change X" is enforced on the server by putting the owner in the statement (`deleteMany({ where: { id, userId } })`), not by reading the row, comparing, then writing. Look the row up afterwards only to tell 403 from 404. Hiding a button is never the rule.

The one exception is moderation: the `admin` role (read from the session on the server, never from the client) may delete any quack, and each such delete is logged (moderator, quack, author). See [ADR 0004](docs/adr/0004-moderator-deletes-any-quack.md). Don't add other admin overrides without a story.

### Filtering happens on the server

A feed filter (like Mine) is a query parameter the server applies, and it is part of the TanStack Query key. Never fetch everything and hide rows in the browser. Filter state that a person would want to keep on reload or share lives in the URL as a validated search param.

### Database changes need an integration test

When a guarantee lives in Postgres (locks, constraints), mocks can't prove it. Add a `*.int.spec.ts` that runs when `DATABASE_URL` is set (see `poll.repository.int.spec.ts`).

### User stories

When working on a user story, write it up in `story.md` and ask questions until it is ready. A story is ready when:

- it says **who** wants it, **what** they get and **why**
- every acceptance criterion can be **checked in the browser**, yes or no
- it says **what's out of scope**
- it covers what happens when **there's nothing to show**
- the agent has **no open questions left**

Don't start implementing a story until all five hold.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it. Don't start a second instance, don't restart it, don't run `pnpm dev`.

Don't reach for the browser to check your own work. Tests and type-checks are the evidence; open the running app when asked to, not on your own initiative.
