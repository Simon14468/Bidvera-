# Bidvera load test (1000 concurrent users)

Dedicated **staging/load** environment. Never point these scripts at production.

## What this covers

- Docker Compose: Postgres + Next.js app + optional k6
- **Multi-instance:** `docker-compose.multi.yml` — Nginx → 3 Next.js apps + separate worker + shared volume
- Synthetic companies/users + **pre-issued session cookies** (login is capped at 30/IP/hour — hammering login only measures the rate limiter)
- Realistic authenticated journeys: dashboard → company → DCM → client requests → supplier qualification → questionnaire → tenders → logout
- Configurable thresholds (error rate, p95, p99)
- Report written to `.data/load-test/latest-report.json` for Super Admin → **Load test**

Matching / Sponsored / TED stay OFF. No real email, payments, or AI keys in the compose file.

## Quick start (single app)

```bash
npm run load-test:up
# Wait until http://localhost:3100/api/health is OK (first boot seeds ~1000 users — can take 10–20+ min)
npm run load-test:k6:smoke   # MAX_VUS=50
npm run load-test:k6         # MAX_VUS=1000
```

## Multi-instance (Nginx + 3 apps + worker)

```bash
npm run load-test:multi:up
# Wait until http://localhost:3100/api/health returns rotating instance ids (app1/app2/app3)
powershell -File load-test/run-multi-functional.ps1
powershell -File load-test/run-multi-phases.ps1
npm run load-test:multi:down
```

Connection budget in multi compose: `(3 app + 1 worker) × PRISMA_CONNECTION_LIMIT=15 = 60` against Postgres `max_connections=200`.

App URL: http://localhost:3100  
Postgres: `localhost:5433` / `bidvera` / `bidvera_load_test_only` / db `bidvera_load`

## Thresholds (env)

| Variable | Default | Meaning |
|---|---|---|
| `MAX_VUS` | 1000 | Concurrent users target |
| `HOLD_SECONDS` | 180 | Hold at peak |
| `ERROR_RATE_THRESHOLD` | 0.01 | Max error rate (1%) |
| `P95_MS` | 2000 | Max p95 for page/API trends |
| `P99_MS` | 5000 | Max p99 |

## Verdict rules

- **PASS**: reached target VUs, error rate ≤ threshold, p95/p99 within limits, no sustained 5xx spike
- **WARNING**: reached VUs but latency above threshold
- **FAIL**: did not reach target VUs, error rate too high, or too few requests

Super Admin page (`/{SUPER_ADMIN_PATH}/load-test`) is **read-only** and shows the stored report only. There is no “run load test” button.

## Safety

Scripts refuse hosts containing `bidvera.com`, `vercel.app`, `neon.tech`, etc. Override only with `LOAD_TEST_ALLOW_REMOTE=1` (not recommended).
