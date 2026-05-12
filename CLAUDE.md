# CLAUDE.md

## Project Overview

**extra-ielts** — An IELTS learning and testing platform with a desktop app (Tauri), web frontend (React), and serverless API (Cloudflare Workers).

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (neutral theme, Phosphor icons), Motion
- **Backend:** Hono on Cloudflare Workers, D1 (SQLite), Durable Objects (WebSocket chat + presence)
- **Desktop:** Tauri v2
- **Package Manager:** Bun
- **AI Services:** Python Flask apps on Hugging Face Spaces (evaluator + generator, in `ai/`)

## Project Structure

```
server/           → Hono API (Cloudflare Workers)
  routes/         → Route handlers (auth, tests, assignments, writing, vocabulary, admin, groups)
  lib/            → Shared utilities, types, schemas, Durable Object classes
  migrations/     → D1 SQL migrations
  worker.ts       → Worker entry point
src/              → React SPA
  components/     → UI components (shadcn/ui in src/components/ui/)
  pages/          → Page components (Dashboard, Tests, Homework, Settings, Admin, Writing, Vocabulary, Groups)
  hooks/          → Custom React hooks
  lib/            → Client utilities and API helpers
  locales/        → i18n strings
ai/               → Python AI microservices (separate repos)
```

## Commands

```bash
bun dev                    # Start Vite dev server
bun run dev:api            # Start local API server (Bun)
bun run dev:all            # Run frontend + Tauri together
bun run build              # Production build
bun run deploy             # Deploy API to Cloudflare Workers
bun run d1:migrate:local   # Apply D1 migrations locally
bun run d1:migrate:remote  # Apply D1 migrations to production
bunx tsc --noEmit          # Type-check
```

## Code Style

- Write clean, self-documenting code — names should explain intent
- Minimal comments: only use them for non-obvious "why", never for "what"
- No commented-out code
- Keep functions short and focused
- Prefer early returns over nested conditionals

## Conventions

- UI components use shadcn/ui with `@/components/ui/` alias
- Icons from `@phosphor-icons/react`
- Path aliases: `@/components`, `@/lib`, `@/hooks`, `@/pages`
- Dark theme by default (neutral base color, CSS variables)
- API routes are registered in `server/app.ts` under `/api`
- Environment variables for Workers defined in `wrangler.jsonc` vars + secrets
- Migrations are sequential SQL files in `server/migrations/`
- Frontend state uses React hooks (no external state library)
- Animations via `motion/react` and `animate-ui`
- All user-facing strings must live in `src/locales/en.ts` — never hardcode text in components

## Error Handling

- **Client:** Wrap async calls in `try/catch`, show errors via `toast.error()` from sonner
- **Server:** Return `{ error: string }` with appropriate HTTP status codes (400, 401, 403, 404, 500)
- Never swallow errors silently — always surface them to the user or log them
- Use early returns for auth/validation failures before main logic

## Security

- Never commit `.env`, `.dev.vars`, secrets, or API keys
- All API routes require JWT auth except `/auth` and `/health`
- Use prepared statements with `.bind()` for all D1 queries — no string interpolation
- Validate and sanitize all user input with Zod schemas before processing
- WebSocket connections require token verification before upgrade
- CORS is restricted to known origins defined in `wrangler.jsonc`

## What to Avoid

- Don't use `any` — use proper types or `unknown` with narrowing
- Don't add new dependencies without justification
- Don't introduce a state management library (use React hooks + context)
- Don't add abstraction layers that aren't needed yet
- Don't write wrapper functions that just pass through to another function
- Don't use `console.log` for error handling — use proper error responses
- Don't put business logic in components — extract to hooks or utility functions
