/**
 * Matching UX visibility — eligible accounts see Matching on dashboard + page;
 * non-entitled / ineligible remain restricted. Server-side gates only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import { publicFitFromMatchedDimensions } from "@/domain/matching-engine";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Matching UX visibility & public fit", () => {
  it("dashboard shows Matching Opportunities only via server entitlement overview", () => {
    const dash = read("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /isCommerciallyAvailableFeature\("matching_engine"\)/);
    assert.match(dash, /getMatchingDashboardOverview/);
    assert.match(dash, /MatchingEngineOverview/);
    assert.match(dash, /state !== "unavailable"/);
    assert.doesNotMatch(dash, /localStorage|sessionStorage/);
    assert.doesNotMatch(dash, /searchParams.*matching/i);
  });

  it("sidebar Matching nav is server entitlement gated (not client-only)", () => {
    const layout = read("src/app/(app)/layout.tsx");
    assert.match(layout, /matchingEngineEnabled/);
    assert.match(layout, /isCommerciallyAvailableFeature\("matching_engine"\)/);
    assert.match(layout, /isMatchingEngineAvailable/);
    const sidebar = read("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /matchedOpportunities/);
    assert.match(sidebar, /entitlement:\s*"matchingEngine"/);
    assert.match(sidebar, /hideWhenDisabled:\s*true/);
    assert.match(sidebar, /matchingEngineEnabled/);
    // Access for Matching is prop-driven from layout; collapse chrome may use localStorage.
    assert.match(sidebar, /matchingEngine:\s*Boolean\(matchingEngineEnabled\)/);
  });

  it("dedicated page requires Matching module server-side", () => {
    const page = read("src/app/(app)/matched-opportunities/page.tsx");
    assert.match(page, /requireMatchingEngineModule/);
    assert.match(page, /MatchedOpportunitiesClient/);
    assert.match(page, /listRecommendationsForCompany/);
    assert.match(page, /canRefresh/);
    const guard = read("src/modules/matching-engine/guard.ts");
    assert.match(guard, /isMatchingEngineAvailable/);
    assert.match(guard, /MATCHING_ENGINE_DISABLED_REDIRECT/);
  });

  it("matched page UI exposes why + gaps but never AI internals", () => {
    const client = read(
      "src/modules/matching-engine/ui/matched-opportunities-client.tsx",
    );
    assert.match(client, /whyMatched|gapNotes|gapsLabel/);
    assert.match(client, /filterGeography|filterCategory|filterStatus/);
    assert.doesNotMatch(client, /aiRefineBoost|prompt|apiKey|boundedRefine/);
    assert.doesNotMatch(client, /preferenceBoost|geographyBoost/);
    const overview = read("src/components/dashboard/matching-engine-overview.tsx");
    assert.match(overview, /viewMatch|capabilityChips|whyMatched/);
    assert.doesNotMatch(overview, /aiRefineBoost|apiKey|prompt/);
  });

  it("publicFitFromMatchedDimensions returns safe matched/gap labels", () => {
    const fit = publicFitFromMatchedDimensions(
      [
        {
          key: "service",
          label: "Service",
          score: 90,
          status: "scored",
          note: "Service overlap",
        },
        {
          key: "size",
          label: "Company size",
          score: 20,
          status: "scored",
          note: "Size band mismatch",
        },
        {
          key: "experience",
          label: "Experience",
          score: null,
          status: "unknown",
          note: "Company experience not provided",
        },
      ],
      {
        opportunityServices: ["Facilities management", "Cleaning"],
        reasons: ["Service overlap"],
      },
    );
    assert.deepEqual(fit.matchedLabels, ["Service"]);
    assert.ok(fit.gapNotes.some((g) => /Size|Experience|mismatch|not provided/i.test(g)));
    assert.deepEqual(fit.capabilityChips, ["Facilities management", "Cleaning"]);
  });

  it("DTO mapping includes public fit fields without inventing matches", () => {
    const service = read("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /publicFitFromMatchedDimensions/);
    assert.match(service, /capabilityChips/);
    assert.match(service, /gapNotes/);
    assert.match(service, /matchedLabels/);
    assert.match(service, /matchedDimensions:\s*true/);
  });
});
