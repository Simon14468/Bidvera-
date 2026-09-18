/**
 * Tender Calendar — focused module tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  TENDER_CALENDAR_FEATURE_KEY,
  TENDER_CALENDAR_MODULE_ID,
  TENDER_CALENDAR_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
  computeMilestoneStatus,
  orderByOccursAtAsc,
  parseOccurrenceInput,
  planReminderFireTimes,
  isDateOnlyString,
  formatDateOnly,
} from "@/modules/tender-calendar";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("tender-calendar module identity", () => {
  it("exposes stable module id and feature key", () => {
    assert.equal(TENDER_CALENDAR_MODULE_ID, "tender-calendar");
    assert.equal(TENDER_CALENDAR_FEATURE_KEY, "tender_calendar");
    assert.equal(TENDER_CALENDAR_MODULE_NAME, "Tender Calendar");
    assert.equal(SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX, "sa-enter:");
  });

  it("does not import analysis / compliance / qualification internals", () => {
    const service = readSrc("src/modules/tender-calendar/internal/service.ts");
    assert.doesNotMatch(
      service,
      /tender-analysis|document-compliance|supplier-qualification|tender-processing|semantic-tender|udi|canonical/,
    );
    assert.doesNotMatch(service, /prisma\.tender\./);
  });
});

describe("date-only and timezone handling", () => {
  it("preserves date-only without inventing a timezone", () => {
    const parsed = parseOccurrenceInput({ date: "2026-12-31", dateOnly: true });
    assert.equal(parsed.dateOnly, true);
    assert.equal(parsed.timezone, null);
    assert.equal(formatDateOnly(parsed.occursAt), "2026-12-31");
    assert.equal(isDateOnlyString("2026-12-31"), true);
  });

  it("preserves explicit timezone when provided with datetime", () => {
    const parsed = parseOccurrenceInput({
      dateTime: "2026-06-01T14:30",
      timezone: "Africa/Casablanca",
    });
    assert.equal(parsed.dateOnly, false);
    assert.equal(parsed.timezone, "Africa/Casablanca");
  });

  it("does not invent timezone for datetime without one", () => {
    const parsed = parseOccurrenceInput({ dateTime: "2026-06-01T14:30" });
    assert.equal(parsed.timezone, null);
    assert.equal(parsed.dateOnly, false);
  });
});

describe("deadline ordering and past status", () => {
  it("orders by occursAt ascending", () => {
    const ordered = orderByOccursAtAsc([
      { occursAt: "2026-12-01T00:00:00.000Z", id: "b" },
      { occursAt: "2026-01-01T00:00:00.000Z", id: "a" },
      { occursAt: "2026-06-15T00:00:00.000Z", id: "c" },
    ]);
    assert.deepEqual(
      ordered.map((x) => x.id),
      ["a", "c", "b"],
    );
  });

  it("marks past and due-today for date-only deadlines", () => {
    assert.equal(
      computeMilestoneStatus(new Date("2020-01-01T00:00:00.000Z"), true, new Date("2026-09-07T12:00:00.000Z")),
      "PAST",
    );
    assert.equal(
      computeMilestoneStatus(new Date("2026-09-07T00:00:00.000Z"), true, new Date("2026-09-07T12:00:00.000Z")),
      "DUE_TODAY",
    );
    assert.equal(
      computeMilestoneStatus(new Date("2026-12-01T00:00:00.000Z"), true, new Date("2026-09-07T12:00:00.000Z")),
      "SCHEDULED",
    );
  });
});

describe("reminders", () => {
  it("plans 30/14/7/3/1/same-day offsets", () => {
    const occursAt = new Date("2026-12-31T00:00:00.000Z");
    const plans = planReminderFireTimes(occursAt, {
      remind30d: true,
      remind14d: true,
      remind7d: true,
      remind3d: true,
      remind1d: true,
      remindSameDay: true,
    });
    assert.equal(plans.length, 6);
    assert.equal(plans[0]!.offset, "DAYS_30");
    assert.equal(plans[5]!.offset, "SAME_DAY");
    assert.equal(plans[5]!.fireAt.toISOString(), occursAt.toISOString());
  });

  it("respects disabled reminder settings", () => {
    const plans = planReminderFireTimes(new Date("2026-12-31T00:00:00.000Z"), {
      remind30d: false,
      remind14d: false,
      remind7d: true,
      remind3d: false,
      remind1d: false,
      remindSameDay: true,
    });
    assert.deepEqual(
      plans.map((p) => p.offset),
      ["DAYS_7", "SAME_DAY"],
    );
  });
});

describe("tenant isolation, CRUD, permissions, OFF, SA testing", () => {
  it("service scopes every query by companyId", () => {
    const service = readSrc("src/modules/tender-calendar/internal/service.ts");
    assert.match(service, /companyId: input\.companyId/);
    assert.match(service, /id: tenderId, companyId/);
    assert.match(service, /id: deadlineId, companyId/);
    assert.match(service, /duplicate event already exists/);
  });

  it("entry asserts module availability on mutations and reads", () => {
    const entry = readSrc("src/modules/tender-calendar/entry.ts");
    assert.match(entry, /assertTenderCalendarAvailable/);
    assert.ok(
      (entry.match(/assertTenderCalendarAvailable/g) ?? []).length >= 10,
    );
  });

  it("API routes block when module is OFF", () => {
    for (const rel of [
      "src/app/api/tender-calendar/tenders/route.ts",
      "src/app/api/tender-calendar/tenders/[id]/route.ts",
      "src/app/api/tender-calendar/settings/route.ts",
      "src/app/api/tender-calendar/milestones/route.ts",
    ]) {
      assert.match(readSrc(rel), /assertTenderCalendarAvailable/);
    }
  });

  it("access preserves Super Admin enter-session bypass", () => {
    const access = readSrc("src/modules/tender-calendar/access.ts");
    assert.match(access, /isSuperAdminEnterSession/);
    assert.match(access, /isVerifiedSuperAdminEnterSession/);
    assert.match(access, /enabledGlobal/);
  });

  it("exposes CRUD through public entry", () => {
    const index = readSrc("src/modules/tender-calendar/index.ts");
    assert.match(index, /createCalendarTender/);
    assert.match(index, /updateCalendarTender/);
    assert.match(index, /addCalendarDeadline/);
    assert.match(index, /removeCalendarTender/);
  });

  it("cancels scheduled alerts when cancelling deadline reminders", () => {
    const reminders = readSrc(
      "src/modules/tender-calendar/internal/reminders.ts",
    );
    assert.match(reminders, /dedupeKey: \{ startsWith: `tc:/);
    assert.match(reminders, /DISMISSED/);
    // CANCELLED must remain re-schedulable after cancel-then-schedule.
    assert.match(reminders, /CANCELLED is re-schedulable/);
    assert.doesNotMatch(
      reminders,
      /existingAlert\.status === "CANCELLED"/,
    );
  });

  it("dashboard queries upcoming and past separately", () => {
    const service = readSrc("src/modules/tender-calendar/internal/service.ts");
    assert.match(service, /occursAt: \{ gte: startOfTodayUtc \}/);
    assert.match(service, /occursAt: \{ lt: startOfTodayUtc \}/);
    assert.match(service, /cancelRemindersForDeadline\(companyId, deadlineId\)/);
  });
});
