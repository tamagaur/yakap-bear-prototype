<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Yakap Bear project notes

- Backend is **Rust** (`backend/`, Axum + SQLx + PostgreSQL). Next.js is frontend-only and forwards `/api/*` to it
  (`API_URL`). Do not add Next.js route handlers or an ORM for data access.
- Shared API shapes: `src/lib/contracts` (zod) must stay in sync with `backend/src/dto.rs`; document changes in
  `docs/API.md`.
- Dose rules live in `backend/src/dose_rules.rs`; `src/lib/dose-rules.ts` is only the bear's offline mirror.
- The `/family` app UI is on hold — its API is complete. Ask before building it.
- Verify with `npm run test:api`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run e2e`.
