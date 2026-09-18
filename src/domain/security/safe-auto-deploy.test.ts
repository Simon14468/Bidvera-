/**
 * Safe GitHub auto-deploy pipeline contracts.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import {
  scanDeployScriptsForDanger,
  scanMigrationSql,
} from "../../../scripts/migration-safety-scan";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("safe auto-deploy pipeline", () => {
  it("ships CI + staging + production workflows", () => {
    assert.ok(existsSync(join(root, ".github/workflows/ci.yml")));
    assert.ok(existsSync(join(root, ".github/workflows/deploy-staging.yml")));
    assert.ok(existsSync(join(root, ".github/workflows/deploy-production.yml")));
  });

  it("CI runs security, tsc, lint, build, and migration safety", () => {
    const ci = read(".github/workflows/ci.yml");
    assert.match(ci, /npm run test:security/);
    assert.match(ci, /npx tsc --noEmit/);
    assert.match(ci, /npm run lint/);
    assert.match(ci, /npm run build/);
    assert.match(ci, /migration-safety-scan/);
  });

  it("staging deploy is concurrency-locked and gated on CI", () => {
    const w = read(".github/workflows/deploy-staging.yml");
    assert.match(w, /concurrency:[\s\S]*group:\s*deploy-staging/);
    assert.match(w, /cancel-in-progress:\s*false/);
    assert.match(w, /needs:\s*gates/);
    assert.match(w, /branches:\s*\[staging\]/);
    assert.doesNotMatch(w, /prisma migrate reset/);
    assert.doesNotMatch(w, /DATABASE_URL=/);
    assert.doesNotMatch(w, /AUTH_SECRET=/);
  });

  it("production deploy is manual-only with confirmation phrase", () => {
    const w = read(".github/workflows/deploy-production.yml");
    assert.match(w, /workflow_dispatch/);
    assert.doesNotMatch(w, /push:/);
    assert.match(w, /deploy-production/);
    assert.match(w, /environment:\s*production/);
    assert.match(w, /concurrency:[\s\S]*group:\s*deploy-production/);
  });

  it("remote deploy uses migrate deploy, backup gate, rolling health, code-only rollback", () => {
    const sh = read("deploy/scripts/remote-deploy.sh");
    assert.match(sh, /prisma migrate deploy/);
    assert.match(sh, /deploy-backup-gate/);
    assert.match(sh, /api\/health/);
    assert.match(sh, /api\/ready/);
    assert.match(sh, /CODE ROLLBACK/);
    assert.match(sh, /database NOT rolled back/i);
    assert.doesNotMatch(sh, /migrate reset/);
    assert.doesNotMatch(sh, /db push --force-reset/);
    assert.match(sh, /STORAGE_ROOT/);
    assert.match(sh, /BACKUP_ROOT/);
    assert.match(sh, /flock/);
  });

  it("refuses sa:sync / seed / destructive company deletes in deploy scripts", () => {
    const remote = read("deploy/scripts/remote-deploy.sh");
    assert.doesNotMatch(remote, /\bsa:sync\b/);
    assert.doesNotMatch(remote, /\bdb:seed\b/);
    assert.doesNotMatch(remote, /DELETE FROM.*Company/i);
  });

  it("migration safety scanner reports clean on current tree", () => {
    assert.deepEqual(scanMigrationSql(root), []);
    assert.deepEqual(scanDeployScriptsForDanger(root), []);
  });

  it("documents operator enablement without claiming staging executed", () => {
    const docs = read("docs/safe-auto-deploy.md");
    assert.match(docs, /STAGING_SSH_HOST/);
    assert.match(docs, /prisma migrate deploy/);
    assert.match(docs, /NOT EXECUTED|not yet executed/i);
    assert.doesNotMatch(docs, /supports \d+ concurrent users/i);
  });
});
