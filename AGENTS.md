# AGENTS.md - rules for anyone (human or AI) changing this repo

Support Desk = a multi-tenant helpdesk API. Many businesses (organizations) share one app and one database;
each must only ever see its own data. This file holds the rules that keep that true.
When a bug or mistake teaches us something, add it to "Lessons learned" at the bottom (the "ratchet": every mistake becomes a rule).

## Stack and commands (run inside apps/api)
- Node + TypeScript (strict) + Express 5, PostgreSQL via Prisma 7, Socket.IO (real-time), BullMQ + Redis (background jobs)
- `npm run dev` start the API | `npm run worker` start the job worker (needs REDIS_URL) | `npm run build` compile to dist/
- `npm test` run all tests | `npm run test:watch` re-run on save | `npm run typecheck` type-check source AND tests
- Web app (inside apps/web): `npm run dev` (http://localhost:5173, proxies /api and /socket.io to the API) | `npm test` | `npm run build`
- Tests need a SEPARATE database whose name contains "test" (set `TEST_DATABASE_URL` in .env). They empty it on every run and refuse any other database.
- `npx prisma migrate deploy` apply migrations | `npx prisma generate` rebuild the client (the generated client in `src/generated` IS committed, so commit it after schema changes)
- Before saying a change is done: `npm run typecheck` and `npm test` must pass. New behavior needs tests (see rules 11-12).

## Architecture rules (never break these)
1. **Tenant isolation.** Every query on tenant data filters by `organizationId`. Look up by id with `findFirst({ where: { id, organizationId } })`, never `findUnique({ id })` alone.
2. **Never trust the client for identity or tenancy.** `userId` comes from the verified token (`res.locals.userId`), the business comes from the URL and is verified by `requireMembership`, the role comes from the database. Never read these from the request body. AI tools will receive `organizationId` from our server code, never from the model.
3. **Status codes mean something.** 401 = not logged in. 404 = not a member OR does not exist (identical answers, so strangers learn nothing). 403 = member, but role too low. 409 = valid request that clashes with current state. 400 = bad input.
4. **Layering.** routes (URLs + guards) -> controller (validate with zod, map results to HTTP) -> service (business logic + database). Services return `{ ok: false, reason }` for expected failures; controllers turn those into status codes.
5. **Roles live on `Membership`** (per business), not on `User`. Protect routes with `requireRole(...)`.
6. **Side effects happen only after the database write succeeds** (real-time emit, enqueue). A failing side effect must never fail the user's request (enqueue helpers catch and log).
7. **Ticket status changes** go through `ALLOWED_TRANSITIONS` and a compare-and-swap update. CLOSED is final.
8. **Never return whole rows.** Use `select`. Never return `passwordHash`.
9. **Migrations must be safe on existing data:** add columns as nullable, backfill, then make required.
10. **Jobs carry ids only** and re-read fresh data from the database; handlers must be safe to run twice (idempotent).

11. **Configuration lives in `src/config/env.ts` only.** Never read `process.env` anywhere else; add new settings to that schema (with validation and a default).
12. **Every new endpoint ships with integration tests** (tests/integration), including: the happy path, invalid input (400), no token (401), and the STRANGER test (a member of another business gets 404). Tests create their own unique data (see tests/helpers.ts) and never touch the dev database.
13. **Errors are JSON.** Unknown routes and thrown errors go through `middleware/errorHandler.ts`; never send stack traces or internal messages to clients.
14. **Auth endpoints are rate limited** (`middleware/rateLimit.ts`). Any new login-like or sign-up-like endpoint must be too.

15. **The server is the source of truth in the UI.** Never copy business rules (allowed status moves, permissions) into the frontend. The API sends what is allowed (for example `allowedNext`); the UI may hide what a role cannot do, but the server always enforces it.
16. **All server calls go through `apps/web/src/lib/api.ts`** (token, error handling, 401 logout in one place). Shared data shapes live in `lib/types.ts`. Server data is read with React Query (`useQuery`) and changed with `useMutation`; never keep server data in plain component state.
17. **Every new screen ships with component tests** using the fake-`fetch` helpers in `src/test/utils.tsx`, including what each ROLE sees and what happens when the server refuses.

## Style (this project is also a learning project)
- Comment every line of code, and explain jargon in the comments (what a term means, not just what the line does).
- Strict TypeScript: `exactOptionalPropertyTypes` is on, so optional parameters are written `x?: T | undefined`.
- Every step ships a `docs/<topic>-qa.md` with: files in order, code flow diagram, design choices WITH the alternatives, and viva Q&A.

## Planned AI rules (for the upcoming AI assistant; see docs when added)
- Customer text is untrusted data, never instructions (prompt-injection defense).
- AI starts read-only and drafts replies for a human to approve; writes need approval.
- Every AI run is logged (input, tools, output, latency, tokens). Drafts must cite a knowledge-base source or hand off to a human.

## Lessons learned (add new ones here)
- The browser talks only to the Vite dev server, which proxies `/api` and `/socket.io` to the API. One address means no CORS configuration in development and no API URL hard-coded in the frontend. In production, serve the web build and the API from the same domain (or add CORS deliberately).
- A test that cannot fail is worthless: after writing tests for a rule, break the rule on purpose (e.g. remove a tenant filter) and confirm a test goes red, then restore it.
- `dotenv` never overwrites a variable that already exists, even an empty one. Tests switch optional features off with empty values (`REDIS_URL=""`) so the developer's `.env` cannot leak in.
- tsconfig originally had no `outDir`/`rootDir`, so `npm run build` did not produce the `dist/` that `npm start` expects. Build output goes to `dist/`; tests are type-checked through `tsconfig.test.json`.
- Express's default error page is HTML; always register `notFoundHandler` and `errorHandler` last.
- BullMQ 6 does not install its Redis client: add `ioredis` to dependencies yourself.
- Our tsconfig is strict about optional properties; passing `string | undefined` to `x?: string` fails, so declare `x?: string | undefined`.
- The API process and the worker are separate processes: the worker cannot call `emitToOrg` (Socket.IO lives in the API process). Cross-process real-time needs the Redis adapter (planned).
