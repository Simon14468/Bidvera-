# Bidvera disaster recovery

This is the operator workflow for encrypted platform backups. Super Admin URL:

`/{SUPER_ADMIN_PATH}/backups`

Tenant users cannot access this page or trigger restore.

## What is backed up

- PostgreSQL data (pg_dump custom format when a non-pooled URL and `pg_dump` exist; otherwise a Prisma logical JSONL dump of every model)
- Uploaded company files from `STORAGE_ROOT` (default `.data/uploads`)
- Landing media under `public/uploads/landing`
- Recovery metadata (`recovery.json`: table counts, schema fingerprint, method)

Archives are AES-256-GCM encrypted with a key derived from `AUTH_SECRET`. Losing `AUTH_SECRET` makes backups unreadable.

Backups are stored under `BACKUP_ROOT` (default `.data/backups`), **not** in the production database and **not** under `STORAGE_ROOT`.

## Recovery workflow

1. Open Super Admin → Backups and identify the latest row with status `SUCCESS` and integrity `verified`. If integrity is unverified, run **Verify backup**.
2. Run **Restore test**:
   - Always decrypts into an isolated temp directory (path-traversal-safe extract), checks `recovery.json`, critical table keys, and Prisma schema fingerprint.
   - When `BACKUP_RESTORE_DATABASE_URL` is set (must differ from `DATABASE_URL` / `DATABASE_URL_DIRECT`) **and** the archive contains `db/postgres.dump`, the test runs **`pg_restore` into that isolated database** and verifies critical tables via `psql`. Method: `pg_restore_isolated`.
   - When the restore URL is unset, the test records method `archive_verify` (integrity + extract only). That is **not** a database restore.
   - It never writes to production `DATABASE_URL`.
3. To enable isolated DB restore tests, provision a separate Postgres instance and set `BACKUP_RESTORE_DATABASE_URL`. Prefer backups created with `pg_dump` (`db/postgres.dump` inside the archive).
4. Restore files from the `files/` and `landing/` members of a decrypted archive onto a **new** `STORAGE_ROOT` (never overwrite live production storage from the product UI).
5. Point a staging app at the isolated database, run `npx prisma migrate deploy` if the schema fingerprint differed, then start the app and confirm companies, users, subscriptions, and Super Admin login exist.
6. Record the restore result on the Backups page (restore test) and in Super Admin audit.

Production restore onto live `DATABASE_URL` is not exposed in the product. That is a deliberate break-glass operation performed offline by an operator with Super Admin authorization.

## Manual production configuration

- Set `BACKUP_ROOT` to a durable, off-host path in production.
- Set `DATABASE_URL_DIRECT` to a non-pooler Postgres URL (required for Production readiness backups READY / `pg_dump`).
- Set `BACKUP_RESTORE_DATABASE_URL` to an isolated Postgres URL for automated restore tests.
- Keep `AUTH_SECRET` backed up in a secret manager (not inside the backup archive). Losing it makes encrypted archives unreadable.
- Run `npm run worker` so scheduled backups execute.
- Confirm Super Admin password step-up before Run / Verify / Restore test / Settings.

### Status of this preparation pass

| Item | Status |
|---|---|
| Encrypted backup implementation | READY IN CODE |
| Isolated restore *capability* (when `BACKUP_RESTORE_DATABASE_URL` is set) | READY IN CODE |
| Real isolated DB restore on a dedicated restore database | **NOT EXECUTED** — requires operator provision + Super Admin Restore test |
