# 0006: CI test layers and "tests only grow"

Status: accepted (2026-11-24)

## Context

CI had one job (`verify`: format, lint, type-check, unit tests, build). Unit tests mock the database and the HTTP layer, so they can't prove "signed out gets 401" or that the app works in a browser.

## Decisions

| Question             | Decision                                                                                                                                                                                                                                                                               | Alternatives rejected                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Integration tests    | `*.int-spec.ts` under `apps/backend/src`, run by `pnpm backend test:int` (own `jest.int.config.js`). supertest sends real HTTP to the Nest app, built with the same `configureApp()` as `main.ts`.                                                                                     | Starting a second server process; mocking auth |
| Database             | A separate `quacker_test` database (same Docker Postgres locally, a service container in CI). Created if missing and migrated with `prisma migrate deploy` in Jest's global setup; every test starts from truncated tables. The setup refuses any database name not ending in `_test`. | Reusing the dev database; `prisma db push`     |
| Signed-in user       | Sign up and sign in through the real `/api/auth/*` endpoints; the supertest agent keeps the cookie.                                                                                                                                                                                    | Forging a session row                          |
| ESM packages in Jest | better-auth is ESM-only, so the integration config compiles plain JS with swc and runs with `--experimental-vm-modules`. Unit tests are untouched.                                                                                                                                     | Switching the whole backend to ESM or Vitest   |
| End-to-end tests     | Job `test-e2e` starts Postgres, migrates, seeds, runs backend and frontend, then runs the existing Playwright tests in `apps/frontend/e2e`.                                                                                                                                            | A separate e2e database                        |
| Tests only grow      | Job `test-changes` runs `scripts/check-test-changes.sh`: any removed or rewritten line in a test file fails the job. It is independent of the other jobs and is **not** a required check.                                                                                              | Making it required; a CODEOWNERS rule          |

## Consequences

- The three jobs run beside `verify`; none depends on another. Required checks in the repository settings stay `verify` (and optionally the two test jobs). `test-changes` must stay off that list so a red mark never blocks a merge or the deploy.
- Legitimately removing or rewriting a test turns that PR red. That is intended: say why in the PR and merge anyway.
- New integration tests must not rely on data from the seed; they create what they need after `cleanDatabase()`.
