import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getPublicReadyStatus } from "@/services/production-readiness/checks";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("production readiness wiring", () => {
  it("exposes public /api/ready and keeps /api/health as liveness", () => {
    const health = readSrc("src/app/api/health/route.ts");
    assert.match(health, /ok:\s*true/);
    assert.doesNotMatch(health, /DATABASE_URL|AUTH_SECRET|password/i);

    const ready = readSrc("src/app/api/ready/route.ts");
    assert.match(ready, /getPublicReadyStatus/);
    assert.match(ready, /status:\s*result\.ready \? 200 : 503/);
    assert.doesNotMatch(ready, /DATABASE_URL|AUTH_SECRET/);
  });

  it("middleware allows /api/ready without session", () => {
    const mw = readSrc("src/middleware.ts");
    assert.match(mw, /\/api\/ready/);
  });

  it("Super Admin page is read-only and nav-linked", () => {
    const page = readSrc(
      "src/app/(super-admin)/[saKey]/(panel)/production-readiness/page.tsx",
    );
    assert.match(page, /requireSuperAdmin/);
    assert.match(page, /collectProductionReadiness/);
    assert.doesNotMatch(page, /deploy|Run production|startWorker/i);

    const shell = readSrc("src/components/super-admin/sa-shell.tsx");
    assert.match(shell, /\/production-readiness/);
  });

  it("worker touches heartbeat", () => {
    const worker = readSrc("src/worker/index.ts");
    assert.match(worker, /touchWorkerHeartbeat/);
  });

  it("checks cover payments, turnstile, backups, restore isolation, security", () => {
    const checks = readSrc("src/services/production-readiness/checks.ts");
    assert.match(checks, /checkPaypal/);
    assert.match(checks, /checkStripe/);
    assert.match(checks, /checkTurnstile/);
    assert.match(checks, /checkRestoreIsolation/);
    assert.match(checks, /isInternalPipelineSmokeDisabled/);
    assert.match(checks, /encryptBackupPayload/);
    assert.match(checks, /DUMMY_TURNSTILE/);
    assert.doesNotMatch(checks, /sk_live_REPLACE|invented|fake-success/i);
  });

  it("docs cover process architecture without inventing load-test PASS", () => {
    const docs = readSrc("docs/production-readiness.md");
    assert.match(docs, /npm run worker/);
    assert.match(docs, /\/api\/ready/);
    assert.match(docs, /systemd|PM2/);
    assert.doesNotMatch(docs, /1000 concurrent users passed|load test PASS/i);
  });

  it("deployment infra uses systemd + nginx templates without fake secrets", () => {
    const deploy = readSrc("docs/production-deployment.md");
    assert.match(deploy, /systemd/);
    assert.match(deploy, /\/api\/health/);
    assert.match(deploy, /\/api\/ready/);
    assert.match(deploy, /certbot|Let's Encrypt/i);
    assert.match(deploy, /bidvera-app@/);
    assert.match(deploy, /Production VPS multi-instance load test/);
    assert.match(deploy, /NOT EXECUTED/);
    assert.match(deploy, /production-capacity\.md/);
    assert.doesNotMatch(deploy, /sk_live_|BEGIN PRIVATE KEY|BidveraSuperAdmin1!/);
    assert.doesNotMatch(deploy, /1000 concurrent users passed|load test PASS/i);

    const appUnit = readSrc("deploy/systemd/bidvera-app.service");
    assert.match(appUnit, /npm run start/);
    const appTemplate = readSrc("deploy/systemd/bidvera-app@.service");
    assert.match(appTemplate, /PORT=%i/);
    assert.match(appTemplate, /LimitNOFILE=65535/);
    assert.match(appTemplate, /TimeoutStopSec=45/);
    const workerUnit = readSrc("deploy/systemd/bidvera-worker.service");
    assert.match(workerUnit, /npm run worker/);
    assert.doesNotMatch(workerUnit, /After=.*bidvera-app\.service/);
    const nginx = readSrc("deploy/nginx/bidvera.conf");
    assert.match(nginx, /ssl_certificate/);
    assert.match(nginx, /YOUR_DOMAIN/);
    assert.match(nginx, /127\.0\.0\.1:3001/);
    assert.match(nginx, /least_conn/);
    assert.match(nginx, /proxy_next_upstream/);
    assert.match(nginx, /client_max_body_size 130m/);
    assert.match(nginx, /proxy_read_timeout 300s/);
    assert.doesNotMatch(nginx, /BEGIN CERTIFICATE/);

    const capacity = readSrc("docs/production-capacity.md");
    assert.match(capacity, /Profile A/);
    assert.match(capacity, /Profile B/);
    assert.match(capacity, /Profile C/);
    assert.match(capacity, /PRISMA_CONNECTION_LIMIT/);
    assert.doesNotMatch(capacity, /supports \d+ concurrent users/i);
  });
});

describe("getPublicReadyStatus fail-closed (production env)", () => {
  it("returns NOT_READY when AUTH_SECRET is weak in production", async () => {
    const result = await getPublicReadyStatus({
      NODE_ENV: "production",
      AUTH_SECRET: "short",
      NEXT_PUBLIC_APP_URL: "https://example.com",
      TURNSTILE_SITE_KEY: "site",
      TURNSTILE_SECRET_KEY: "secret-that-is-not-dummy-aaaaaaaa",
      RATE_LIMIT_BACKEND: "durable",
      STORAGE_ROOT: process.env.STORAGE_ROOT,
      DATABASE_URL: process.env.DATABASE_URL,
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, "NOT_READY");
    assert.equal("DATABASE_URL" in result, false);
  });

  it("returns NOT_READY for memory rate limit in production", async () => {
    const result = await getPublicReadyStatus({
      NODE_ENV: "production",
      AUTH_SECRET: "x".repeat(32),
      NEXT_PUBLIC_APP_URL: "https://example.com",
      TURNSTILE_SITE_KEY: "site",
      TURNSTILE_SECRET_KEY: "secret-that-is-not-dummy-aaaaaaaa",
      RATE_LIMIT_BACKEND: "memory",
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, "NOT_READY");
  });

  it("returns NOT_READY when storage/backup roots missing in production", async () => {
    const result = await getPublicReadyStatus({
      NODE_ENV: "production",
      AUTH_SECRET: "x".repeat(32),
      NEXT_PUBLIC_APP_URL: "https://example.com",
      TURNSTILE_SITE_KEY: "site",
      TURNSTILE_SECRET_KEY: "secret-that-is-not-dummy-aaaaaaaa",
      RATE_LIMIT_BACKEND: "durable",
      STORAGE_ROOT: "",
      BACKUP_ROOT: "",
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, "NOT_READY");
  });
});
