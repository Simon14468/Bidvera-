# Safe GitHub auto-deploy (Cursor → GitHub → VPS)

**Status goal:** code updates without resetting or corrupting company/user data.

This pipeline is implemented in-repo. **Production auto-deploy on push is intentionally disabled.**  
Staging E2E against a real VPS is **NOT EXECUTED** until operators configure secrets and prove one staging deploy.

Related: [production-deployment.md](./production-deployment.md), [production-capacity.md](./production-capacity.md), [disaster-recovery.md](./disaster-recovery.md).

---

## 1. Flow

```
Cursor → git push → GitHub
  → CI gates (security, tsc, lint, build, migration safety)
  → (staging branch only) SSH to staging VPS
  → prepare-release (fetch SHA, npm ci, build)
  → backup gate (createPlatformBackup triggeredBy=deploy)
  → prisma migrate deploy   # NEVER reset / force-reset
  → atomic symlink current → releases/<sha>
  → rolling restart (drain → restart → /api/health+/api/ready → enable)
  → restart worker
  → success OR code-only rollback to previous symlink
```

Database migrations are **never** auto-reversed.

---

## 2. Triggers

| Workflow | Trigger | Target |
|---|---|---|
| `.github/workflows/ci.yml` | push/PR to `master`/`main`/`staging` | CI only |
| `.github/workflows/deploy-staging.yml` | push to `staging` (+ manual) | Staging VPS |
| `.github/workflows/deploy-production.yml` | **workflow_dispatch only** + type `deploy-production` | Production VPS |

Recommended branch flow:

1. Develop on feature branches → PR into `staging` or `master`
2. Merge to `staging` → auto staging deploy (after secrets configured)
3. After staging proof → manual production dispatch

Do **not** push arbitrary branches to production.

---

## 3. CI gates (must all pass)

- `npx tsx scripts/migration-safety-scan.ts`
- `npm run test:security`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

Any failure **stops** deploy jobs (`needs: gates`).

---

## 4. Migration safety

Automatic deploy only allows forward-compatible SQL.

**Blocked** (scan fails → no deploy):

- `DROP TABLE` / `DROP COLUMN` / `DROP DATABASE`
- `TRUNCATE`
- `DELETE FROM` without `WHERE`
- `SET NOT NULL` conversions
- `RENAME COLUMN` / `RENAME TO`
- Script references to `migrate reset`, `db push --force-reset`

**Allowed examples:** add nullable column, add table, add index, `DROP CONSTRAINT` / `DROP INDEX` (Prisma FK recreates).

Destructive migrations require **manual operator approval** (do not auto-deploy).

Runtime migrate command: `npx prisma migrate deploy` only (`npm run db:migrate:deploy`).

---

## 5. Backup gate

Before migrate on the VPS:

```bash
npx tsx scripts/deploy-backup-gate.ts
```

Uses existing `createPlatformBackup({ triggeredBy: "deploy" })`.  
If backup status ≠ `SUCCESS` → **STOP** (no migrate).

Requires VPS `/etc/bidvera/env` with `DATABASE_URL_DIRECT`, `BACKUP_ROOT`, `AUTH_SECRET`, etc.

---

## 6. Rolling restart

Uses multi-instance Nginx upstreams + `bidvera-app@PORT`:

1. Comment upstream line for one port (`# bidvera-drain`)
2. `nginx -t && reload`
3. Short drain sleep
4. `systemctl restart bidvera-app@PORT`
5. Wait for `/api/health` + `/api/ready`
6. Re-enable upstream
7. Next port

Single-instance: script warns of brief downtime.

Worker restarted **after** apps succeed.

---

## 7. Code rollback vs DB rollback

| Failure | Automatic action |
|---|---|
| CI / build | No VPS changes |
| Backup gate | No migrate, no symlink switch |
| Health failure mid-rollout | Restore `current` → previous release symlink; restart units; **no** migrate down |

**Database rollback is manual** (isolated restore via `BACKUP_RESTORE_DATABASE_URL` / DR runbook). Never automatic.

---

## 8. Persistent storage

Deploy scripts refuse to proceed if `STORAGE_ROOT` / `BACKUP_ROOT` missing or equal.  
Release dirs live under `/opt/bidvera/releases/<sha>` — never under storage/backup roots.  
No `rm -rf` of uploads, avatars, PDFs, or backups.

Systemd `WorkingDirectory=/opt/bidvera/current`.

---

## 9. Secrets

| Location | Contents |
|---|---|
| GitHub Secrets | `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`, `STAGING_REPO_URL` (and production equivalents) — **minimum** |
| `/etc/bidvera/env` on VPS | `DATABASE_URL`, `AUTH_SECRET`, PayPal, Turnstile, etc. |

Never commit VPS passwords, private keys, or app secrets. Deploy logs must not print URLs with credentials, tokens, or company data.

---

## 10. Concurrency

- `deploy-staging` / `deploy-production` groups with `cancel-in-progress: false` (queue; do not cancel mid-migrate)
- VPS `flock` on `/var/lock/bidvera-deploy.lock`

---

## 11. Super Admin / auth

Deploy scripts never run `sa:sync`, `db:seed`, or credential resets. Sessions remain DB-backed; durable rate limits unchanged.

---

## 12. Bootstrap a VPS once (operator)

```bash
# On VPS as root/bidvera
sudo mkdir -p /opt/bidvera/{releases,bootstrap,repo.git} /var/lib/bidvera/{uploads,backups} /etc/bidvera
# Copy this repo's deploy/ tree to /opt/bidvera/bootstrap/deploy (one-time)
# Install systemd units + nginx from deploy/
# Point WorkingDirectory at /opt/bidvera/current (units already do)
# Create symlink placeholder: ln -sfn /opt/bidvera/bootstrap /opt/bidvera/current
sudo cp deploy/env.production.example /etc/bidvera/env   # fill secrets, chmod 600
# Configure git fetch credentials for STAGING_REPO_URL (deploy key)
```

GitHub:

1. Create Environments `staging` and `production` (production: required reviewers)
2. Add staging secrets listed in the workflow header
3. Create branch `staging`
4. Push to `staging` to run first auto-deploy

Disable auto-deploy: delete/protect `staging` branch rule, or remove SSH secrets, or disable the workflow in GitHub Actions UI.

---

## 13. Emergency manual deploy

```bash
export DEPLOY_SHA=<sha> DEPLOY_ENV=staging DEPLOY_ROOT=/opt/bidvera REPO_URL=<url> APP_PORTS="3000 3001 3002"
bash /opt/bidvera/bootstrap/deploy/scripts/prepare-release.sh
bash /opt/bidvera/releases/$DEPLOY_SHA/deploy/scripts/remote-deploy.sh
```

---

## 14. Staging proof checklist (must pass before production)

- [ ] Staging secrets configured  
- [ ] One successful Actions → VPS deploy  
- [ ] Backup created (`triggeredBy=deploy`)  
- [ ] Migrate apply (or no-op)  
- [ ] Rolling health OK on all ports  
- [ ] Synthetic login/session/document upload still works  
- [ ] STORAGE_ROOT files intact  
- [ ] Intentional health-fail drill restores previous code symlink  
- [ ] No secrets in Actions logs  

Until this list is done, **do not** run production `workflow_dispatch`.

---

## 15. Staging test result (this repository)

**NOT EXECUTED** — no staging VPS SSH endpoint was available in the implementation environment.
