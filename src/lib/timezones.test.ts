import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertValidCompanyTimezone,
  buildTimezoneOptions,
  detectBrowserTimeZone,
  formatTimezoneFriendlyLabel,
  formatTimezoneOffset,
  isUnsetCompanyTimezone,
  isValidIanaTimeZone,
  listIanaTimeZones,
  resolveSuggestedCompanyTimezone,
  timezoneCity,
  timezoneRegion,
} from "@/lib/timezones";
import { notificationPrefsSchema } from "@/services/notifications/prefs";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("listIanaTimeZones includes UTC and major cities from runtime", () => {
  const zones = listIanaTimeZones();
  assert.ok(zones.includes("UTC"));
  assert.ok(zones.length > 50, `expected broad IANA set, got ${zones.length}`);
  for (const id of [
    "Africa/Casablanca",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Dubai",
    "Asia/Tokyo",
  ]) {
    assert.ok(zones.includes(id), id);
  }
});

test("isValidIanaTimeZone accepts IANA ids and rejects junk", () => {
  assert.equal(isValidIanaTimeZone("Africa/Casablanca"), true);
  assert.equal(isValidIanaTimeZone("UTC"), true);
  assert.equal(isValidIanaTimeZone("Not/A_Zone"), false);
  assert.equal(isValidIanaTimeZone(""), false);
  assert.equal(isValidIanaTimeZone("'; DROP TABLE"), false);
});

test("assertValidCompanyTimezone accepts valid and rejects invalid", () => {
  assert.equal(assertValidCompanyTimezone("Europe/Paris"), "Europe/Paris");
  assert.throws(() => assertValidCompanyTimezone("Mars/Olympus"));
});

test("timezone display helpers derive city, region, friendly label, and offset", () => {
  assert.equal(timezoneCity("America/New_York"), "New York");
  assert.equal(timezoneRegion("America/New_York"), "America");
  assert.equal(timezoneRegion("UTC"), "UTC");
  assert.equal(
    formatTimezoneFriendlyLabel("Africa/Casablanca"),
    "Africa — Casablanca (Africa/Casablanca)",
  );
  const offset = formatTimezoneOffset("UTC", new Date("2026-06-15T12:00:00.000Z"));
  assert.match(offset, /^UTC[+-]\d{2}:\d{2}$/);
  assert.equal(offset, "UTC+00:00");
});

test("buildTimezoneOptions groups regions and stays searchable", () => {
  const options = buildTimezoneOptions(new Date("2026-01-15T12:00:00.000Z"));
  const casa = options.find((o) => o.value === "Africa/Casablanca");
  assert.ok(casa);
  assert.equal(casa.city, "Casablanca");
  assert.equal(casa.region, "Africa");
  assert.equal(casa.label, "Africa — Casablanca (Africa/Casablanca)");
  assert.match(casa.offsetLabel, /^UTC[+-]\d{2}:\d{2}$/);
  assert.match(casa.searchText.toLowerCase(), /casablanca/);

  const regions = [...new Set(options.map((o) => o.region))];
  assert.ok(regions.includes("Africa"));
  assert.ok(regions.includes("America"));
  assert.ok(regions.includes("Europe"));
  assert.ok(regions.includes("UTC"));

  const africa = options.filter((o) => o.region === "Africa");
  const cities = africa.map((o) => o.city);
  assert.deepEqual(cities, [...cities].sort((a, b) => a.localeCompare(b)));
});

test("browser detection wins for picker suggestion; falls back to saved", () => {
  assert.equal(isUnsetCompanyTimezone(""), true);
  assert.equal(isUnsetCompanyTimezone("  "), true);
  assert.equal(isUnsetCompanyTimezone("Asia/Tokyo"), false);

  assert.deepEqual(
    resolveSuggestedCompanyTimezone({
      savedTimezone: "",
      detectedTimezone: "Africa/Casablanca",
    }),
    { timezone: "Africa/Casablanca", usedDetection: true },
  );

  // Detected browser zone should switch the field immediately, even if a
  // previous company timezone was saved (still not persisted until Save).
  assert.deepEqual(
    resolveSuggestedCompanyTimezone({
      savedTimezone: "Asia/Tokyo",
      detectedTimezone: "Africa/Casablanca",
    }),
    { timezone: "Africa/Casablanca", usedDetection: true },
  );

  assert.deepEqual(
    resolveSuggestedCompanyTimezone({
      savedTimezone: "Asia/Tokyo",
      detectedTimezone: null,
    }),
    { timezone: "Asia/Tokyo", usedDetection: false },
  );
});

test("detectBrowserTimeZone is SSR-safe (no window → null)", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(detectBrowserTimeZone(), null);
});

test("notification prefs schema rejects invalid timezone on save path", () => {
  assert.throws(() =>
    notificationPrefsSchema.parse({
      timezone: "Mars/Olympus",
      inAppEnabled: true,
      emailEnabled: true,
      whatsappEnabled: false,
      smsEnabled: false,
      pushEnabled: false,
      deadlineAlert7d: true,
      deadlineAlert3d: true,
      deadlineAlert24h: true,
      deadlineAlertPassed: true,
      highRiskAlerts: true,
      decisionAlerts: true,
      missingDocAlerts: true,
      scoreChangeAlerts: true,
      requirementAlerts: true,
      decisionMemoryAlerts: true,
      workflowAlerts: true,
    }),
  );
  const ok = notificationPrefsSchema.parse({
    timezone: "Asia/Tokyo",
    inAppEnabled: true,
    emailEnabled: true,
    whatsappEnabled: false,
    smsEnabled: false,
    pushEnabled: false,
    deadlineAlert7d: true,
    deadlineAlert3d: true,
    deadlineAlert24h: true,
    deadlineAlertPassed: true,
    highRiskAlerts: true,
    decisionAlerts: true,
    missingDocAlerts: true,
    scoreChangeAlerts: true,
    requirementAlerts: true,
    decisionMemoryAlerts: true,
    workflowAlerts: true,
  });
  assert.equal(ok.timezone, "Asia/Tokyo");
});

test("settings timezone UI detects browser zone client-side only", () => {
  const form = readSrc("src/components/settings/notification-prefs-form.tsx");
  assert.match(form, /TimezonePicker/);
  assert.match(form, /detectBrowserTimeZone/);
  assert.match(form, /resolveSuggestedCompanyTimezone/);
  assert.match(form, /useSyncExternalStore/);
  assert.doesNotMatch(form, /const TIMEZONES\s*=/);
  assert.doesNotMatch(form, /<select[\s\S]*timezone/);

  const picker = readSrc("src/components/ui/timezone-picker.tsx");
  assert.match(picker, /SearchableCombobox/);
  assert.match(picker, /buildTimezoneOptions/);
  assert.match(picker, /Globe2/);
  assert.match(picker, /optionsCache/);

  const helpers = readSrc("src/lib/timezones.ts");
  assert.match(helpers, /supportedValuesOf\("timeZone"\)/);
  assert.match(helpers, /isValidIanaTimeZone/);
  assert.match(helpers, /typeof window === "undefined"/);
  assert.match(helpers, /formatTimezoneFriendlyLabel/);

  const prefs = readSrc("src/services/notifications/prefs.ts");
  assert.match(prefs, /isValidIanaTimeZone/);
  assert.match(prefs, /timezone: ""/);
});
