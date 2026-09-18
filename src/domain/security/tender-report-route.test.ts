/**
 * Report route must share the tender detail identity/auth path — never a parallel lookup.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assertReportPublicationAllowed } from "@/domain/decision-validation";

describe("tender report route identity", () => {
  const page = readFileSync("src/app/(app)/tenders/[id]/report/page.tsx", "utf8");
  const detail = readFileSync("src/app/(app)/tenders/[id]/page.tsx", "utf8");
  const pdfRoute = readFileSync("src/app/api/tenders/[id]/pdf/route.ts", "utf8");
  const actions = readFileSync("src/components/tenders/report-actions.tsx", "utf8");

  it("uses the same loadTenderResultPageData orchestrator as the detail page", () => {
    assert.match(detail, /loadTenderResultPageData/);
    assert.match(page, /loadTenderResultPageData/);
    assert.doesNotMatch(page, /getTenderReportForSession/);
  });

  it("keeps notFound for missing/unauthorized tenders", () => {
    assert.match(page, /ErrorCode\.NOT_FOUND/);
    assert.match(page, /ErrorCode\.FORBIDDEN/);
    assert.match(page, /notFound\(\)/);
  });

  it("maps Guardian publication blocks to not-ready — not notFound", () => {
    assert.match(page, /DecisionGuardianError/);
    assert.match(page, /reportNotReady/);
    assert.match(page, /reportNotReadyBody/);
  });

  it("streams PDF through a tenant-scoped GET route, not a base64 server action", () => {
    assert.match(pdfRoute, /requireCompanyIdApi/);
    assert.match(pdfRoute, /assertFeature/);
    assert.match(pdfRoute, /pdf_export/);
    assert.match(pdfRoute, /getTenderReportForCompany/);
    assert.match(pdfRoute, /buildTenderReportPdf/);
    assert.match(pdfRoute, /application\/pdf/);
    assert.match(actions, /\/api\/tenders\/\$\{tenderId\}\/pdf/);
    assert.doesNotMatch(actions, /downloadTenderReportPdf/);
    assert.doesNotMatch(actions, /atob\(/);
  });
});

describe("report publication gate — no invented COMPLETE", () => {
  it("allows incomplete analysis without Guardian snapshot", () => {
    assert.doesNotThrow(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: "TENDER",
        complianceStatus: "INCOMPLETE",
        decisionGuardian: null,
      }),
    );
  });

  it("allows missing complianceStatus without inventing COMPLETE", () => {
    assert.doesNotThrow(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: null,
        complianceStatus: null,
        decisionGuardian: null,
      }),
    );
  });

  it("still blocks explicit COMPLETE without Guardian", () => {
    assert.throws(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: "TENDER",
        complianceStatus: "COMPLETE",
        decisionGuardian: null,
      }),
    );
  });
});
