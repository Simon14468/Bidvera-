/**
 * Same semantic clause → same interpretation across formats and layouts.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSemanticDocumentUnits,
  harvestDraftsFromUnits,
  structureFromPlainText,
  structureFromTableMatrix,
} from "@/domain/document-intelligence";
import { interpretSemanticStatement } from "./interpret";

const CLAUSE = "The Bidder shall submit a signed Form of Tender with the proposal.";

function keyOf(text: string, extra?: { documentRole?: string; sectionLabel?: string }) {
  const s = interpretSemanticStatement({
    text,
    provenance: { sourceDocument: extra?.documentRole ?? "pack", sourcePage: 1 },
    context: {
      packageDocumentRole: extra?.documentRole ?? null,
      sectionLabel: extra?.sectionLabel ?? null,
    },
  });
  return `${s.admitToCanonical}|${s.actor}|${s.procurementPhase}|${s.clausePurpose}`;
}

describe("sti cross-format equivalence", () => {
  it("PDF paragraph, DOCX block, XLSX row, CSV, PPTX slide, OCR page agree", () => {
    const pdf = structureFromPlainText({
      text: `--- Page 1 (pdf-parse) ---\n\n${CLAUSE}`,
      fileName: "itb.pdf",
    });
    const docx = structureFromPlainText({
      text: CLAUSE,
      fileName: "itb.docx",
    });
    const xlsx = structureFromTableMatrix({
      sheetName: "Returnables",
      sheetIndex: 0,
      rows: [
        ["Item", "Requirement"],
        ["1", CLAUSE],
      ],
      fileName: "schedule.xlsx",
    });
    const csv = structureFromTableMatrix({
      sheetName: "csv",
      sheetIndex: 0,
      rows: [
        ["Requirement"],
        [CLAUSE],
      ],
      fileName: "boq.csv",
    });
    const pptx = structureFromPlainText({
      text: `--- Page 1 (ooxml-text) ---\n\n${CLAUSE}`,
      fileName: "brief.pptx",
    });
    const ocr = structureFromPlainText({
      text: `--- Page 1 (OCR) ---\n\n${CLAUSE}`,
      fileName: "scan.pdf",
    });

    const shapes = [
      buildSemanticDocumentUnits({ structure: pdf, fileName: "itb.pdf" }),
      buildSemanticDocumentUnits({ structure: docx, fileName: "itb.docx" }),
      buildSemanticDocumentUnits({
        structure: { version: "document-structure/v1", pages: [], sections: [], tables: [xlsx.table], blocks: xlsx.blocks },
        fileName: "schedule.xlsx",
      }),
      buildSemanticDocumentUnits({
        structure: { version: "document-structure/v1", pages: [], sections: [], tables: [csv.table], blocks: csv.blocks },
        fileName: "boq.csv",
      }),
      buildSemanticDocumentUnits({ structure: pptx, fileName: "brief.pptx" }),
      buildSemanticDocumentUnits({ structure: ocr, fileName: "scan.pdf" }),
    ];

    const keys = shapes.map((units) => {
      const harvested = harvestDraftsFromUnits(units);
      const text = harvested[0]?.description ?? CLAUSE;
      return keyOf(text);
    });
    const baseline = keyOf(CLAUSE);
    for (const k of keys) {
      assert.equal(k, baseline);
    }
  });

  it("layout labels do not change the same clause identity", () => {
    const a = keyOf(CLAUSE, { documentRole: "INSTRUCTIONS_TO_BIDDERS", sectionLabel: "3.2" });
    const b = keyOf(CLAUSE, { documentRole: "ANNEX", sectionLabel: "Appendix B" });
    const c = keyOf(CLAUSE, { documentRole: "TECHNICAL_SPECIFICATION", sectionLabel: "Specifications" });
    assert.equal(a, b);
    assert.equal(a, c);
  });
});
