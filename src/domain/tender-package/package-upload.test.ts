import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tenderPackageUploadSchema } from "@/domain/schemas";
import { UPLOAD_LIMITS } from "@/config/server";
import {
  assembleTenderPackage,
  classifyTenderDocumentRole,
  evaluatePackageScoringGate,
} from "@/domain/tender-package";

const pdfMeta = (name: string) => ({
  fileName: name,
  fileSize: 12_000,
  mimeType: "application/pdf" as const,
});

describe("tender package multi-file upload limits", () => {
  it("accepts 1 file", () => {
    const parsed = tenderPackageUploadSchema.parse({
      files: [pdfMeta("Avis.pdf")],
    });
    assert.equal(parsed.files.length, 1);
  });

  it("accepts many loose files up to the configured package limit", () => {
    assert.ok(UPLOAD_LIMITS.maxFilesPerPackage > 5);
    const count = Math.min(12, UPLOAD_LIMITS.maxFilesPerPackage);
    const parsed = tenderPackageUploadSchema.parse({
      files: Array.from({ length: count }, (_, i) => pdfMeta(`doc-${i}.pdf`)),
    });
    assert.equal(parsed.files.length, count);
  });

  it("accepts the configured maximum document count", () => {
    const parsed = tenderPackageUploadSchema.parse({
      files: Array.from({ length: UPLOAD_LIMITS.maxFilesPerPackage }, (_, i) =>
        pdfMeta(`doc-${i}.pdf`),
      ),
    });
    assert.equal(parsed.files.length, UPLOAD_LIMITS.maxFilesPerPackage);
  });

  it("rejects more documents than the configured package limit", () => {
    const result = tenderPackageUploadSchema.safeParse({
      files: Array.from({ length: UPLOAD_LIMITS.maxFilesPerPackage + 1 }, (_, i) =>
        pdfMeta(`doc-${i}.pdf`),
      ),
    });
    assert.equal(result.success, false);
  });

  it("does not hard-code a maximum of 5 files", () => {
    assert.equal(UPLOAD_LIMITS.maxFilesPerPackage, 100);
    const six = tenderPackageUploadSchema.safeParse({
      files: Array.from({ length: 6 }, (_, i) => pdfMeta(`doc-${i}.pdf`)),
    });
    assert.equal(six.success, true);
  });

  it("rejects empty package", () => {
    const result = tenderPackageUploadSchema.safeParse({ files: [] });
    assert.equal(result.success, false);
  });

  it("enforces configured per-file size in schema", () => {
    const result = tenderPackageUploadSchema.safeParse({
      files: [
        {
          fileName: "huge.pdf",
          fileSize: UPLOAD_LIMITS.maxFileBytes + 1,
          mimeType: "application/pdf",
        },
      ],
    });
    assert.equal(result.success, false);
    assert.equal(UPLOAD_LIMITS.maxFileBytes, 25 * 1024 * 1024);
  });

  it("accepts mixed supported document MIME types", () => {
    const parsed = tenderPackageUploadSchema.parse({
      files: [
        { fileName: "a.pdf", fileSize: 1000, mimeType: "application/pdf" },
        {
          fileName: "b.docx",
          fileSize: 1000,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        {
          fileName: "c.xlsx",
          fileSize: 1000,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        { fileName: "d.csv", fileSize: 1000, mimeType: "text/csv" },
        { fileName: "e.png", fileSize: 1000, mimeType: "image/png" },
      ],
    });
    assert.equal(parsed.files.length, 5);
  });
});

describe("multi-file package assembly processes every document", () => {
  it("includes all five files with independent roles and combined text", () => {
    const parts = [
      {
        fileName: "Avis.pdf",
        documentKind: "TENDER",
        text: "AVIS D'APPEL D'OFFRES OUVERT. Date limite 11/09/2026. Cautionnement provisoire.",
      },
      {
        fileName: "CPS_v5.pdf",
        documentKind: "TENDER",
        text: "CAHIER DES PRESCRIPTIONS SPECIALES -- Lot unique. Le soumissionnaire devra élire domicile au Maroc. Solution hyperconvergée obligatoire. Preambule du CPS.",
      },
      {
        fileName: "RC-admin.pdf",
        documentKind: "TENDER",
        text: "Dossier administratif. Pieces a fournir: Registre de commerce et attestation CNSS.",
      },
      {
        fileName: "Technical-Specifications.pdf",
        documentKind: "TENDER",
        text: "Technical specifications. Scope of work: Support editeur 24/7. Installation du materiel informatique.",
      },
      {
        fileName: "Annex-A.pdf",
        documentKind: "TENDER",
        text: "Annexe A appendix schedule — bordereau des prix unitaires.",
      },
    ];

    const rolesByFile = parts.map((p) => ({
      fileName: p.fileName,
      role: classifyTenderDocumentRole({ text: p.text, fileName: p.fileName }).role,
    }));

    const assembly = assembleTenderPackage(parts);
    assert.equal(assembly.parts.length, 5);
    assert.ok(assembly.packageText.includes("DOCUMENT: Avis.pdf"));
    assert.ok(assembly.packageText.includes("DOCUMENT: CPS_v5.pdf"));
    assert.ok(assembly.packageText.includes("DOCUMENT: RC-admin.pdf"));
    assert.ok(assembly.packageText.includes("DOCUMENT: Technical-Specifications.pdf"));
    assert.ok(assembly.packageText.includes("DOCUMENT: Annex-A.pdf"));

    const roles = new Set(assembly.parts.map((p) => p.role));
    assert.ok(
      roles.has("CPS") || roles.has("TECHNICAL_SPECIFICATION") || roles.has("RFP"),
      `expected a specification role, got ${[...roles].join(",")} (${JSON.stringify(rolesByFile)})`,
    );
    assert.equal(
      assembly.hasSpecificationSource,
      true,
      `roles=${JSON.stringify(rolesByFile)} completeness=${assembly.completeness}`,
    );

    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: 8,
    });
    assert.equal(gate.allowScoring, true);
  });

  it("does not silently drop a document from the package text", () => {
    const assembly = assembleTenderPackage([
      { fileName: "one.pdf", documentKind: "TENDER", text: "AVIS D'APPEL. Cautionnement provisoire." },
      { fileName: "two.pdf", documentKind: "TENDER", text: "CAHIER DES PRESCRIPTIONS SPECIALES. Doit installer." },
    ]);
    assert.equal(assembly.parts.length, 2);
    assert.match(assembly.packageLabel, /one\.pdf/);
    assert.match(assembly.packageLabel, /two\.pdf/);
  });
});
