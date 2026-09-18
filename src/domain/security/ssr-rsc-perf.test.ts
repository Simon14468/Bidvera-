/**
 * Final SSR/RSC performance pass — contracts for confirmed hotspot fixes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("SSR/RSC final performance pass", () => {
  it("layout parallelizes module imports and upgrade path with feature gates", () => {
    const src = read("src/app/(app)/layout.tsx");
    assert.match(src, /await Promise\.all\(\[\s*import\("@\/modules\/tender-analysis"\)/);
    assert.match(src, /upgradeMod\.companyHasUpgradePath\(companyId\)/);
    // Upgrade must not await after the feature Promise.all sequentially alone.
    assert.doesNotMatch(
      src,
      /const showUpgrade = await companyHasUpgradePath/,
    );
  });

  it("dashboard skips matching overview DB when commercially OFF", () => {
    const src = read("src/app/(app)/dashboard/page.tsx");
    assert.match(src, /isCommerciallyAvailableFeature\("matching_engine"\)/);
    assert.match(
      src,
      /matchingCommerciallyOn\s*\?\s*getMatchingDashboardOverview/,
    );
  });

  it("getLocale is request-scoped via React.cache", () => {
    const src = read("src/i18n/get-locale.ts");
    assert.match(src, /import \{ cache \} from "react"/);
    assert.match(src, /export const getLocale = cache\(/);
  });

  it("public checkout plans use framework cache (non-tenant)", () => {
    const src = read("src/services/billing/catalog.ts");
    assert.match(src, /unstable_cache/);
    assert.match(src, /export const listPublicMarketingPlans = cache\(/);
    assert.match(src, /export const listPublicCheckoutPlans = cache\(/);
  });

  it("company profile loader selects only page fields", () => {
    const src = read("src/application/company-service.ts");
    assert.match(src, /globalLearningConsent:\s*true/);
    assert.match(src, /profile:\s*true/);
    assert.doesNotMatch(
      src,
      /include:\s*\{\s*profile:\s*true,\s*usage:\s*true,\s*subscription:\s*true/,
    );
  });

  it("recommendation list selects public opportunity columns only", () => {
    const src = read("src/modules/matching-engine/internal/service.ts");
    const idx = src.indexOf("export async function listMatchRecommendations");
    assert.ok(idx >= 0);
    const slice = src.slice(idx, idx + 2500);
    assert.match(slice, /opportunity:\s*\{\s*select:/);
    assert.doesNotMatch(slice, /include:\s*\{\s*opportunity:\s*true\s*\}/);
  });

  it("workspace dashboard folds recent activity into KPI Promise.all", () => {
    const src = read("src/application/workspace-dashboard.ts");
    assert.match(src, /same barrier as KPI aggregates/);
    assert.match(src, /getEffectiveEntitlements\(companyId\)/);
    assert.doesNotMatch(
      src,
      /const entitlements = await getEffectiveEntitlements/,
    );
  });
});
