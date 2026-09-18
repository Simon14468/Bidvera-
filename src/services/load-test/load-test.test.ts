import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertLoadTestTargetSafe,
  isBlockedProductionHost,
  hostnameFromUrl,
} from "@/services/load-test/safety";
import {
  evaluateLoadTestVerdict,
  loadTestReportSchema,
  toPublicLoadTestSnapshot,
} from "@/services/load-test/report";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("load-test safety", () => {
  it("blocks production-like hosts", () => {
    assert.equal(isBlockedProductionHost("localhost"), false);
    assert.equal(isBlockedProductionHost("postgres"), false);
    assert.equal(isBlockedProductionHost("ep-xxx.neon.tech"), true);
    assert.equal(isBlockedProductionHost("app.bidvera.com"), true);
    assert.equal(hostnameFromUrl("http://localhost:3100"), "localhost");
  });

  it("refuses unsafe DATABASE_URL / app URL", () => {
    assert.throws(() =>
      assertLoadTestTargetSafe({
        databaseUrl: "postgresql://u:p@ep-x.neon.tech/db",
        appUrl: "http://localhost:3100",
        loadTestMode: "1",
      }),
    );
    assert.doesNotThrow(() =>
      assertLoadTestTargetSafe({
        databaseUrl: "postgresql://bidvera:x@localhost:5433/bidvera_load",
        appUrl: "http://localhost:3100",
        loadTestMode: "1",
      }),
    );
  });
});

describe("load-test report verdict", () => {
  const base = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    environment: "docker-load-test",
    baseUrl: "http://localhost:3100",
    concurrentUsersTarget: 1000,
    concurrentUsersReached: 1000,
    holdSeconds: 180,
    durationMs: 600_000,
    http: {
      requests: 50_000,
      failed: 10,
      errorRate: 0.0002,
      rpsPeak: 120,
      rpsAvg: 100,
      p50Ms: 200,
      p95Ms: 900,
      p99Ms: 1500,
      status4xx: 5,
      status5xx: 0,
      timeouts: 0,
    },
    thresholds: { errorRateMax: 0.01, p95MsMax: 2000, p99MsMax: 5000 },
    bottlenecks: ["None"],
    recommendedResources: ["4 vCPU"],
    notes: [],
  };

  it("PASS only when thresholds and VU target are met", () => {
    assert.equal(evaluateLoadTestVerdict(base), "PASS");
  });

  it("FAIL when concurrent users not reached", () => {
    assert.equal(
      evaluateLoadTestVerdict({ ...base, concurrentUsersReached: 500 }),
      "FAIL",
    );
  });

  it("WARNING when latency exceeds threshold", () => {
    assert.equal(
      evaluateLoadTestVerdict({
        ...base,
        http: { ...base.http, p95Ms: 3000 },
      }),
      "WARNING",
    );
  });

  it("public snapshot never includes session tokens or DB URLs", () => {
    const report = loadTestReportSchema.parse({ ...base, verdict: "PASS" });
    const snap = toPublicLoadTestSnapshot(report);
    const blob = JSON.stringify(snap);
    assert.equal(blob.includes("sessionToken"), false);
    assert.equal(blob.includes("postgresql://"), false);
    assert.equal(snap.available, true);
    if (snap.available) assert.equal(snap.verdict, "PASS");
  });

  it("NOT_RUN when no report", () => {
    const snap = toPublicLoadTestSnapshot(null);
    assert.equal(snap.available, false);
    assert.equal(snap.verdict, "NOT_RUN");
  });
});

describe("load-test wiring", () => {
  it("Super Admin page is read-only and does not expose a run button", () => {
    const page = readSrc("src/app/(super-admin)/[saKey]/(panel)/load-test/page.tsx");
    assert.match(page, /requireSuperAdmin/);
    assert.match(page, /readLoadTestReport/);
    assert.doesNotMatch(page, /saRunLoadTest|Run load test/);
    const ui = readSrc("src/components/super-admin/load-test-admin.tsx");
    assert.doesNotMatch(ui, /Run load test|startLoadTest/);
    const shell = readSrc("src/components/super-admin/sa-shell.tsx");
    assert.match(shell, /\/load-test/);
  });

  it("compose refuses production and documents k6", () => {
    const compose = readSrc("load-test/docker-compose.yml");
    assert.match(compose, /grafana\/k6/);
    assert.match(compose, /LOAD_TEST_MODE/);
    assert.doesNotMatch(compose, /neon\.tech|bidvera\.com/);
  });

  it("multi-instance compose has nginx upstream of three apps + worker", () => {
    const compose = readSrc("load-test/docker-compose.multi.yml");
    assert.match(compose, /app1:/);
    assert.match(compose, /app2:/);
    assert.match(compose, /app3:/);
    assert.match(compose, /worker:/);
    assert.match(compose, /nginx:/);
    assert.match(compose, /bidvera-load-multi-app:latest/);
    assert.match(compose, /PRISMA_CONNECTION_LIMIT:\s*"15"/);
    assert.match(compose, /RATE_LIMIT_BACKEND:\s*durable/);
    assert.match(compose, /max_connections=200/);
    assert.doesNotMatch(compose, /neon\.tech|bidvera\.com|STRIPE_SECRET_KEY:\s*sk_/);
    const nginx = readSrc("load-test/nginx/nginx.conf");
    assert.match(nginx, /upstream bidvera_next/);
    assert.match(nginx, /server app1:3000/);
    assert.match(nginx, /server app2:3000/);
    assert.match(nginx, /server app3:3000/);
  });
});
