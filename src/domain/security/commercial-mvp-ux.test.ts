/**
 * UX integration regression — commercial MVP shell coherence.
 * Does not exercise tender-analysis pipeline internals.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("commercial MVP UX integration", () => {
  it("groups the four capabilities in sidebar navigation", () => {
    const sidebar = read("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /sectionCapabilities/);
    assert.match(sidebar, /sectionWorkspace/);
    assert.match(sidebar, /sectionAccount/);
    assert.match(sidebar, /documentCompliance/);
    assert.match(sidebar, /supplierQualification/);
    assert.match(sidebar, /tenderCalendar/);
    assert.match(sidebar, /tenderAnalysis/);
    // Tender Analysis is internal — hide when disabled (not upgrade lock).
    assert.match(
      sidebar,
      /entitlement:\s*"tenderAnalysis"[\s\S]*?hideWhenDisabled:\s*true/,
    );
    assert.match(sidebar, /href = enabled \? item\.href : "\/upgrade"/);
    assert.match(sidebar, /Lock/);
  });

  it("dashboard surfaces workspace KPIs with real module routes", () => {
    const dash = read("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /getWorkspaceDashboard/);
    assert.match(dash, /WorkspaceKpiGrid/);
    const agg = read("src/application/workspace-dashboard.ts");
    assert.match(agg, /\/document-compliance/);
    assert.match(agg, /\/supplier-qualification/);
    assert.match(agg, /\/tender-calendar/);
    assert.match(agg, /isCommerciallyAvailableFeature/);
    assert.doesNotMatch(dash, /fake|placeholder|lorem/i);
  });

  it("locked new modules redirect to upgrade (not silent dashboard)", () => {
    assert.match(
      read("src/modules/document-compliance/guard.ts"),
      /DISABLED_REDIRECT = "\/upgrade"/,
    );
    assert.match(
      read("src/modules/supplier-qualification/guard.ts"),
      /DISABLED_REDIRECT = "\/upgrade"/,
    );
    assert.match(
      read("src/modules/tender-calendar/guard.ts"),
      /DISABLED_REDIRECT = "\/upgrade"/,
    );
    // Tender Analysis guard unchanged (pipeline isolation)
    assert.match(
      read("src/modules/tender-analysis/guard.ts"),
      /DISABLED_REDIRECT = "\/dashboard"/,
    );
  });

  it("settings cross-links module reminder pages", () => {
    const settings = read("src/app/(app)/settings/page.tsx");
    assert.match(settings, /moduleRemindersTitle/);
    assert.match(settings, /\/document-compliance\/settings/);
    assert.match(settings, /\/tender-calendar\/settings/);
  });

  it("module empty states use EmptyState with CTAs", () => {
    assert.match(
      read("src/app/(app)/document-compliance/page.tsx"),
      /EmptyState/,
    );
    assert.match(
      read("src/app/(app)/document-compliance/page.tsx"),
      /\/document-compliance\/upload/,
    );
    assert.match(
      read("src/app/(app)/supplier-qualification/page.tsx"),
      /EmptyState/,
    );
    assert.match(
      read("src/app/(app)/tender-calendar/page.tsx"),
      /EmptyState/,
    );
    assert.match(
      read("src/app/(app)/tender-calendar/tenders/page.tsx"),
      /EmptyState/,
    );
  });

  it("does not import tender-analysis internals from UX shell", () => {
    const dash = read("src/app/(app)/dashboard/page.tsx");
    const sidebar = read("src/components/app/app-sidebar.tsx");
    assert.doesNotMatch(dash, /tender-analysis\/internal/);
    assert.doesNotMatch(sidebar, /tender-analysis\/internal/);
    assert.doesNotMatch(dash, /document-compliance\/internal/);
    assert.doesNotMatch(dash, /supplier-qualification\/internal/);
    assert.doesNotMatch(dash, /tender-calendar\/internal/);
  });
});
