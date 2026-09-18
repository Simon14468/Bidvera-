/**
 * Supplier Qualification Profile — focused module tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SUPPLIER_QUALIFICATION_FEATURE_KEY,
  SUPPLIER_QUALIFICATION_MODULE_ID,
  SUPPLIER_QUALIFICATION_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
  computeProfileCompleteness,
  completenessChecklist,
  normalizeStringList,
  profileUpdateSchema,
  evidenceCreateSchema,
} from "@/modules/supplier-qualification";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("supplier-qualification module identity", () => {
  it("exposes stable module id and feature key", () => {
    assert.equal(SUPPLIER_QUALIFICATION_MODULE_ID, "supplier-qualification");
    assert.equal(SUPPLIER_QUALIFICATION_FEATURE_KEY, "supplier_qualification");
    assert.equal(SUPPLIER_QUALIFICATION_MODULE_NAME, "Supplier Qualification");
    assert.equal(SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX, "sa-enter:");
  });

  it("does not import tender-analysis or document-compliance internals", () => {
    const service = readSrc(
      "src/modules/supplier-qualification/internal/service.ts",
    );
    const index = readSrc("src/modules/supplier-qualification/index.ts");
    assert.doesNotMatch(
      service,
      /tender-analysis|document-compliance|tender-processing|semantic-tender/,
    );
    assert.doesNotMatch(index, /document-compliance\/internal|tender-analysis\/internal/);
  });
});

describe("completeness calculation", () => {
  it("returns 0 for empty profile", () => {
    assert.equal(computeProfileCompleteness({}), 0);
  });

  it("returns 100 when all required fields are populated", () => {
    const pct = computeProfileCompleteness({
      legalCompanyName: "Acme SARL",
      registrationNumber: "RC-1",
      taxVatNumber: "VAT-9",
      country: "MA",
      addressLine1: "1 Rue Example",
      city: "Casablanca",
      contactEmail: "ops@acme.example",
      companyType: "LLC",
      yearEstablished: 2010,
      businessSectors: ["Facilities"],
      servicesProducts: ["Cleaning"],
      geographicCoverage: ["Morocco"],
    });
    assert.equal(pct, 100);
  });

  it("accepts phone as contact without email", () => {
    const checklist = completenessChecklist({
      contactPhone: "+212600000000",
    });
    assert.equal(checklist.contact, true);
  });

  it("is deterministic and equal-weight", () => {
    const a = computeProfileCompleteness({
      legalCompanyName: "A",
      country: "FR",
    });
    const b = computeProfileCompleteness({
      legalCompanyName: "A",
      country: "FR",
    });
    assert.equal(a, b);
    assert.equal(a, Math.round((2 / 12) * 100));
  });
});

describe("custom sectors/services and validation", () => {
  it("normalizes custom sector lists without hard-coded taxonomy", () => {
    assert.deepEqual(
      normalizeStringList(["  Oil & Gas ", "oil & gas", "Mining"]),
      ["Oil & Gas", "Mining"],
    );
  });

  it("validates structured profile fields", () => {
    const ok = profileUpdateSchema.safeParse({
      legalCompanyName: "Bidvera Demo",
      yearEstablished: 2018,
      contactEmail: "team@example.com",
      businessSectors: ["Custom Sector X"],
    });
    assert.equal(ok.success, true);

    const badYear = profileUpdateSchema.safeParse({ yearEstablished: 1200 });
    assert.equal(badYear.success, false);

    const badEmail = profileUpdateSchema.safeParse({
      contactEmail: "not-an-email",
    });
    assert.equal(badEmail.success, false);
  });

  it("validates evidence metadata", () => {
    const ok = evidenceCreateSchema.safeParse({
      title: "ISO 9001",
      kind: "CERTIFICATION",
      externalUrl: "https://example.com/cert.pdf",
    });
    assert.equal(ok.success, true);

    const xss = evidenceCreateSchema.safeParse({
      title: "Bad",
      externalUrl: "javascript:alert(1)",
    });
    assert.equal(xss.success, false);
  });

  it("treats explicit null patch fields as cleared for completeness", () => {
    const service = readSrc(
      "src/modules/supplier-qualification/internal/service.ts",
    );
    assert.match(service, /Object\.prototype\.hasOwnProperty\.call\(patch, key\)/);
    assert.equal(
      computeProfileCompleteness({
        legalCompanyName: null,
        country: "MA",
      }),
      Math.round((1 / 12) * 100),
    );
  });
});

describe("tenant isolation and evidence ownership", () => {
  it("service scopes profile and evidence by companyId", () => {
    const service = readSrc(
      "src/modules/supplier-qualification/internal/service.ts",
    );
    assert.match(service, /where: \{ companyId \}/);
    assert.match(service, /id: input\.evidenceId, companyId: input\.companyId/);
    assert.match(service, /storageKey\.startsWith\(`\$\{input\.companyId\}\//);
    assert.match(service, /verified: false/);
    assert.match(service, /hasFile: Boolean\(row\.storageKey\)/);
    assert.doesNotMatch(service, /storageKey: row\.storageKey/);
  });

  it("entry always asserts module availability (permissions / OFF)", () => {
    const entry = readSrc("src/modules/supplier-qualification/entry.ts");
    assert.match(entry, /assertSupplierQualificationAvailable/);
    assert.equal(
      (entry.match(/assertSupplierQualificationAvailable/g) ?? []).length >= 7,
      true,
    );
  });
});

describe("evidence upload form lifecycle", () => {
  it("captures the live form before await and resets only after success", () => {
    const panel = readSrc(
      "src/app/(app)/supplier-qualification/evidence/evidence-panel.tsx",
    );
    assert.match(panel, /const form = e\.currentTarget/);
    assert.match(panel, /formRef/);
    assert.match(panel, /if \(pending\) return/);
    assert.match(panel, /liveForm\.isConnected/);
    assert.match(panel, /liveForm\.reset\(\)/);
    // Must not call reset on the event after await (React nulls currentTarget).
    assert.doesNotMatch(panel, /e\.currentTarget\.reset\(\)/);
    // Failed uploads keep the form fields — reset is only on the success path.
    assert.match(
      panel,
      /setError\(json\.error \?\? "Upload failed\."\);\s*return;/,
    );
    // Refresh list from the canonical evidence GET API after success.
    assert.match(
      panel,
      /fetch\("\/api\/supplier-qualification\/evidence"\)/,
    );
  });
});

describe("module OFF blocking and Super Admin testing", () => {
  it("API routes assert availability before serving", () => {
    for (const rel of [
      "src/app/api/supplier-qualification/profile/route.ts",
      "src/app/api/supplier-qualification/evidence/route.ts",
      "src/app/api/supplier-qualification/evidence/[evidenceId]/file/route.ts",
    ]) {
      assert.match(readSrc(rel), /assertSupplierQualificationAvailable/);
    }
  });

  it("access preserves Super Admin enter-session bypass when globally OFF", () => {
    const access = readSrc("src/modules/supplier-qualification/access.ts");
    assert.match(access, /isSuperAdminEnterSession/);
    assert.match(access, /isVerifiedSuperAdminEnterSession/);
    assert.match(access, /enabledGlobal/);
  });

  it("create/update/read are exposed via public entry", () => {
    const index = readSrc("src/modules/supplier-qualification/index.ts");
    assert.match(index, /getSupplierProfile/);
    assert.match(index, /updateSupplierProfile/);
    assert.match(index, /readSupplierProfile/);
  });
});
