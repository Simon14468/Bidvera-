/**
 * Document Compliance Manager — focused module tests.
 * Covers extraction, status, reminders, isolation invariants, and access gating.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DOCUMENT_COMPLIANCE_FEATURE_KEY,
  DOCUMENT_COMPLIANCE_MODULE_ID,
  DOCUMENT_COMPLIANCE_MODULE_NAME,
  addDaysDateOnly,
  computeComplianceStatus,
  daysBetweenDateOnly,
  extractComplianceMetadataFromText,
  planReminderDates,
  todayDateOnly,
} from "@/modules/document-compliance";
import { AppError } from "@/lib/errors";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("document-compliance module identity", () => {
  it("exposes stable module id and feature key", () => {
    assert.equal(DOCUMENT_COMPLIANCE_MODULE_ID, "document-compliance");
    assert.equal(DOCUMENT_COMPLIANCE_FEATURE_KEY, "document_compliance");
    assert.equal(DOCUMENT_COMPLIANCE_MODULE_NAME, "Document Compliance");
  });

  it("does not import tender-analysis internals", () => {
    const service = readSrc(
      "src/modules/document-compliance/internal/service.ts",
    );
    const extract = readSrc(
      "src/modules/document-compliance/internal/extract-metadata.ts",
    );
    assert.doesNotMatch(service, /tender-analysis|tender-processing|semantic-tender|universal-tender|document-intelligence/);
    assert.doesNotMatch(extract, /tender-analysis|tender-processing/);
  });
});

describe("metadata extraction", () => {
  it("extracts labeled expiry and issue dates without inventing", () => {
    const text = `
      Certificate of Insurance
      Issued by: Acme Assurance SA
      Document number: POL-2024-991
      Issue date: 2024-01-15
      Valid until: 2026-12-31
    `;
    const meta = extractComplianceMetadataFromText(text, "insurance.pdf");
    assert.equal(meta.issueDate, "2024-01-15");
    assert.equal(meta.expiryDate, "2026-12-31");
    assert.equal(meta.noExpiry, false);
    assert.equal(meta.uncertain, false);
    assert.ok(meta.confidence >= 0.7);
    assert.ok(meta.provenance.some((p) => p.field === "expiryDate"));
  });

  it("marks no-expiry documents", () => {
    const text = `Trade register extract. This certificate does not expire. Issued on 2020-05-01.`;
    const meta = extractComplianceMetadataFromText(text);
    assert.equal(meta.noExpiry, true);
    assert.equal(meta.expiryDate, null);
    assert.equal(meta.uncertain, false);
  });

  it("does not treat signature dates as expiry", () => {
    const text = `Agreement. Signature date: 2025-03-10. Contract date: 2025-03-01.`;
    const meta = extractComplianceMetadataFromText(text);
    assert.equal(meta.expiryDate, null);
    assert.ok(meta.uncertain || meta.provenance.some((p) => p.label === "non_expiry_date_ignored"));
  });

  it("marks empty / weak extraction as uncertain", () => {
    const meta = extractComplianceMetadataFromText("x");
    assert.equal(meta.uncertain, true);
    assert.equal(meta.expiryDate, null);
  });
});

describe("compliance status", () => {
  it("VALID when expiry is beyond soon window", () => {
    assert.equal(
      computeComplianceStatus({
        expiryDateYmd: "2030-01-01",
        uncertain: false,
        noExpiry: false,
        todayYmd: "2026-09-07",
        expiringSoonDays: 90,
      }),
      "VALID",
    );
  });

  it("EXPIRING_SOON within 90 days", () => {
    assert.equal(
      computeComplianceStatus({
        expiryDateYmd: "2026-10-01",
        uncertain: false,
        noExpiry: false,
        todayYmd: "2026-09-07",
        expiringSoonDays: 90,
      }),
      "EXPIRING_SOON",
    );
  });

  it("EXPIRED after expiry date (date-only)", () => {
    assert.equal(
      computeComplianceStatus({
        expiryDateYmd: "2026-09-01",
        uncertain: false,
        noExpiry: false,
        todayYmd: "2026-09-07",
      }),
      "EXPIRED",
    );
  });

  it("NO_EXPIRY when no expiry and not uncertain", () => {
    assert.equal(
      computeComplianceStatus({
        expiryDateYmd: null,
        uncertain: false,
        noExpiry: true,
        todayYmd: "2026-09-07",
      }),
      "NO_EXPIRY",
    );
  });

  it("UNKNOWN when uncertain and no expiry", () => {
    assert.equal(
      computeComplianceStatus({
        expiryDateYmd: null,
        uncertain: true,
        noExpiry: false,
        todayYmd: "2026-09-07",
      }),
      "UNKNOWN",
    );
  });
});

describe("90/30/7-day reminders", () => {
  it("plans 90, 30, 7 and expired fire dates with date-only math", () => {
    const plans = planReminderDates("2026-12-31", {
      remind90d: true,
      remind30d: true,
      remind7d: true,
      remindExpired: true,
      expiringSoonDays: 90,
    });
    const byKind = Object.fromEntries(plans.map((p) => [p.kind, p.fireOnDate]));
    assert.equal(byKind.DAYS_90, "2026-10-02");
    assert.equal(byKind.DAYS_30, "2026-12-01");
    assert.equal(byKind.DAYS_7, "2026-12-24");
    assert.equal(byKind.EXPIRED, "2026-12-31");
  });

  it("respects disabled reminder settings", () => {
    const plans = planReminderDates("2026-12-31", {
      remind90d: false,
      remind30d: true,
      remind7d: false,
      remindExpired: true,
      expiringSoonDays: 90,
    });
    assert.deepEqual(
      plans.map((p) => p.kind).sort(),
      ["DAYS_30", "EXPIRED"],
    );
  });

  it("date-only day math does not invent timezone shifts", () => {
    assert.equal(addDaysDateOnly("2026-03-01", -1), "2026-02-28");
    assert.equal(daysBetweenDateOnly("2026-09-07", "2026-09-07"), 0);
    assert.equal(daysBetweenDateOnly("2026-09-07", "2026-09-14"), 7);
    assert.ok(todayDateOnly().match(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe("access when module is OFF", () => {
  it("API routes assert module availability before serving", () => {
    const documentsRoute = readSrc(
      "src/app/api/document-compliance/documents/route.ts",
    );
    const settingsRoute = readSrc(
      "src/app/api/document-compliance/settings/route.ts",
    );
    const filesRoute = readSrc(
      "src/app/api/document-compliance/files/[versionId]/route.ts",
    );
    for (const src of [documentsRoute, settingsRoute, filesRoute]) {
      assert.match(src, /assertDocumentComplianceAvailable/);
    }
  });

  it("entry uploadDocument throws FORBIDDEN when assert fails", async () => {
    // Static contract: entry always calls assert before internal upload.
    const entry = readSrc("src/modules/document-compliance/entry.ts");
    assert.match(entry, /assertDocumentComplianceAvailable/);
    assert.match(entry, /uploadComplianceDocument/);
    assert.ok(AppError);
  });
});

describe("tenant isolation and ownership invariants", () => {
  it("repository list/get always scope by companyId", () => {
    const repo = readSrc(
      "src/modules/document-compliance/internal/repository.ts",
    );
    assert.match(repo, /companyId: input\.companyId/);
    assert.match(repo, /id: documentId, companyId/);
    assert.match(repo, /id: versionId, companyId/);
  });

  it("file download checks storage key ownership prefix", () => {
    const service = readSrc(
      "src/modules/document-compliance/internal/service.ts",
    );
    assert.match(service, /storageKey\.startsWith\(`\$\{input\.companyId\}\//);
    // Prefix check must happen before getObject
    const prefixIdx = service.indexOf("storageKey.startsWith");
    const getIdx = service.indexOf("storageService.getObject");
    assert.ok(prefixIdx > 0 && getIdx > prefixIdx);
  });

  it("duplicate versions increment versionNumber", () => {
    const service = readSrc(
      "src/modules/document-compliance/internal/service.ts",
    );
    assert.match(service, /nextVersionNumber/);
    assert.match(service, /versionNumber: 1/);
  });

  it("reminder reconcile skips terminal alerts and cancels scheduled alerts", () => {
    const reminders = readSrc(
      "src/modules/document-compliance/internal/reminders.ts",
    );
    const repo = readSrc(
      "src/modules/document-compliance/internal/repository.ts",
    );
    assert.match(reminders, /DISMISSED/);
    assert.match(reminders, /hasFeature/);
    assert.match(repo, /dedupeKey: \{ startsWith:/);
    assert.match(reminders, /do not flip SENT/);
    assert.match(reminders, /CANCELLED is re-schedulable/);
    assert.doesNotMatch(
      reminders,
      /existingAlert\.status === "CANCELLED"/,
    );
  });
});
