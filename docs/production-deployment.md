# Bidvera production deployment

**Do not treat this document as proof the current environment is production-ready.**  
Apply configs on the real server, fill real secrets yourself, then verify Super Admin → Production readiness and `/api/ready`.

Related: [production-readiness.md](./production-readiness.md), [disaster-recovery.md](./disaster-recovery.md), [production-capacity.md](./production-capacity.md).

---

## 1. Runtime

| Item | Value |
|---|---|
| Node.js | **22 LTS** (pin on host; see `.nvmrc` / `package.json` `engines`) |
| Package manager | **npm** with committed `package-lock.json` (lockfileVersion 3) |
| Install | `npm ci` |
| Build | `npm run build` |
| App start | `npm run start` (binds `HOSTNAME`/`PORT`, default `127.0.0.1:3000` behind Nginx) |
| Worker | `npm run worker` |

Process manager: **systemd** (configs in `deploy/systemd/`). Chosen over PM2 because the project has no PM2 dependency, units already match Linux VPS norms, and journald gives separate APP/WORKER logs without an extra runtime.

---

## 2. Firewall policy (document only — do not auto-apply)

| Direction | Port / service | Policy |
|---|---|---|
| Inbound | TCP **22** SSH | Admin IPs / bastion only |
| Inbound | TCP **443** HTTPS | Public |
| Inbound | TCP **80** HTTP | Public only for ACME + redirect to HTTPS |
| Inbound | TCP **3000** Next.js | **Localhost only** (Nginx upstream) |
| Inbound | PostgreSQL **5432** | **Not public** (private network / Neon) |
| Inbound | Redis | **N/A** (Bidvera uses Postgres durable rate limits) |
| Outbound | HTTPS 443 | PayPal, Resend, Turnstile, AI, Neon, etc. |

Example (Ubuntu ufw — run manually on the server after review):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from YOUR_ADMIN_IP to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Environment

1. Copy `deploy/env.production.example` → `/etc/bidvera/env`
2. Fill real values (never commit them)
3. `chmod 600 /etc/bidvera/env` and restrict ownership
4. Required groups: `NODE_ENV`, `NEXT_PUBLIC_APP_URL` (https), `AUTH_SECRET`, `SUPER_ADMIN_*`, `RATE_LIMIT_BACKEND=durable`, `STORAGE_ROOT`, `BACKUP_ROOT`, `DATABASE_URL` / `DATABASE_URL_DIRECT`, PayPal live, Turnstile production, Resend

---

## 4. Deployment checklist

### A. Install

```bash
# On production host — Node 22 LTS installed
sudo useradd --system --home /opt/bidvera --shell /usr/sbin/nologin bidvera || true
sudo mkdir -p /opt/bidvera /var/lib/bidvera/uploads /var/lib/bidvera/backups /etc/bidvera
# Deploy release into /opt/bidvera (git clone or rsync)
cd /opt/bidvera
npm ci
npm run build
sudo chown -R bidvera:bidvera /opt/bidvera /var/lib/bidvera
```

### B. Env

```bash
sudo cp deploy/env.production.example /etc/bidvera/env
sudo nano /etc/bidvera/env   # fill secrets
sudo chmod 600 /etc/bidvera/env
sudo chown root:bidvera /etc/bidvera/env
```

### C. Database + migrations

```bash
# DATABASE_URL points at private Neon/Postgres
npx prisma migrate deploy
# Seed / sync Super Admin from env (bcrypt hash; no plaintext stored)
# Set SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD in /etc/bidvera/env first
npm run db:seed
# Or rotate credentials later without code changes:
#   sudo nano /etc/bidvera/env   # update SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
#   npm run sa:sync
```

### D. Storage / backups

- Confirm `STORAGE_ROOT` and `BACKUP_ROOT` exist, writable by `bidvera`, and are **not** the same path
- Set `DATABASE_URL_DIRECT` (required for Production readiness backups READY) and optional isolated `BACKUP_RESTORE_DATABASE_URL` before restore-tests
- **Persist app-tree uploads across releases** (not covered by `STORAGE_ROOT`):
  - `public/uploads/avatars` — profile photos
  - `public/uploads/landing` — Super Admin landing media  
  Recommended: bind-mount or symlink from `/var/lib/bidvera/public-uploads/{avatars,landing}` into `/opt/bidvera/public/uploads/` so a fresh `git`/`rsync` deploy does not wipe them.
- Backup encryption uses `AUTH_SECRET` (AES-256-GCM). There is no separate backup encryption env var.

### E. Nginx + HTTPS

```bash
sudo cp deploy/nginx/bidvera.conf /etc/nginx/sites-available/bidvera
# Edit YOUR_DOMAIN
sudo ln -sf /etc/nginx/sites-available/bidvera /etc/nginx/sites-enabled/bidvera
sudo nginx -t && sudo systemctl reload nginx
# Obtain REAL certificates (do not invent/self-sign for production):
sudo certbot --nginx -d YOUR_DOMAIN
```

Security headers stay with the Next.js app (`next.config.ts`). Do not expose DB ports via Nginx.

### F. APP + WORKER (systemd)

**Single instance (default):**

```bash
sudo cp deploy/systemd/bidvera-app.service /etc/systemd/system/
sudo cp deploy/systemd/bidvera-worker.service /etc/systemd/system/
# Fix ExecStart/PATH if npm is not /usr/bin/npm
sudo systemctl daemon-reload
sudo systemctl enable --now bidvera-app bidvera-worker
sudo systemctl status bidvera-app bidvera-worker
```

**Multiple app instances on one host** (recommended — measured SSR CPU saturation on a single process; isolated multi-instance staging used 3 apps + Nginx + worker):

```bash
sudo cp deploy/systemd/bidvera-app@.service /etc/systemd/system/
sudo cp deploy/systemd/bidvera-worker.service /etc/systemd/system/
# Ensure deploy/nginx/bidvera.conf upstream lists matching ports (default 3000–3002, least_conn)
sudo systemctl daemon-reload
sudo systemctl enable --now bidvera-app@3000 bidvera-app@3001 bidvera-app@3002 bidvera-worker
# Do NOT also enable bidvera-app.service (would double-bind :3000)
```

Still **one** worker unit by default. Jobs use DB claim locks (`PENDING` → `RUNNING`); web `drainJobsAction` is forbidden in production. Upload `after()` may kick analysis on the handling instance via exclusive claim — worker also drains the queue.

**Add instance #4 / #5** (no application code change):

```bash
sudo systemctl enable --now bidvera-app@3003
# Add: server 127.0.0.1:3003 max_fails=3 fail_timeout=30s;  to upstream bidvera_next
sudo nginx -t && sudo systemctl reload nginx
curl -sf http://127.0.0.1:3003/api/health
# Then re-run k6 — do not assume linear capacity gain
```

**Drain before restart / remove unhealthy instance:**

1. Comment out that port in Nginx upstream → `sudo nginx -t && sudo systemctl reload nginx`
2. Wait for in-flight requests to finish
3. `sudo systemctl stop bidvera-app@PORT` (SIGTERM; TimeoutStopSec in unit)
4. Fix or leave stopped; shared `/var/lib/bidvera` must remain

Logs:

```bash
journalctl -u bidvera-app -f
journalctl -u 'bidvera-app@*' -f
journalctl -u bidvera-worker -f
```

### G. Health checks

| Endpoint | Expect |
|---|---|
| `GET /api/health` | `200` `{ "ok": true, "service": "bidvera", "instance": "...", ... }` — process alive (per instance) |
| `GET /api/ready` | `200` `{ "ready": true, "status": "READY" }` when configured; **503** when not |

```bash
curl -sf http://127.0.0.1:3000/api/health
curl -sf http://127.0.0.1:3001/api/health   # when multi-instance
curl -sf https://YOUR_DOMAIN/api/ready
```

Also open Super Admin → **Production readiness**.

### H. Connection pools (operator — do not invent)

Per-process Prisma `connection_limit` is set by `src/lib/prisma-url.ts` / optional `PRISMA_CONNECTION_LIMIT` in `/etc/bidvera/env`.

Budget: `(N_app + N_worker) × PRISMA_CONNECTION_LIMIT` must stay under your **Postgres `max_connections`** or **Neon/pgbouncer pooler** allowance (read the plan; leave headroom for admin/`psql`/backups).

Full Profile A/B/C tables: [production-capacity.md](./production-capacity.md).

| Topology | Guidance |
|---|---|
| Neon/pgbouncer `DATABASE_URL` | Default `connection_limit=5` per process; keep it unless the plan documents higher |
| Dedicated Postgres, 1 app + 1 worker | Default non-local `20` or set explicitly |
| Dedicated Postgres, 3 app + 1 worker | Example: `PRISMA_CONNECTION_LIMIT=15` → ~60 client slots (verify `max_connections`) |
| Dedicated Postgres, 5 app + 1 worker | Example: `PRISMA_CONNECTION_LIMIT=12` → ~72 client slots |
| PgBouncer in front of dedicated Postgres | Compatible: Prisma already sets `pgbouncer=true` for pooler-style URLs. Prefer **transaction** pooling; keep `DATABASE_URL_DIRECT` as non-pooler for `pg_dump` |

Do **not** add PgBouncer to this repository — provision it (or Neon pooler) outside the app. Do **not** set `PRISMA_CONNECTION_LIMIT=40` on multi-instance without checking the real DB/pooler cap.

### I. Backup verification

After env roots are set: create one backup and run an isolated restore-test per `docs/disaster-recovery.md`. Do not restore into production `DATABASE_URL`. Backup file lock uses exclusive create on shared `BACKUP_ROOT` (safe across multiple app instances + worker).

### J. Rollback

1. `sudo systemctl stop bidvera-app bidvera-worker` (or `bidvera-app@*` units)
2. Restore previous release directory (or `git checkout` prior tag)
3. Restore DB from encrypted backup **only** onto an isolated target if schema migrated forward unsafely
4. `npm ci && npm run build`
5. `sudo systemctl start bidvera-app bidvera-worker` (or template instances)
6. Re-check `/api/health`, `/api/ready`, Production readiness

---

## 5. Files in this repo

| Path | Purpose |
|---|---|
| `deploy/systemd/bidvera-app.service` | Next.js APP unit (single :3000) |
| `deploy/systemd/bidvera-app@.service` | Templated APP units (`bidvera-app@3000`, etc.) |
| `deploy/systemd/bidvera-worker.service` | Worker unit (one per host; independent of app@.service) |
| `deploy/nginx/bidvera.conf` | TLS reverse proxy, least_conn, 3 upstreams, failover |
| `deploy/scripts/*.sh` | Safe auto-deploy: prepare-release, migration-safety, remote-deploy |
| `deploy/env.production.example` | Production env template (no secrets) |
| `docs/production-capacity.md` | Profiles A/B/C, connection budget, VPS test plan |
| `docs/safe-auto-deploy.md` | Cursor → GitHub → VPS auto-deploy safety |
| `.github/workflows/*.yml` | CI + staging auto-deploy + manual production deploy |
| `.nvmrc` | Node 22 pin for version managers |

---

## 6. Load test (measured — not a production capacity claim)

| Item | Status |
|---|---|
| Load-test infrastructure (`load-test/`, `npm run load-test:*`) | **READY IN CODE** |
| Isolated real run (Docker Postgres + single `next start`) | **EXECUTED** (historical baseline; see `load-test/results/`) |
| Isolated multi-instance staging (Nginx → 3 Next + worker + Postgres) | **EXECUTED** on ~8 vCPU Docker Desktop host — reference only |
| Production VPS multi-instance load test | **NOT EXECUTED** — required before Go/No-Go |

Do **not** claim “supports N concurrent users.” Retest on the real VPS with the same `journeys.js` workload.

### 6a. Latest multi-instance staging reference (after SSR hardening)

Topology: Nginx → 3 Next.js + worker + Postgres (`PRISMA_CONNECTION_LIMIT=15`, Postgres `max_connections=200`). DB peak ~48–50 connections. Bottleneck: SSR/RSC CPU.

| Concurrent journeys | p95 | Error rate |
|---|---|---|
| 50 | ~1.4 s | 0% |
| 100 | ~2.3 s | 0% |
| 250 | ~6.1 s | 0% |
| 500 | ~17.6 s | 0% |
| 1000 | ~60 s | ~5% |

Project thresholds (error ≤1%, p95 &lt;2s, p99 &lt;5s): 50 PASS; 100 DEGRADED; 250+ FAIL on this host class.

Capacity profiles + first-VPS test plan: [production-capacity.md](./production-capacity.md).

```bash
npm run load-test:up
npm run load-test:k6
npm run load-test:down
# Multi-instance isolated stack: load-test/docker-compose.multi.yml + load-test/run-multi-phases.ps1
```

Super Admin Load test page is read-only and does not run k6 from production.

---

## 7. Feature safety (keep OFF unless explicitly activated)

Do **not** enable for normal tenants during first production cutover:

- Tender Analysis commercial entitlement (`commerciallyAvailable: false` — SA/internal only)
- Matching Engine (`defaultEnabledGlobal: false`)
- Sponsored Matching
- TED ingestion (`enabled` + `workerScheduleAllowed` both default **false**)

Activate only via Super Admin after a deliberate product decision.

