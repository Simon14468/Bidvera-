/**
 * Product excellence regression — confirmed UX/gate fixes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("product excellence UX gates", () => {
  it("sidebar Upgrade CTA respects upgrade eligibility", () => {
    const layout = read("src/app/(app)/layout.tsx");
    const sidebar = read("src/components/app/app-sidebar.tsx");
    assert.match(layout, /companyHasUpgradePath/);
    assert.match(layout, /showUpgrade/);
    assert.match(sidebar, /showUpgrade/);
    assert.match(sidebar, /showUpgrade \?/);
  });

  it("matched opportunities clarifies match meaning and gates sponsored CTA", () => {
    const page = read("src/app/(app)/matched-opportunities/page.tsx");
    assert.match(page, /not a won contract/i);
    assert.match(page, /isMatchingSponsorshipGloballyEnabled/);
    assert.match(page, /sponsorshipEnabled/);
    const pricing = read(
      "src/modules/matching-engine/internal/sponsorship-pricing.ts",
    );
    assert.match(pricing, /isMatchingSponsorshipGloballyEnabled/);
    assert.match(pricing, /Sponsored Matching is not available/);
  });

  it("nav uses consistent capability naming", () => {
    const dict = read("src/i18n/dictionaries.ts");
    assert.match(dict, /matchedOpportunities:\s*"Matched Opportunities"/);
    assert.match(dict, /alerts:\s*"Smart Alerts"/);
    assert.match(dict, /teamWorkflow:\s*"Team Decision Workflow"/);
    assert.match(dict, /analysesUsage:\s*"Tender analyses"/);
  });

  it("dashboard matching empty state offers profile next action", () => {
    const ui = read("src/components/dashboard/matching-engine-overview.tsx");
    assert.match(ui, /No matches yet/);
    assert.match(ui, /Update company profile/);
    assert.match(ui, /\/matched-opportunities/);
  });

  it("does not expose Tender Analysis as default chrome for commercial OFF", () => {
    const layout = read("src/app/(app)/layout.tsx");
    assert.match(layout, /isCommerciallyAvailableFeature\("tender_analysis"\)/);
    assert.match(layout, /isCommerciallyAvailableFeature\("matching_engine"\)/);
    const sidebar = read("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /hideWhenDisabled:\s*true/);
  });

  it("avoids dead-end Tender Analysis CTAs when module is commercially OFF", () => {
    const qa = read("src/app/(app)/questionnaire-assistant/page.tsx");
    assert.match(qa, /Update company profile/);
    assert.match(qa, /isCommerciallyAvailableFeature\("tender_analysis"\)/);
    const memory = read("src/app/(app)/decision-memory/page.tsx");
    assert.match(memory, /Open company profile/);
    assert.match(memory, /isCommerciallyAvailableFeature\("tender_analysis"\)/);
  });

  it("settings plan summary does not meter analyses", () => {
    const settings = read("src/app/(app)/settings/page.tsx");
    assert.doesNotMatch(settings, /analysesUsed|planLimited|planUnlimited/);
    assert.match(settings, /usage\.plan/);
    assert.match(settings, /usage\.effectiveStatus/);
  });

  it("public offered capabilities do not list Tender Analysis as sold", () => {
    const entity = read("src/seo/site-entity.ts");
    assert.doesNotMatch(
      entity,
      /offeredCapabilities:[\s\S]*?"Tender analysis"/,
    );
    assert.match(entity, /notCommerciallyClaimed:[\s\S]*?Tender Analysis/);
  });

  it("create client request quick action goes to /new", () => {
    const dash = read("src/application/workspace-dashboard.ts");
    assert.match(dash, /href:\s*"\/client-requests\/new"/);
  });
});
