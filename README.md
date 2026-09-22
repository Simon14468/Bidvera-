# Bidvera

**Verify Before You Bid.**

Multi-tenant tender intelligence SaaS: company workspaces, PDF/Word analysis, deterministic + AI go/no-go decisions, PayPal billing, and an isolated Super Admin console.

## Stack

- Next.js App Router · React · TypeScript · Tailwind CSS
- PostgreSQL · Prisma
- Zod · Server Actions · Route Handlers
- HttpOnly cookie sessions · bcrypt passwords
- DB-backed job queue (`npm run worker`)
- Local object storage (`.data/uploads` — S3/R2-swappable)

Company is the tenant boundary. `companyId` always comes from the authenticated session — never from the client.

## Windows / local setup

Requirements: **Node.js 20+** (22/24 OK), **npm**, and a **PostgreSQL** database (local or Neon).

```powershell
# From the project root
npm install
copy .env.example .env
# Edit .env — set DATABASE_URL and AUTH_SECRET (min 32 chars)

npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional background worker (recommended for production; upload actions also drain a few jobs in-process for local DX):

```powershell
npm run worker
```

### Production build (local smoke test)

```powershell
npm run build
npm run start
```

## Test accounts (after seed)

| Role | Email | Password |
|------|--------|----------|
| Meridian Owner (primary test org) | `owner@meridian-facilities.test` | `MeridianOwner1!` |
| Meridian Admin | `admin@meridian-facilities.test` | `MeridianAdmin1!` |
| Meridian Member | `analyst@meridian-facilities.test` | `MeridianMember1!` |
| Trial sandbox | `trial@bidvera.com` | `BidveraTrial1!` |

Meridian Integrated Facilities Ltd is a **fictional** production-compatible customer org (not a demo mode). Super Admin can change its plan and issue secure password resets.

Super Admin: set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_PATH` in the server env (never commit real values). Seed with `npm run db:seed` or rotate later with `npm run sa:sync`. Path is **not** linked from the public site. No demo Super Admin credentials.

## Core product flow

Signup → verify email (optional) → company profile → plan/trial → upload tender PDF → queue job → extract → match profile → rules + AI → evidence → **BID / REVIEW / NO-BID** → usage/alerts → PayPal upgrade when trial exhausted.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run test:billing` | Billing unit tests |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npx prisma migrate deploy` | Apply migrations (CI/prod) |
| `npm run db:seed` | Seed plans, features, Meridian test org + SA |
| `npm run sa:sync` | Sync Super Admin email/password from env (bcrypt) |
| `npm run worker` | Process async tender jobs |

## Environment variables

Copy `.env.example` → `.env`. **Never commit `.env` or real secrets.**

### Required

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | ≥32 random chars (required in production) |
| `NEXT_PUBLIC_APP_URL` | Public origin, e.g. `https://app.example.com` |

### Strongly recommended

| Variable | Notes |
|----------|--------|
| `SUPER_ADMIN_PATH` | Unguessable path segment (≥12) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Required for seed / `npm run sa:sync`; bcrypt hashed; no demo defaults |
| `npm run sa:sync` | Rotate SA email/password from env without code changes |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_AI_API_KEY` | Tender AI (or configure via Super Admin) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` | Live/sandbox billing |
| `PAYPAL_PLAN_*` | PayPal plan IDs per Bidvera plan |
| `STORAGE_ROOT` | Default `.data/uploads` locally. **Production:** set an absolute persistent path (e.g. `/var/lib/bidvera/uploads`) that survives redeploys. Also persist `public/uploads/avatars` and `public/uploads/landing` (see `docs/production-deployment.md`). |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile. Required in production. Local: omit to skip, or use Cloudflare dummy keys. |

Assistant voice keys are stored encrypted in Super Admin (AI Knowledge). Optional env fallbacks: `ELEVENLABS_*`, `GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`.

Google login: enable in Super Admin → Auth, then register the callback URI documented in [`docs/google-oauth.md`](docs/google-oauth.md) (`/api/auth/google/callback`).

See `.env.example` for the full list (Stripe optional).

## Database

```powershell
npx prisma migrate deploy
npm run db:seed
```

Migrations live under `prisma/migrations/`. Do not commit local DB dumps.

## Deployment checklist

See **[docs/production-deployment.md](docs/production-deployment.md)** for install → env → migrate → Nginx/HTTPS → systemd APP/WORKER → health → backup → rollback.

See **[docs/production-readiness.md](docs/production-readiness.md)** for resources, processes, and security.

1. Set production env vars (no defaults for `AUTH_SECRET` / SA password; `PAYPAL_ENVIRONMENT=production` for live billing).
2. `npx prisma migrate deploy` against production Postgres.
3. `npm run db:seed` once (or ensure plans/features exist).
4. Build: `npm run build` · Start: `npm run start` (or host’s Node adapter).
5. Run `npm run worker` as a separate supervised process for PDF/AI jobs and backups.
6. Point PayPal webhook to `/api/billing/webhook` with `PAYPAL_WEBHOOK_ID`.
7. Ensure `STORAGE_ROOT` and `BACKUP_ROOT` are persistent and not colocated; set `DATABASE_URL_DIRECT` for dumps.
8. Confirm `GET /api/ready` returns READY and Super Admin → Production readiness.
9. Rotate Super Admin path and password; keep SA routes out of sitemap/nav.

## Security notes

- Secrets are server-side only (`AUTH_SECRET`, provider keys, PayPal secret, vault ciphertext).
- Super Admin uses a separate session cookie from company users.
- PayPal activation verifies subscription server-side and requires `custom_id` company binding.
- Landing assistant TTS/ask are rate-limited per IP + browser client id.

## Architecture

```
UI → Application services → Domain (decision/rules) → Prisma → PostgreSQL
External: AI · Storage · Email · Billing · Notifications · Jobs
```

## License

Private / proprietary unless otherwise stated.
