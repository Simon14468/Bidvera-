/**
 * Workspace dashboard redesign regressions — company-scoped KPIs, no TA legacy UX.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("workspace dashboard redesign", () => {
  it("aggregates exactly eight company-scoped KPI ids", () => {
    const src = read("src/application/workspace-dashboard.ts");
    for (const id of [
      "document_compliance",
      "expiring_documents",
      "supplier_qualification",
      "client_requests",
      "questionnaires",
      "evidence_intelligence",
      "decision_activity",
      "upcoming_deadlines",
    ]) {
      assert.match(src, new RegExp(`id:\\s*"${id}"`));
    }
    assert.match(src, /companyId required/);
    assert.match(src, /where:\s*\{\s*companyId/);
    assert.doesNotMatch(src, /fake|placeholder|Math\.random|lorem/i);
  });

  it("does not fabricate historical chart series", () => {
    const src = read("src/application/workspace-dashboard.ts");
    assert.match(src, /activityBuckets/);
    assert.match(src, /deadlineBuckets/);
    assert.doesNotMatch(src, /generateFake|syntheticHistory|dummySeries/i);
    assert.match(src, /hasActivityHistory|activitySeries\.length/);
  });

  it("user dashboard page removes legacy Tender Analysis presentation", () => {
    const dash = read("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /getWorkspaceDashboard/);
    assert.match(dash, /WorkspaceKpiGrid/);
    assert.match(dash, /WorkspacePlanCard/);
    assert.match(dash, /WorkspaceBarChart/);
    assert.match(dash, /requireCompanyId/);
    assert.doesNotMatch(dash, /TrialUsageCard/);
    assert.doesNotMatch(dash, /getDashboardDataForSession/);
    assert.doesNotMatch(dash, /analysesRemaining|analysesUsed|free analyses/i);
    assert.doesNotMatch(dash, /Risks detected|riskOverview|DecisionBadge/);
    assert.doesNotMatch(dash, /Analyze Tender|analyzeCta|recentAnalyses/);
    assert.doesNotMatch(dash, /\bBID\b|\bNO-BID\b|FIT SCORE|Tender Analysis/i);
    assert.doesNotMatch(dash, /PlatformCapabilities/);
    assert.doesNotMatch(dash, /tender-analysis\/internal/);
  });

  it("plan card stays analysis-neutral", () => {
    const plan = read("src/components/dashboard/workspace-plan-card.tsx");
    assert.match(plan, /Current plan/);
    assert.match(plan, /enabledCapabilityLabels/);
    assert.doesNotMatch(plan, /analyses|BID|REVIEW|NO-BID|risksDetected/i);
  });

  it("bounds dashboard aggregations (no unbounded compliance/activity loads)", () => {
    const src = read("src/application/workspace-dashboard.ts");
    assert.match(src, /complianceDocument\.groupBy/);
    assert.match(src, /ACTIVITY_SAMPLE_LIMIT/);
    assert.match(src, /take:\s*ACTIVITY_SAMPLE_LIMIT/);
    assert.match(src, /complianceDocument\.count/);
    assert.doesNotMatch(
      src,
      /complianceDocument\.findMany\(\s*\{\s*where:\s*\{\s*companyId\s*\}\s*,\s*select:\s*\{\s*status/,
    );
  });

  it("loads recent activity streams in parallel", () => {
    const src = read("src/application/workspace-dashboard.ts");
    // Recent activity is folded into the main KPI Promise.all (no second barrier).
    assert.match(src, /Recent activity streams — same barrier as KPI aggregates/);
    assert.match(src, /complianceDocument\.findMany\(\{\s*where:\s*\{\s*companyId\s*\},\s*orderBy:\s*\{\s*updatedAt:\s*"desc"\s*\},\s*take:\s*5/);
    assert.doesNotMatch(
      src,
      /const \[recentDocs, recentReq, recentMem\] = await Promise\.all/,
    );
  });
});
