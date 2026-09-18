# Bidvera production capacity preparation

**This document prepares operators to size and test a real VPS.**  
It does **not** claim Bidvera “supports N concurrent users.” Capacity is proven only by k6 on the target topology.

Measured reference (isolated Docker multi-instance staging, ~8 vCPU host, Nginx → 3 Next.js + worker + Postgres, same `journeys.js` workload, after SSR hardening):

| Concurrent journeys (VU) | p95 | Error rate | Notes |
|---|---|---|---|
| 50 | ~1.4 s | 0% | Met project p95 &lt; 2 s |
| 100 | ~2.3 s | 0% | Slightly over p95 target |
| 250 | ~6.1 s | 0% | SSR CPU saturated |
| 500 | ~17.6 s | 0% | Queueing on SSR |
| 1000 | ~60 s | ~5% | Fail under project thresholds |

Observed bottleneck: **Next.js SSR/RSC CPU**. Postgres peaked ~48–50 / 200 connections (not exhausted).

Do **not** assume linear scaling with vCPU or instance count. Retest after every topology change.

Project latency/error targets for Go/No-Go:

- error rate ≤ 1%
- p95 &lt; 2000 ms
- p99 &lt; 5000 ms

Related: [production-deployment.md](./production-deployment.md), [production-readiness.md](./production-readiness.md), [disaster-recovery.md](./disaster-recovery.md).

---

## 1. Capacity profiles (design only — retest required)

All profiles assume:

- systemd + Nginx on one primary app host (horizontally add app ports, not Kubernetes)
- DB-backed sessions + `RATE_LIMIT_BACKEND=durable`
- shared `STORAGE_ROOT` / `BACKUP_ROOT` (+ public upload mounts)
- one worker process (DB job claims)
- Matching / TED / Sponsored Matching remain OFF unless product activates them

### Profile A — Minimum production

| Item | Guidance |
|---|---|
| Host CPU | **8 vCPU** (same class as measured staging) |
| Host RAM | **16 GB** |
| Next.js instances | **3** (`bidvera-app@3000`–`3002`) |
| Worker | **1** |
| PostgreSQL | Managed Postgres or dedicated VM; prefer **pooler** for `DATABASE_URL` |
| Storage | **100+ GB** SSD for uploads + backups (grow with tenants) |
| `PRISMA_CONNECTION_LIMIT` | **10–15** if dedicated `max_connections≥200`; **5** if Neon/pgbouncer plan is tight |
| Connection budget (example) | (3+1)×15 = **60** client slots → leave ≥40% headroom vs `max_connections` |
| Tradeoff | May clear 50 VU targets; **100+ VU not proven** on this class — expect DEGRADED/FAIL until retested on the real VPS |

### Profile B — Recommended production

| Item | Guidance |
|---|---|
| Host CPU | **16 vCPU** |
| Host RAM | **32 GB** |
| Next.js instances | **4–5** (ports 3000–3003/3004) |
| Worker | **1** (add a second worker only if job backlog is measured) |
| PostgreSQL | Separate managed Postgres + pooler; `max_connections` ≥ 200 or pooler with documented pool size |
| Storage | **200+ GB** SSD (or object-backed mounts) for uploads/backups |
| `PRISMA_CONNECTION_LIMIT` | **10–12** with 5 app + 1 worker → ~60–72 slots |
| Tradeoff | Better SSR headroom than Profile A; **still requires k6 on this host** before claiming latency targets at 100+ VU |

### Profile C — Higher concurrency

| Item | Guidance |
|---|---|
| Host CPU | **32 vCPU** (or split app tier across 2 hosts behind one LB — same shared storage + DB) |
| Host RAM | **64 GB** |
| Next.js instances | **6–8** on one large host, or **3+3** across two app hosts |
| Worker | **1–2** (second only with measured queue pressure) |
| PostgreSQL | Dedicated primary (≥4 vCPU, 16 GB+), pooler in front; monitor connections & CPU |
| Storage | **500+ GB** or networked volume with backups off-host |
| `PRISMA_CONNECTION_LIMIT` | Size so `(N_app + N_worker) × limit` &lt; 50–60% of pooler/`max_connections` |
| Tradeoff | Higher cost; only justified after Profile B retest still fails p95 at needed concurrency |

---

## 2. Connection-budget formula

```
budget = (N_app + N_worker) × PRISMA_CONNECTION_LIMIT
budget < Postgres max_connections   OR   pooler max client/server slots
leave headroom for: migrations, psql, backups (DATABASE_URL_DIRECT), monitoring
```

| Example topology | Limit | Est. max app+worker clients | If Postgres max=200 |
|---|---|---|---|
| A: 3 app + 1 worker | 15 | 60 | ~140 headroom |
| B: 5 app + 1 worker | 12 | 72 | ~128 headroom |
| C: 8 app + 2 worker | 10 | 100 | ~100 headroom |
| Neon pooler (tight) | 5 | (N+W)×5 | obey Neon plan |

**Operator input required:** real `max_connections` or Neon pool size. Do not set `PRISMA_CONNECTION_LIMIT=40` on multi-instance without checking the plan.

Defaults in `src/lib/prisma-url.ts` when unset: pooler → 5; dedicated non-local → 20; local dedicated → 40.

---

## 3. Horizontal growth (no app code change)

1. Choose free loopback port (e.g. `3003`).
2. `sudo systemctl enable --now bidvera-app@3003`
3. Add `server 127.0.0.1:3003 max_fails=3 fail_timeout=30s;` to `upstream bidvera_next` in Nginx.
4. `sudo nginx -t && sudo systemctl reload nginx`
5. `curl -sf http://127.0.0.1:3003/api/health`
6. Re-run k6 — do not assume capacity doubled.

**Drain / remove unhealthy instance**

1. Comment out its `server` line → `nginx -t && reload`
2. Wait for in-flight requests (watch journal / active connections)
3. `sudo systemctl stop bidvera-app@PORT`
4. Fix or leave disabled; never delete shared storage

---

## 4. Staging test plan (first real VPS) — do not skip

1. Provision VPS matching Profile A or B  
2. Configure PostgreSQL (+ pooler if used); note `max_connections`  
3. Mount persistent `STORAGE_ROOT`, `BACKUP_ROOT`, public upload binds  
4. Install Nginx from `deploy/nginx/bidvera.conf` + real TLS  
5. Enable 3+ `bidvera-app@` units + `bidvera-worker`  
6. Fill `/etc/bidvera/env` (no secrets in git)  
7. `curl` each `/api/health` (instance id present)  
8. `curl` public `/api/ready` → READY  
9. Smoke: login, dashboard, upload path, settings  
10. Run **same** `load-test/k6/journeys.js` at 5 / 50 / 100 / 250 / 500 (1000 if safe)  
11. Record p50 / p95 / p99 / error / CPU / RAM / DB connections  
12. Tune instance count / profile from **evidence**  
13. Isolated backup restore with `BACKUP_RESTORE_DATABASE_URL`  
14. GO / NO-GO against project thresholds  

**Production VPS multi-instance k6: NOT EXECUTED in-repo.** Isolated Docker multi-instance is a reference only.

---

## 5. Observability (lightweight)

| Signal | How |
|---|---|
| Instance liveness | `GET /api/health` → `instance` |
| Config readiness | `GET /api/ready` + Super Admin Production readiness |
| App crashes | `journalctl -u 'bidvera-app@*' -u bidvera-worker` |
| Latency / errors | Nginx access logs + k6 staging runs; optional reverse-proxy metrics |
| DB pressure | `pg_stat_activity` count vs `max_connections` |
| Worker | journal + Super Admin job/backup status; heartbeat via readiness checks |
| Storage growth | `df` on `/var/lib/bidvera` |
| Backup failures | Super Admin Backups + worker logs |

Do not require a full APM platform for first cutover.
