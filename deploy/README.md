# Bidvera deploy templates

Operator-ready production templates. **Do not deploy from this directory automatically.**

| Path | Purpose |
|---|---|
| `systemd/bidvera-app.service` | Single Next.js instance (`:3000`) |
| `systemd/bidvera-app@.service` | Multi-instance (`bidvera-app@3000`, …) |
| `systemd/bidvera-worker.service` | Background worker (separate from web) |
| `nginx/bidvera.conf` | TLS reverse proxy, `least_conn`, failover |
| `env.production.example` | Env template — copy to `/etc/bidvera/env` (mode 0600) |

Documentation:

- [docs/production-deployment.md](../docs/production-deployment.md)
- [docs/production-capacity.md](../docs/production-capacity.md) — Profiles A/B/C + VPS test plan
- [docs/safe-auto-deploy.md](../docs/safe-auto-deploy.md) — GitHub Actions auto-deploy
- [docs/production-readiness.md](../docs/production-readiness.md)
- [docs/disaster-recovery.md](../docs/disaster-recovery.md)

Matching Engine, TED, and Sponsored Matching stay OFF unless explicitly activated in Super Admin.
