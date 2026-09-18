/**
 * Matching Engine dashboard overview — company-scoped analytics, no fabricated outcomes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("matching dashboard overview", () => {
  it("scopes stats to session company and reuses Matching Engine APIs", () => {
    const src = read("src/application/matching-dashboard-overview.ts");
    assert.match(src, /isMatchingEngineAvailable/);
    assert.match(src, /getMatchingProfileForCompany/);
    assert.match(src, /listRecommendationsForCompany/);
    assert.match(src, /getCompanyMatchingAnalytics/);
    assert.match(src, /companyId required/);
    assert.match(src, /where:\s*\{\s*companyId/);
    assert.doesNotMatch(src, /fake|Math\.random|synthetic|invent/i);
  });

  it("does not invent WON outcomes", () => {
    const src = read("src/application/matching-dashboard-overview.ts");
    assert.doesNotMatch(src, /WON|wonCount|successfulOutcome|contract won/i);
    const ui = read("src/components/dashboard/matching-engine-overview.tsx");
    assert.match(ui, /not a won contract/i);
    assert.doesNotMatch(ui, /\bWON\b/);
  });

  it("handles unavailable, ineligible, empty, and ready states", () => {
    const src = read("src/application/matching-dashboard-overview.ts");
    assert.match(src, /"unavailable"/);
    assert.match(src, /"not_eligible"/);
    assert.match(src, /"empty"/);
    assert.match(src, /"ready"/);
    assert.match(src, /profile\?\.eligible/);
  });

  it("counts VIEW/INTEREST/DISMISS from real recommendation and event data", () => {
    const src = read("src/application/matching-dashboard-overview.ts");
    assert.match(src, /status === "READ"/);
    assert.match(src, /qualityState:\s*"INTERESTED"/);
    assert.match(src, /status:\s*"DISMISSED"/);
    assert.match(src, /matchRecommendation\.count/);
    assert.match(src, /score >= HIGHLY_RELEVANT_SCORE/);
    assert.match(src, /eventViews|analytics\?\.views/);
  });

  it("dashboard wires overview only when Matching is commercially available", () => {
    const dash = read("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /getMatchingDashboardOverview/);
    assert.match(dash, /MatchingEngineOverview/);
    assert.match(dash, /isCommerciallyAvailableFeature\("matching_engine"\)/);
    assert.match(dash, /matchingCommerciallyOn/);
    assert.match(dash, /state !== "unavailable"/);
    const ui = read("src/components/dashboard/matching-engine-overview.tsx");
    assert.match(ui, /\/matched-opportunities/);
    assert.match(ui, /View matched opportunities/);
  });

  it("does not replace the eight core workspace KPIs", () => {
    const dash = read("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /getWorkspaceDashboard/);
    assert.match(dash, /WorkspaceKpiGrid/);
    const kpi = read("src/application/workspace-dashboard.ts");
    assert.match(kpi, /document_compliance/);
    assert.match(kpi, /upcoming_deadlines/);
    assert.doesNotMatch(kpi, /matching_engine/);
  });
});
