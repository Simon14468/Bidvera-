import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  ADMIN_ENTITLEMENT_KEYS,
  UNSHIPPED_ENTITLEMENT_KEYS,
  buildEntitlementMarketingLabels,
  buildFeatureMapFromEnabledKeys,
  canonicalFeatureKey,
  filterCommerciallyHonestLabels,
  isCommerciallyAvailableFeature,
  isFeatureEnabledInMap,
  planDefaultFeatureKeys,
  upgradeMessageForFeature,
} from "@/domain/billing/entitlement-catalog";
import { AppError, ErrorCode } from "@/lib/errors";

const PREMIUM_KEYS = [
  "decision_simulator",
  "evidence_intelligence",
  "explainable_decision",
  "advanced_ai_trust",
  "tender_action_plan",
] as const;

function readSrc(relativePath: string): string {
  return readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8",
  );
}

test("premium feature keys are in admin catalog and plan defaults", () => {
  for (const key of PREMIUM_KEYS) {
    assert.ok(ADMIN_ENTITLEMENT_KEYS.includes(key), `${key} missing from admin`);
  }
  const proKeys = planDefaultFeatureKeys("pro");
  for (const key of PREMIUM_KEYS) {
    assert.ok(proKeys.includes(key), `pro should include ${key}`);
  }
});

test("free workspace is limited and does not activate Matching Engine", () => {
  const free = planDefaultFeatureKeys("free");
  assert.ok(free.includes("company_profile"));
  assert.ok(free.includes("document_compliance"));
  assert.equal(free.includes("matching_engine"), false);
  assert.equal(free.includes("tender_analysis"), false);
  assert.equal(free.includes("decision_simulator"), false);
  assert.equal(isCommerciallyAvailableFeature("matching_engine"), false);
});

test("trial plan excludes premium capabilities (same entitlement system)", () => {
  const trialKeys = planDefaultFeatureKeys("trial");
  for (const key of PREMIUM_KEYS) {
    assert.equal(
      trialKeys.includes(key),
      false,
      `trial must not include ${key}`,
    );
  }
  assert.equal(trialKeys.includes("tender_analysis"), false);
  assert.ok(trialKeys.includes("advanced_decision_engine"));
});

test("starter includes evidence + explainable but not simulator or action plan", () => {
  const starter = planDefaultFeatureKeys("starter");
  assert.ok(starter.includes("evidence_intelligence"));
  assert.ok(starter.includes("explainable_decision"));
  assert.equal(starter.includes("decision_simulator"), false);
  assert.equal(starter.includes("tender_action_plan"), false);
  assert.equal(starter.includes("advanced_ai_trust"), false);
});

test("upgrade to pro enables pro-only premium features", () => {
  const starterMap = buildFeatureMapFromEnabledKeys(planDefaultFeatureKeys("starter"));
  const proMap = buildFeatureMapFromEnabledKeys(planDefaultFeatureKeys("pro"));
  const proOnly = ["decision_simulator", "advanced_ai_trust", "tender_action_plan"];
  for (const key of proOnly) {
    assert.equal(isFeatureEnabledInMap(starterMap, key), false, key);
    assert.equal(isFeatureEnabledInMap(proMap, key), true, key);
  }
  assert.equal(isFeatureEnabledInMap(starterMap, "evidence_intelligence"), true);
  assert.equal(isFeatureEnabledInMap(proMap, "evidence_intelligence"), true);
});

test("downgrade removes premium access without deleting stored data paths", () => {
  const proMap = buildFeatureMapFromEnabledKeys(planDefaultFeatureKeys("pro"));
  const starterMap = buildFeatureMapFromEnabledKeys(planDefaultFeatureKeys("starter"));
  assert.equal(isFeatureEnabledInMap(proMap, "tender_action_plan"), true);
  assert.equal(isFeatureEnabledInMap(starterMap, "tender_action_plan"), false);
  const processing = readSrc("src/services/tender-processing/index.ts");
  assert.match(processing, /entitlement_disabled/);
  assert.doesNotMatch(processing, /deleteMany.*actionPlan/i);
});

test("enabled feature passes isFeatureEnabledInMap", () => {
  const map = buildFeatureMapFromEnabledKeys(["decision_simulator"]);
  assert.equal(isFeatureEnabledInMap(map, "decision_simulator"), true);
});

test("disabled feature fails isFeatureEnabledInMap (deny by default)", () => {
  const map = buildFeatureMapFromEnabledKeys(["tender_analysis"]);
  assert.equal(isFeatureEnabledInMap(map, "decision_simulator"), false);
});

test("assertFeature uses safe upgrade message without internals", () => {
  const msg = upgradeMessageForFeature("decision_simulator");
  assert.match(msg, /Decision Simulator/i);
  assert.match(msg, /Upgrade/i);
  assert.doesNotMatch(msg, /prisma|PlanFeature|database/i);
});

test("application layers enforce server-side assertFeature at boundaries", () => {
  const files = [
    "src/application/decision-simulator.ts",
    "src/application/evidence-intelligence.ts",
    "src/application/explainable-decision.ts",
    "src/application/tender-action-plan.ts",
    "src/application/company-service.ts",
  ];
  for (const file of files) {
    const src = readSrc(file);
    assert.match(src, /assertFeature\(companyId/, `${file} must call assertFeature`);
  }
  assert.match(
    readSrc("src/application/company-service.ts"),
    /assertFeature\(companyId, "company_profile"\)/,
  );
});

test("advanced_ai_trust gates diagnostics only — fundamental ai-trust guards remain", () => {
  const explainable = readSrc("src/application/explainable-decision.ts");
  assert.match(explainable, /assertAiAssistReadOnly/);
  assert.match(explainable, /advancedAiTrust/);
  assert.match(explainable, /access\.advancedAiTrust/);

  const simulator = readSrc("src/application/decision-simulator.ts");
  assert.match(simulator, /assertAiAssistReadOnly/);
  assert.doesNotMatch(simulator, /advanced_ai_trust/);
});

test("tender action plan preserves tenant isolation when entitled", () => {
  const src = readSrc("src/application/tender-action-plan.ts");
  assert.match(src, /assertTenantResourceScope/);
  assert.match(src, /tender_action_plan/);
});

test("FORBIDDEN entitlement error shape for UI-safe responses", () => {
  const err = new AppError(
    ErrorCode.FORBIDDEN,
    upgradeMessageForFeature("evidence_intelligence"),
    403,
  );
  assert.equal(err.code, ErrorCode.FORBIDDEN);
  assert.equal(err.status, 403);
});

test("super admin plan editor keys include all premium capabilities", () => {
  for (const key of PREMIUM_KEYS) {
    assert.ok(
      ADMIN_ENTITLEMENT_KEYS.includes(key),
      `PlanEditor must expose ${key}`,
    );
  }
});

test("PlanFeature rows are authoritative — no slug-default backfill of unchecked keys", () => {
  // Mirrors runtime: only explicitly enabled PlanFeature keys grant access.
  const mappedEnabled = ["company_profile", "pdf_export"];
  const features = buildFeatureMapFromEnabledKeys(mappedEnabled);
  assert.equal(isFeatureEnabledInMap(features, "company_profile"), true);
  assert.equal(isFeatureEnabledInMap(features, "pdf_export"), true);
  assert.equal(
    isFeatureEnabledInMap(features, "client_requests"),
    false,
    "unchecked plan modules must stay off even if slug defaults include them",
  );
  assert.equal(isFeatureEnabledInMap(features, "decision_simulator"), false);
});

test("seed script uses canonical planDefaultFeatureKeys (single source of truth)", () => {
  const seed = readSrc("scripts/seed-plan-entitlements.ts");
  assert.match(seed, /planDefaultFeatureKeys/);
  assert.doesNotMatch(seed, /const DEFAULTS/);
});

test("unshipped entitlements are not sold on plans or in admin checkboxes", () => {
  for (const key of UNSHIPPED_ENTITLEMENT_KEYS) {
    assert.equal(isCommerciallyAvailableFeature(key), false, key);
    assert.equal(ADMIN_ENTITLEMENT_KEYS.includes(key), false, key);
    for (const slug of ["trial", "starter", "pro", "business"] as const) {
      assert.equal(
        planDefaultFeatureKeys(slug).includes(key),
        false,
        `${slug} must not include ${key}`,
      );
    }
  }
});

test("marketing labels never advertise unshipped capabilities", () => {
  const { labels, displayOnly } = buildEntitlementMarketingLabels({
    analysesLimit: 75,
    seatsLimit: 5,
    enabledKeys: [
      ...planDefaultFeatureKeys("business"),
      ...UNSHIPPED_ENTITLEMENT_KEYS,
    ],
    displayOnlyExtras: [
      "Priority processing",
      "Exportable decision packs",
      "Analytics",
      "Proposal assistance",
      "Tender discovery",
      "Custom badge text",
    ],
  });
  const all = [...labels, ...displayOnly];
  for (const banned of [
    "Priority processing",
    "Exportable decision packs",
    "Analytics",
    "Proposal assistance",
    "Tender discovery",
  ]) {
    assert.equal(all.includes(banned), false, banned);
  }
  assert.ok(all.includes("Custom badge text"));
  assert.ok(labels.includes("Decision Memory"));
  assert.ok(labels.includes("Decision Simulator"));
  assert.deepEqual(
    filterCommerciallyHonestLabels(["Priority processing", "PDF decision reports"]),
    ["PDF decision reports"],
  );
});

test("alerts page and sidebar gate Smart Alerts via entitlements", () => {
  const alertsPage = readSrc("src/app/(app)/alerts/page.tsx");
  assert.match(alertsPage, /hasFeature\(companyId, "smart_alerts"\)/);
  assert.match(alertsPage, /FeatureUpgradeNotice/);
  assert.match(alertsPage, /if \(!allowed\)/);

  const layout = readSrc("src/app/(app)/layout.tsx");
  assert.match(layout, /hasFeature\(companyId, "smart_alerts"\)/);
  assert.match(layout, /hasFeature\(companyId, "decision_memory"\)/);
  assert.match(layout, /hasFeature\(companyId, "team_collaboration"\)/);
  assert.match(layout, /hasFeature\(companyId, "company_profile"\)/);
  assert.match(layout, /smartAlertsEnabled/);
  assert.match(layout, /companyProfileEnabled/);

  const sidebar = readSrc("src/components/app/app-sidebar.tsx");
  assert.match(sidebar, /entitlement: "smartAlerts"/);
  assert.match(sidebar, /entitlement: "decisionMemory"/);
  assert.match(sidebar, /entitlement: "teamWorkflow"/);
  assert.match(sidebar, /entitlement: "companyProfile"/);
  assert.match(sidebar, /href = enabled \? item\.href : "\/upgrade"/);
});

test("dashboard upcoming deadlines prefer Tender Calendar when enabled", () => {
  const dash = readSrc("src/app/(app)/dashboard/page.tsx");
  assert.match(dash, /useCalendarDeadlines = tenderCalendarEnabled/);
  assert.match(dash, /getCalendarDashboard/);
  assert.match(dash, /upcomingCalendarDeadlines/);
  assert.match(dash, /\/tender-calendar\/\$\{item\.tenderId\}/);
});

test("auth form marks disabled OAuth as coming soon", () => {
  const auth = readSrc("src/components/auth/auth-form.tsx");
  assert.match(auth, /labels\.googleComingSoon/);
  assert.match(auth, /labels\.microsoftComingSoon/);
  assert.match(auth, /disabled/);
});
