/**
 * Production scalability regressions — confirmed query bounds and indexes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("production scalability query bounds", () => {
  it("workspace dashboard uses aggregates and bounded activity samples", () => {
    const src = read("src/application/workspace-dashboard.ts");
    assert.match(src, /complianceDocument\.groupBy/);
    assert.match(src, /ACTIVITY_SAMPLE_LIMIT\s*=\s*500/);
    assert.match(src, /take:\s*ACTIVITY_SAMPLE_LIMIT/);
    assert.match(src, /take:\s*200/);
    assert.match(src, /take:\s*5/);
  });

  it("matching overview counts dismissed instead of loading all rows", () => {
    const src = read("src/application/matching-dashboard-overview.ts");
    assert.match(src, /matchRecommendation\.count/);
    assert.doesNotMatch(
      src,
      /matchRecommendation\.findMany\(\s*\{\s*where:\s*\{\s*companyId,\s*status:\s*"DISMISSED"/,
    );
  });

  it("matching recommendation list is hard-capped", () => {
    const src = read("src/modules/matching-engine/internal/service.ts");
    assert.match(src, /options\?\.limit \?\? 20/);
    assert.match(src, /Math\.min\(Math\.max\(/);
    assert.match(src, /take:\s*limit/);
    assert.match(src, /,\s*100\)/);
  });

  it("questionnaire draft answers index companyId+updatedAt for dashboard activity", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(
      schema,
      /model QuestionnaireDraftAnswer[\s\S]*?@@index\(\[companyId, updatedAt\]\)/,
    );
    const migration = read(
      "prisma/migrations/20260917180000_questionnaire_draft_updated_at_index/migration.sql",
    );
    assert.match(migration, /QuestionnaireDraftAnswer_companyId_updatedAt_idx/);
  });

  it("Prisma pool URL hardens Neon connection_limit and raises local dedicated pool", () => {
    const src = read("src/lib/prisma-url.ts");
    assert.match(src, /connection_limit/);
    assert.match(src, /pgbouncer/);
    assert.match(src, /pooled\s*\?\s*"5"/);
    assert.match(src, /localDedicated/);
    assert.match(src, /\? "40"/);
  });

  it("load-test infra supports staged VU targets including 1000", () => {
    const journeys = read("load-test/k6/journeys.js");
    assert.match(journeys, /stagesFor/);
    assert.match(journeys, /\[50, 100, 250, 500, 750, 1000\]/);
    assert.match(journeys, /assertNotProduction/);
    assert.match(journeys, /MAX_VUS/);
  });

  it("production backups refuse unbounded logical-only dumps without opt-in", () => {
    const dump = read("src/services/backup/dump.ts");
    assert.match(dump, /LOGICAL_DUMP_BATCH_SIZE/);
    assert.match(dump, /take:\s*LOGICAL_DUMP_BATCH_SIZE/);
    assert.match(dump, /appendFile/);
    const run = read("src/services/backup/run.ts");
    assert.match(run, /BACKUP_ALLOW_LOGICAL/);
    assert.match(run, /DATABASE_URL_DIRECT/);
  });

  it("worker releases stale job locks and hard-fails soft email delivery", () => {
    const worker = read("src/worker/index.ts");
    assert.match(worker, /releaseStaleJobLocks/);
    assert.match(worker, /Email delivery failed/);
  });

  it("multi-instance deploy templates cover upstreams, app@ units, durable rate limit, exclusive backup lock", () => {
    const nginx = read("deploy/nginx/bidvera.conf");
    assert.match(nginx, /upstream bidvera_next/);
    assert.match(nginx, /least_conn/);
    assert.match(nginx, /127\.0\.0\.1:3000/);
    assert.match(nginx, /127\.0\.0\.1:3001/);
    assert.match(nginx, /127\.0\.0\.1:3002/);
    assert.match(nginx, /client_max_body_size 130m/);
    assert.match(nginx, /proxy_read_timeout 300s/);
    assert.match(nginx, /proxy_next_upstream/);
    assert.match(nginx, /keepalive 64/);

    const appTemplate = read("deploy/systemd/bidvera-app@.service");
    assert.match(appTemplate, /Environment=PORT=%i/);
    assert.match(appTemplate, /INSTANCE_ID=app-%i/);
    assert.match(appTemplate, /EnvironmentFile=-\/etc\/bidvera\/env/);
    assert.match(appTemplate, /LimitNOFILE=65535/);
    assert.match(appTemplate, /TimeoutStopSec=45/);

    const worker = read("deploy/systemd/bidvera-worker.service");
    assert.match(worker, /npm run worker/);
    assert.doesNotMatch(worker, /After=.*bidvera-app\.service/);
    assert.match(worker, /INSTANCE_ID=worker/);

    const envEx = read("deploy/env.production.example");
    assert.match(envEx, /RATE_LIMIT_BACKEND=durable/);
    assert.match(envEx, /PRISMA_CONNECTION_LIMIT/);
    assert.match(envEx, /CONNECTION BUDGET/);
    assert.match(envEx, /DATABASE_URL_DIRECT/);
    assert.match(envEx, /STORAGE_ROOT/);
    assert.match(envEx, /BACKUP_ROOT/);
    assert.match(envEx, /BACKUP_RESTORE_DATABASE_URL/);
    assert.doesNotMatch(envEx, /sk_live_|npg_|password=\w{8,}/i);

    const capacity = read("docs/production-capacity.md");
    assert.match(capacity, /Profile A — Minimum production/);
    assert.match(capacity, /Profile B — Recommended production/);
    assert.match(capacity, /Profile C — Higher concurrency/);
    assert.match(capacity, /\(N_app \+ N_worker\)/);
    assert.doesNotMatch(capacity, /supports \d+ concurrent users/i);

    const backupRun = read("src/services/backup/run.ts");
    assert.match(backupRun, /flag:\s*"wx"/);

    const pending = read("src/domain/universal-intake/archive/pending-store.ts");
    assert.match(pending, /STORAGE_ROOT/);
    assert.match(pending, /pending-archives/);
    assert.match(pending, /session\.json/);
    assert.doesNotMatch(pending, /__bidveraArchivePending/);

    const health = read("src/app/api/health/route.ts");
    assert.match(health, /instance/);
    const ready = read("src/app/api/ready/route.ts");
    assert.match(ready, /getPublicReadyStatus/);

    const drain = read("src/services/jobs/drain-guard.ts");
    assert.match(drain, /Job drain is disabled in production/);
  });
});
