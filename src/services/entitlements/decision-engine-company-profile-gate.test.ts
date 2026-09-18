/**
 * Regression: advanced_decision_engine + company_profile must be enforced
 * server-side (not UI-only). Pure source + catalog checks — no DB required.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  planDefaultFeatureKeys,
  upgradeMessageForFeature,
} from "@/domain/billing/entitlement-catalog";
import { AppError, ErrorCode } from "@/lib/errors";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("paid and trial plans keep decision engine + company profile (tender_analysis is internal)", () => {
  for (const slug of ["trial", "starter", "pro", "business"] as const) {
    const keys = planDefaultFeatureKeys(slug);
    assert.equal(
      keys.includes("tender_analysis"),
      false,
      `${slug} must not grant tender_analysis on user plans`,
    );
    assert.ok(
      keys.includes("advanced_decision_engine"),
      `${slug} must keep advanced_decision_engine`,
    );
    assert.ok(keys.includes("company_profile"), slug);
  }
});

test("decision engine execution paths assert advanced_decision_engine entitlement", () => {
  const processing = readSrc("src/services/tender-processing/index.ts");
  assert.match(processing, /assertFeature\(tender\.companyId, "advanced_decision_engine"\)/);
  // Company-knowledge-only path must stay bypassed (no decision engine).
  assert.match(processing, /decisionEngineBypassed: true/);

  const closedLoop = readSrc("src/services/team-workflow/closed-loop.ts");
  assert.match(
    closedLoop,
    /assertFeature\(input\.companyId, "advanced_decision_engine"\)/,
  );
  // Tenant scope preserved on reanalyze.
  assert.match(closedLoop, /id:\s*input\.tenderId/);
  assert.match(closedLoop, /companyId:\s*input\.companyId/);
});

test("pure domain runDecisionEngine stays entitlement-free (no duplicate logic)", () => {
  const engine = readSrc("src/domain/decision/engine.ts");
  assert.doesNotMatch(engine, /assertFeature|hasFeature/);
});

test("company profile page + mutations enforce company_profile", () => {
  const page = readSrc("src/app/(app)/company/page.tsx");
  assert.match(page, /hasFeature\(companyId, "company_profile"\)/);
  assert.match(page, /FeatureUpgradeNotice/);
  assert.match(page, /if \(!allowed\)/);

  const service = readSrc("src/application/company-service.ts");
  assert.match(service, /assertFeature\(companyId, "company_profile"\)/);
  assert.equal(
    (service.match(/assertFeature\(companyId, "company_profile"\)/g) ?? []).length,
    2,
    "get + update must both assert",
  );

  const action = readSrc("src/app/actions.ts");
  assert.match(action, /updateCompanyProfileAction/);
});

test("company profile navigation is entitlement-gated (not always enabled)", () => {
  const sidebar = readSrc("src/components/app/app-sidebar.tsx");
  assert.match(
    sidebar,
    /href:\s*"\/company".*entitlement:\s*"companyProfile"/,
  );

  const topbar = readSrc("src/components/app/app-topbar.tsx");
  assert.match(topbar, /companyProfileEnabled/);
  assert.match(topbar, /companyHref = companyProfileEnabled \? "\/company" : "\/upgrade"/);

  const layout = readSrc("src/app/(app)/layout.tsx");
  assert.match(layout, /companyProfileEnabled=\{companyProfileEnabled\}/);

  const settings = readSrc("src/app/(app)/settings/page.tsx");
  assert.match(settings, /company_profile/);
  assert.match(settings, /companyProfileEnabled \? "\/company" : "\/upgrade"/);
});

test("Super Admin company management stays outside company_profile entitlement", () => {
  const admin = readSrc("src/application/admin/company-service.ts");
  assert.doesNotMatch(admin, /company_profile/);
  assert.doesNotMatch(admin, /assertFeature/);
});

test("onboarding company setup is not gated by company_profile entitlement", () => {
  const onboarding = readSrc("src/app/(onboarding)/onboarding/company/page.tsx");
  assert.doesNotMatch(onboarding, /company_profile|assertFeature|hasFeature/);
});

test("non-entitled denial uses existing FORBIDDEN upgrade message shape", () => {
  const decisionMsg = upgradeMessageForFeature("advanced_decision_engine");
  const profileMsg = upgradeMessageForFeature("company_profile");
  assert.match(decisionMsg, /Decision engine/i);
  assert.match(profileMsg, /Company profile/i);
  assert.match(decisionMsg, /Upgrade/i);
  assert.match(profileMsg, /Upgrade/i);

  const err = new AppError(ErrorCode.FORBIDDEN, decisionMsg, 403);
  assert.equal(err.code, ErrorCode.FORBIDDEN);
  assert.equal(err.status, 403);
  assert.doesNotMatch(err.message, /prisma|PlanFeature|database/i);
});
