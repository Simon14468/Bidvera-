/**
 * Localization structure & parity validator — fails CI on missing keys / empty values.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales } from "@/i18n/config";
import {
  getCoreDictionary,
  getDictionary,
} from "@/i18n/dictionaries";
import {
  appModulesByLocale,
  listAppModuleLeafPaths,
} from "@/i18n/app-modules";
import { formatMessage } from "@/i18n/format";
import { getDirection } from "@/i18n/config";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) return [prefix];
  if (typeof value !== "object") return [prefix];
  if (Array.isArray(value)) {
    if (value.length === 0) return [prefix];
    return leafPaths(value[0], `${prefix}[]`);
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(...leafPaths(v, path));
  }
  return out;
}

function leafValues(
  value: unknown,
  prefix = "",
): Array<{ path: string; value: string }> {
  if (typeof value === "string") return [{ path: prefix, value }];
  if (value === null || value === undefined || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      leafValues(item, `${prefix}[${i}]`),
    );
  }
  const out: Array<{ path: string; value: string }> = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(...leafValues(v, path));
  }
  return out;
}

const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function placeholders(s: string): string[] {
  return [...s.matchAll(PLACEHOLDER_RE)].map((m) => m[1]!).sort();
}

/** Brand / technical tokens allowed to stay Latin in translated locales. */
const ALLOWED_LATIN = [
  "Bidvera",
  "PayPal",
  "Stripe",
  "Google",
  "Microsoft",
  "OpenAI",
  "PDF",
  "OCR",
  "API",
  "KPI",
  "SSO",
  "REVIEW",
  "BID",
  "NO-BID",
  "GO",
  "Safari",
  "Edge",
  "Chrome",
  "iOS",
  "Mac",
  "Facebook",
];

function stripAllowed(s: string): string {
  let out = s;
  for (const token of ALLOWED_LATIN) {
    out = out.split(token).join("");
  }
  out = out.replace(/\{[a-zA-Z0-9_]+\}/g, "");
  out = out.replace(/[0-9]+/g, "");
  return out;
}

describe("localization parity", () => {
  it("all locales expose identical core dictionary leaf paths", () => {
    const base = leafPaths(getCoreDictionary("en")).sort();
    for (const locale of locales) {
      const paths = leafPaths(getCoreDictionary(locale)).sort();
      assert.deepEqual(
        paths,
        base,
        `core key mismatch for ${locale}`,
      );
    }
  });

  it("all locales expose identical app-module leaf paths", () => {
    const base = listAppModuleLeafPaths(appModulesByLocale.en).sort();
    for (const locale of locales) {
      const paths = listAppModuleLeafPaths(appModulesByLocale[locale]).sort();
      assert.deepEqual(paths, base, `module key mismatch for ${locale}`);
    }
  });

  it("merged getDictionary includes module keys for every locale", () => {
    for (const locale of locales) {
      const dict = getDictionary(locale);
      assert.ok(dict.app.documentCompliance.title);
      assert.ok(dict.app.supplierQualification.title);
      assert.ok(dict.app.clientRequests.title);
      assert.ok(dict.app.tenderCalendar.title);
      assert.ok(dict.app.matchedOpportunities.title);
      assert.ok(dict.app.questionnaireAssistant.title);
      assert.ok(dict.app.common.dashboardTitle);
      assert.ok(dict.app.kpi.document_compliance.title);
    }
  });

  it("no empty translation strings in any locale", () => {
    for (const locale of locales) {
      const empties = leafValues(getDictionary(locale))
        .filter((x) => x.value.trim() === "")
        .map((x) => x.path);
      assert.deepEqual(empties, [], `empty strings in ${locale}`);
    }
  });

  it("placeholders match English for translated locales", () => {
    const enLeaves = leafValues(getDictionary("en"));
    const enMap = new Map(enLeaves.map((x) => [x.path, x.value]));
    for (const locale of locales) {
      if (locale === "en") continue;
      for (const leaf of leafValues(getDictionary(locale))) {
        const enVal = enMap.get(leaf.path);
        if (!enVal) continue;
        assert.deepEqual(
          placeholders(leaf.value),
          placeholders(enVal),
          `placeholder mismatch ${locale}:${leaf.path}`,
        );
      }
    }
  });

  it("formatMessage preserves placeholders", () => {
    assert.equal(
      formatMessage("{count} analyses", { count: 3 }),
      "3 analyses",
    );
  });

  it("Arabic uses RTL; other locales LTR", () => {
    assert.equal(getDirection("ar"), "rtl");
    for (const locale of locales) {
      if (locale === "ar") continue;
      assert.equal(getDirection(locale), "ltr");
    }
  });

  it("Arabic module + critical shell strings are not leftover English UI", () => {
    const ar = getDictionary("ar");
    const critical = [
      ar.app.nav.sectionCapabilities,
      ar.app.nav.sectionWorkspace,
      ar.app.nav.sectionAccount,
      ar.app.dashboard.upcomingCalendarDeadlines,
      ar.app.dashboard.statusLocked,
      ar.app.common.lockedPlan,
      ar.app.documentCompliance.title,
      ar.app.supplierQualification.emptyCta,
      ar.app.clientRequests.createRequest,
      ar.app.tenderCalendar.addTender,
      ar.app.decisionMemory.emptyTitle,
      ar.app.decisionMemory.emptyDescriptionCompanyContext,
      ar.app.decisionMemory.openCompanyProfile,
    ];
    for (const value of critical) {
      const stripped = stripAllowed(value);
      const latin = (stripped.match(/[A-Za-z]/g) || []).length;
      const arabic = (stripped.match(/[\u0600-\u06FF]/g) || []).length;
      assert.ok(
        arabic > 0 && latin < 4,
        `unexpected English UI in Arabic: ${JSON.stringify(value)}`,
      );
    }
  });

  it("wired module pages import getDictionary", () => {
    const files = [
      "src/app/(app)/document-compliance/page.tsx",
      "src/app/(app)/supplier-qualification/page.tsx",
      "src/app/(app)/client-requests/page.tsx",
      "src/app/(app)/tender-calendar/page.tsx",
      "src/app/(app)/matched-opportunities/page.tsx",
      "src/app/(app)/questionnaire-assistant/page.tsx",
      "src/app/(app)/dashboard/page.tsx",
      "src/app/(app)/decision-memory/page.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      assert.match(src, /getDictionary/, `${rel} must use getDictionary`);
      assert.match(src, /getLocale/, `${rel} must use getLocale`);
    }
  });

  it("language switcher locales match supported set", () => {
    assert.deepEqual([...locales].sort(), ["ar", "en", "es", "fr", "zh"]);
  });
});

describe("localization hardcode heuristics (app routes)", () => {
  it("primary module entry pages avoid obvious English chrome titles", () => {
    const root = join(process.cwd(), "src/app/(app)");
    const targets = [
      "document-compliance/page.tsx",
      "supplier-qualification/page.tsx",
      "client-requests/page.tsx",
      "tender-calendar/page.tsx",
      "matched-opportunities/page.tsx",
      "questionnaire-assistant/page.tsx",
      "dashboard/page.tsx",
    ];
    const banned = [
      '"Document Compliance"',
      '"Supplier Qualification"',
      '"Client Requests"',
      '"Tender Calendar"',
      '"Matched Opportunities"',
      '"Questionnaire Assistant"',
      '"Not on your current plan"',
      '"No compliance documents yet"',
    ];
    for (const rel of targets) {
      const src = readFileSync(join(root, rel), "utf8");
      for (const b of banned) {
        assert.equal(
          src.includes(b),
          false,
          `${rel} still contains hardcoded ${b}`,
        );
      }
    }
  });
});
