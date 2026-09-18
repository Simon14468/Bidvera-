/**
 * Regression: tender_analysis is internal/admin-only — not a user plan entitlement.
 * Pure catalog + source checks (no DB). Does not hide other active features.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  ADMIN_ENTITLEMENT_KEYS,
  ENTITLEMENT_CATALOG,
  buildEntitlementMarketingLabels,
  isCommerciallyAvailableFeature,
  planDefaultFeatureKeys,
} from "@/domain/billing/entitlement-catalog";
import { publicEnabledFeatureKeys } from "@/services/billing/catalog";
import { PRICING_FEATURE_GROUPS } from "@/components/marketing/pricing-feature-groups";

const USER_FACING_ACTIVE = [
  "company_profile",
  "document_compliance",
  "supplier_qualification",
  "tender_calendar",
  "client_requests",
  "evidence_intelligence",
  "advanced_decision_engine",
  "decision_memory",
  "decision_simulator",
  "explainable_decision",
  "questionnaire_assistant",
  "smart_alerts",
  "team_collaboration",
  "pdf_export",
  "tender_action_plan",
] as const;

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("1. tender_analysis is not commercially available for user catalog", () => {
  assert.equal(isCommerciallyAvailableFeature("tender_analysis"), false);
  const def = ENTITLEMENT_CATALOG.find((e) => e.key === "tender_analysis");
  assert.ok(def);
  assert.equal(def!.commerciallyAvailable, false);
});

test("1b. publicEnabledFeatureKeys never surfaces tender_analysis", () => {
  const withStaleRow = publicEnabledFeatureKeys({
    slug: "pro",
    planFeatures: [
      { enabled: true, feature: { key: "tender_analysis" } },
      { enabled: true, feature: { key: "company_profile" } },
      { enabled: true, feature: { key: "document_compliance" } },
    ],
  } as Parameters<typeof publicEnabledFeatureKeys>[0]);
  assert.equal(withStaleRow.includes("tender_analysis"), false);
  assert.ok(withStaleRow.includes("company_profile"));
  assert.ok(withStaleRow.includes("document_compliance"));

  for (const slug of ["free", "trial", "starter", "pro", "business"] as const) {
    const keys = publicEnabledFeatureKeys({ slug } as Parameters<
      typeof publicEnabledFeatureKeys
    >[0]);
    assert.equal(keys.includes("tender_analysis"), false, slug);
  }
});

test("2. no normal subscription plan default grants tender_analysis", () => {
  for (const slug of Object.keys({
    free: 1,
    trial: 1,
    starter: 1,
    pro: 1,
    business: 1,
  })) {
    assert.equal(
      planDefaultFeatureKeys(slug).includes("tender_analysis"),
      false,
      slug,
    );
  }
});

test("3. plan editor / sellable admin keys cannot activate tender_analysis", () => {
  assert.equal(ADMIN_ENTITLEMENT_KEYS.includes("tender_analysis"), false);
  const planService = readSrc("src/application/admin/plan-service.ts");
  assert.match(planService, /setPlanFeature\(planId, "tender_analysis", false\)/);
  assert.match(planService, /ADMIN_ENTITLEMENT_KEYS/);
});

test("3b. marketing labels never list tender_analysis", () => {
  const { labels } = buildEntitlementMarketingLabels({
    analysesLimit: 10,
    seatsLimit: 3,
    enabledKeys: ["tender_analysis", "company_profile", "pdf_export"],
  });
  assert.equal(
    labels.some((l) => /tender analysis/i.test(l)),
    false,
  );
  assert.ok(labels.some((l) => /pdf/i.test(l)));
});

test("4. Super Admin Features page still lists DB features (module intact)", () => {
  const page = readSrc("src/app/(super-admin)/[saKey]/(panel)/features/page.tsx");
  assert.match(page, /listFeatures/);
  assert.match(page, /FeatureToggleRow/);
  assert.doesNotMatch(page, /commerciallyAvailable|ADMIN_ENTITLEMENT_KEYS/);
  const entitlements = readSrc("src/services/entitlements/index.ts");
  assert.match(entitlements, /export async function listFeatures/);
  assert.match(entitlements, /ensureFeatureRows/);
  assert.ok(
    ENTITLEMENT_CATALOG.some((e) => e.key === "tender_analysis"),
    "catalog row must remain for SA upsert",
  );
});

test("5. /tenders module + access helpers remain for internal/admin use", () => {
  assert.ok(existsSync(path.join(process.cwd(), "src/app/(app)/tenders")));
  const access = readSrc("src/modules/tender-analysis/access.ts");
  assert.match(access, /isTenderAnalysisAvailable/);
  assert.match(access, /isSuperAdminEnterSession/);
  assert.match(access, /hasFeature\(companyId, TENDER_ANALYSIS_FEATURE_KEY\)/);
  // SA enter must bypass plan denial (module is not sold on plans).
  assert.match(
    access,
    /if \(await isSuperAdminEnterSession\(\)\) return true/,
  );
  const guard = readSrc("src/modules/tender-analysis/guard.ts");
  assert.match(guard, /isTenderAnalysisAvailable/);
  const constants = readSrc("src/modules/tender-analysis/constants.ts");
  assert.match(constants, /tender_analysis/);
});

test("6. other active user-facing features stay commercially available + on plans", () => {
  for (const key of USER_FACING_ACTIVE) {
    assert.equal(
      isCommerciallyAvailableFeature(key),
      true,
      `${key} must remain commercially available`,
    );
    assert.ok(
      ADMIN_ENTITLEMENT_KEYS.includes(key),
      `${key} must stay in plan editor`,
    );
  }
  const pro = planDefaultFeatureKeys("pro");
  for (const key of [
    "document_compliance",
    "supplier_qualification",
    "client_requests",
    "evidence_intelligence",
    "decision_simulator",
    "explainable_decision",
    "questionnaire_assistant",
    "smart_alerts",
    "team_collaboration",
    "pdf_export",
    "tender_action_plan",
    "tender_calendar",
  ] as const) {
    assert.ok(pro.includes(key), `pro must still include ${key}`);
  }
  const pricingKeys = PRICING_FEATURE_GROUPS.flatMap((g) => g.keys);
  assert.equal(pricingKeys.includes("tender_analysis"), false);
  assert.ok(pricingKeys.includes("company_profile"));
  assert.ok(pricingKeys.includes("tender_calendar"));
});

test("company chrome never surfaces tender_analysis while commercially unavailable", () => {
  assert.equal(isCommerciallyAvailableFeature("tender_analysis"), false);
  const layout = readSrc("src/app/(app)/layout.tsx");
  const sidebar = readSrc("src/components/app/app-sidebar.tsx");
  const dash = readSrc("src/app/(app)/dashboard/page.tsx");
  assert.match(layout, /isCommerciallyAvailableFeature\("tender_analysis"\)/);
  assert.match(
    sidebar,
    /entitlement:\s*"tenderAnalysis"[\s\S]*?hideWhenDisabled:\s*true/,
  );
  assert.match(dash, /isCommerciallyAvailableFeature\("tender_analysis"\)/);
});

test("ensureFeatureRows is memoized once per process (avoids pool storms)", () => {
  const src = readSrc("src/services/entitlements/index.ts");
  assert.match(src, /let featureRowsReady/);
  assert.match(src, /if \(!featureRowsReady\)/);
  assert.match(src, /prisma\.\$transaction/);
  assert.match(src, /featureRowsReady = null/);
});

test("entitlement resolution fallbacks no longer hard-grant tender_analysis", () => {
  const src = readSrc("src/services/entitlements/index.ts");
  assert.doesNotMatch(src, /tender_analysis:\s*true/);
  assert.doesNotMatch(src, /features\.tender_analysis\s*=\s*true/);
});
