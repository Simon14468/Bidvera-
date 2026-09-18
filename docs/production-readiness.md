# Bidvera production readiness

Operational guide for deploying Bidvera. **This document does not claim the current environment is production-ready.** Verify via Super Admin → Production readiness and `/api/ready`.

Capacity profiles (A/B/C), connection budget, and first-VPS k6 plan: [production-capacity.md](./production-capacity.md). Step-by-step install: [production-deployment.md](./production-deployment.md).

## 1. Recommended resources

Sizing must be retested on the real VPS. Isolated multi-instance staging (~8 vCPU, 3 Next.js + worker) is a **reference only** — see [production-capacity.md](./production-capacity.md) Profiles A/B/C.

| Tier | CPU | RAM | Notes |
|---|---|---|---|
| **Minimum (Profile A)** | 8 vCPU | 16 GB | 3 app instances + 1 worker; may meet p95&lt;2s near ~50 VU on similar hosts — **retest** |
| **Recommended (Profile B)** | 16 vCPU | 32 GB | 4–5 app instances + 1 worker; more SSR headroom — **retest** |
| **Higher concurrency (Profile C)** | 32 vCPU | 64 GB | 6–8 apps or split app hosts — only after B still fails targets |
| **Postgres / Neon** | Managed | ≥1 GB RAM plan | Pooler for `DATABASE_URL`; **direct** URL for `pg_dump` via `DATABASE_URL_DIRECT`. Size Prisma `connection_limit` so `(N_app+N_worker)×limit` fits the plan |
| **Rate limit** | — | — | **No Redis required** — production uses Postgres `RateLimitBucket` (`RATE_LIMIT_BACKEND=durable`) |
| **Storage** | Persistent volume | Size to uploads | `STORAGE_ROOT` + shared `public/uploads/{avatars,landing}` must survive redeploys and be visible to every app instance |
| **Backups** | Off-host disk / volume | Retention × archive size | `BACKUP_ROOT` must **not** share `STORAGE_ROOT` |

**Node.js:** **22 LTS** (`.nvmrc` / `engines.node` = `22.x`). See [production-deployment.md](./production-deployment.md) for systemd + Nginx multi-instance templates.

## 2. Process architecture

| Process | Command | Role |
|---|---|---|
| **APP** | `npm run build` then `npm run start` | Next.js HTTP (default port 3000 / `PORT`) |
| **WORKER** | `npm run worker` | Jobs, alerts, billing reconcile, scheduled backups, email send jobs |
| **DATABASE** | Managed Postgres | Prisma + durable rate limits |
| **RATE LIMIT** | Same Postgres | Not Redis |
| **STORAGE** | Disk / object store path | `STORAGE_ROOT` |
| **BACKUP** | Path on durable media | `BACKUP_ROOT` + optional `DATABASE_URL_DIRECT` |

### Process manager (APP + WORKER)

Run **two** supervised processes. Canonical units live in `deploy/systemd/` and load secrets from **`/etc/bidvera/env`** (mode `0600`). Do not invent a second env file under `/opt/bidvera`.

```ini
# /etc/systemd/system/bidvera-app.service  (see deploy/systemd/bidvera-app.service)
# Or multi-instance: deploy/systemd/bidvera-app@.service → bidvera-app@3000, @3001, …
[Service]
WorkingDirectory=/opt/bidvera
EnvironmentFile=-/etc/bidvera/env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

# /etc/systemd/system/bidvera-worker.service  (see deploy/systemd/bidvera-worker.service)
[Service]
WorkingDirectory=/opt/bidvera
EnvironmentFile=-/etc/bidvera/env
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
```

Or **PM2**: `pm2 start npm --name bidvera-app -- start` and `pm2 start npm --name bidvera-worker -- run worker`, with `pm2 save` + startup hook — still use the same `/etc/bidvera/env` (or equivalent secret store), not a committed `.env`. For multi-instance under PM2, start separate app processes with distinct `PORT` values and point Nginx upstream at each.

Health wiring:

- Load balancer liveness → `/api/health` (per instance; includes `instance` id)
- Load balancer readiness → `/api/ready` (expect 503 until READY)
- Super Admin → Production readiness shows worker heartbeat age

Graceful stop: remove from LB upstream → `systemctl stop bidvera-app@PORT` / `bidvera-worker` (SIGTERM). Do **not** drain jobs from HTTP in production.

## 3. Required production environment

Critical (fail closed or break auth/billing):

- `NODE_ENV=production`
- `DATABASE_URL`
- `AUTH_SECRET` (≥32 random chars — no dev fallback)
- `SUPER_ADMIN_PATH` (≥12, non-banned)
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (required for seed and production readiness; rotate via env + `npm run sa:sync`)
- `NEXT_PUBLIC_APP_URL` (**https://** public origin)
- `RATE_LIMIT_BACKEND=durable` (or unset; never `memory`)
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (no Cloudflare dummy secrets)
- `STORAGE_ROOT` (persistent)
- `BACKUP_ROOT` (persistent, off-host preferred, not under uploads)
- `DATABASE_URL_DIRECT` (non-pooler) — **required for overall Production readiness READY** (pg_dump path)
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, **`PAYPAL_ENVIRONMENT=production`**
- Email: Resend vault or `RESEND_API_KEY` + from address; confirm with SA email test (shown on readiness page; not in the overall READY gate set)

Recommended (not in overall READY gate, but needed for DR drills):

- `BACKUP_RESTORE_DATABASE_URL` — isolated Postgres URL **≠** `DATABASE_URL` / `DATABASE_URL_DIRECT` for automated `pg_restore` tests

Optional: Stripe keys, OAuth, AI keys (prefer SA vaults).

**Never** commit secrets. Seed Meridian passwords and known SA demo passwords must not be used on shared/prod DBs.

## 4. Security / network (operator checklist)

- Terminate **HTTPS** at reverse proxy / platform; cookies use `secure` when `NODE_ENV=production`
- Security headers applied via `next.config.ts` (HSTS, nosniff, frame deny, CSP report-only)
- Public ports: **443** (and 80→443) only; app binds privately
- Postgres: private network / Neon; do not expose 5432 publicly
- SSH: key-only, disable password auth, restrict by IP where possible
- Keep `BACKUP_ROOT` on media/account separate from the app disk when feasible
- Firewall: allow outbound HTTPS to PayPal, Stripe, Resend, Turnstile, AI providers

## 5. Super Admin

`/{SUPER_ADMIN_PATH}/production-readiness` — read-only live status for Database, Storage, Worker, Rate limiting, Backups, PayPal, Stripe, Turnstile, Email, HTTPS/config.

## 6. Validation before go-live

1. Open Production readiness — overall **READY** only when required checks pass
2. `curl -sf https://YOUR_DOMAIN/api/ready` (use your real public hostname)
3. Confirm worker heartbeat fresh
4. Confirm PayPal environment is **live** and webhook delivers
5. Run a backup + restore-test per `docs/disaster-recovery.md` (isolated restore needs `BACKUP_RESTORE_DATABASE_URL`)
6. Execute load tests on Docker/staging with **multiple** Next.js upstreams before capacity Go/No-Go (`docs/production-deployment.md` § Load test). Isolated single-process results are recorded; **multi-instance production load is NOT claimed here**.

### What is NOT claimed by this document

- Production deployment completed
- Isolated DB restore executed on a real dedicated restore database
- Multi-instance production load-test PASS (templates are ready; the run itself is operator-owned)
- Any absolute “supports N concurrent users” marketing claim
