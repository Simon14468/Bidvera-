/**
 * Client Requests Portal — module tests (pure + structural).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CLIENT_REQUESTS_FEATURE_KEY,
  CLIENT_REQUESTS_MODULE_ID,
  CLIENT_REQUESTS_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
  calcProgressPercent,
  deriveRequestStatus,
  formatDateOnly,
  isDeadlinePassed,
  parseDateOnlyDeadline,
  planClientRequestReminderFireTimes,
} from "@/modules/client-requests";
import {
  ENTITLEMENT_FEATURE_KEYS,
  PLAN_ENTITLEMENT_DEFAULTS,
} from "@/domain/billing/entitlement-catalog";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("client-requests module identity", () => {
  it("exposes stable module id and feature key", () => {
    assert.equal(CLIENT_REQUESTS_MODULE_ID, "client-requests");
    assert.equal(CLIENT_REQUESTS_FEATURE_KEY, "client_requests");
    assert.equal(CLIENT_REQUESTS_MODULE_NAME, "Client Requests");
    assert.equal(SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX, "sa-enter:");
  });

  it("is registered in entitlement catalog and paid plan defaults", () => {
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("client_requests"));
    assert.ok(PLAN_ENTITLEMENT_DEFAULTS.starter!.includes("client_requests"));
    assert.ok(PLAN_ENTITLEMENT_DEFAULTS.pro!.includes("client_requests"));
    assert.ok(PLAN_ENTITLEMENT_DEFAULTS.business!.includes("client_requests"));
    assert.ok(!PLAN_ENTITLEMENT_DEFAULTS.trial!.includes("client_requests"));
  });

  it("does not import Tender Analysis internals", () => {
    const service = readSrc("src/modules/client-requests/internal/service.ts");
    assert.doesNotMatch(
      service,
      /tender-analysis|tender-processing|semantic-tender|udi|canonical-snapshot/,
    );
    assert.doesNotMatch(service, /prisma\.tender\./);
  });

  it("wires sidebar lock and public share allowlist", () => {
    const sidebar = readSrc("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /clientRequests/);
    assert.match(sidebar, /\/client-requests/);
    const middleware = readSrc("src/middleware.ts");
    assert.match(middleware, /\/share\/client-request\//);
    assert.match(middleware, /\/api\/share\/client-request\//);
  });
});

describe("progress calculation", () => {
  it("computes percent from completed items", () => {
    assert.equal(calcProgressPercent(0, 4), 0);
    assert.equal(calcProgressPercent(3, 4), 75);
    assert.equal(calcProgressPercent(4, 4), 100);
    assert.equal(calcProgressPercent(1, 0), 0);
  });
});

describe("status derivation", () => {
  const deadlineFuture = new Date("2099-01-01T00:00:00.000Z");
  const deadlinePast = new Date("2020-01-01T00:00:00.000Z");
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("starts PENDING when nothing completed", () => {
    assert.equal(
      deriveRequestStatus({
        cancelled: false,
        totalItems: 3,
        completedItems: 0,
        deadline: deadlineFuture,
        deadlineDateOnly: true,
        now,
      }),
      "PENDING",
    );
  });

  it("moves to IN_PROGRESS when some items completed", () => {
    assert.equal(
      deriveRequestStatus({
        cancelled: false,
        totalItems: 4,
        completedItems: 1,
        deadline: deadlineFuture,
        deadlineDateOnly: true,
        now,
      }),
      "IN_PROGRESS",
    );
  });

  it("completes when all items done", () => {
    assert.equal(
      deriveRequestStatus({
        cancelled: false,
        totalItems: 4,
        completedItems: 4,
        deadline: deadlinePast,
        deadlineDateOnly: true,
        now,
      }),
      "COMPLETED",
    );
  });

  it("marks OVERDUE when deadline passed while incomplete", () => {
    assert.equal(
      deriveRequestStatus({
        cancelled: false,
        totalItems: 4,
        completedItems: 2,
        deadline: deadlinePast,
        deadlineDateOnly: true,
        now,
      }),
      "OVERDUE",
    );
  });

  it("keeps CANCELLED sticky", () => {
    assert.equal(
      deriveRequestStatus({
        cancelled: true,
        totalItems: 4,
        completedItems: 4,
        deadline: deadlineFuture,
        deadlineDateOnly: true,
        now,
      }),
      "CANCELLED",
    );
  });
});

describe("deadline helpers", () => {
  it("parses date-only deadlines as UTC midnight", () => {
    const d = parseDateOnlyDeadline("2026-09-20");
    assert.equal(formatDateOnly(d), "2026-09-20");
    assert.equal(d.getUTCHours(), 0);
  });

  it("detects passed date-only deadlines without inventing timezones", () => {
    assert.equal(
      isDeadlinePassed(
        new Date("2026-09-09T00:00:00.000Z"),
        true,
        new Date("2026-09-10T15:00:00.000Z"),
      ),
      true,
    );
    assert.equal(
      isDeadlinePassed(
        new Date("2026-09-10T00:00:00.000Z"),
        true,
        new Date("2026-09-10T15:00:00.000Z"),
      ),
      false,
    );
  });
});

describe("reminder planning", () => {
  it("plans 14/7/3/1/same-day offsets", () => {
    const deadline = new Date("2026-10-15T00:00:00.000Z");
    const plans = planClientRequestReminderFireTimes(deadline);
    assert.equal(plans.length, 5);
    assert.deepEqual(
      plans.map((p) => p.offset),
      ["DAYS_14", "DAYS_7", "DAYS_3", "DAYS_1", "SAME_DAY"],
    );
    assert.equal(plans[0]!.fireAt.toISOString().slice(0, 10), "2026-10-01");
    assert.equal(plans[4]!.fireAt.toISOString().slice(0, 10), "2026-10-15");
  });
});

describe("API and share security conventions", () => {
  it("API routes assert module availability and use session companyId", () => {
    const route = readSrc("src/app/api/client-requests/route.ts");
    assert.match(route, /requireCompanyIdApi/);
    assert.match(route, /assertClientRequestsAvailable/);
    assert.doesNotMatch(route, /body\.companyId/);
  });

  it("share resolver stores hashed tokens and supports revoke", () => {
    const service = readSrc("src/modules/client-requests/internal/service.ts");
    assert.match(service, /hashToken/);
    assert.match(service, /revokedAt/);
    assert.match(service, /tokenHash/);
    assert.match(service, /CLIENT_REQUEST_SHARE_TTL_MS|ttlDays/);
  });

  it("links compliance and supplier evidence by reference only", () => {
    const service = readSrc("src/modules/client-requests/internal/service.ts");
    assert.match(service, /complianceDocumentId/);
    assert.match(service, /supplierEvidenceId/);
    assert.match(service, /COMPANY_PROFILE/);
    assert.doesNotMatch(service, /putObject/);
  });

  it("cancels reminders with cr: dedupe prefix", () => {
    const reminders = readSrc("src/modules/client-requests/internal/reminders.ts");
    assert.match(reminders, /cr:\$\{companyId\}:\$\{requestId\}:/);
    assert.match(reminders, /createInAppAlert/);
    assert.match(reminders, /CANCELLED/);
  });
});
