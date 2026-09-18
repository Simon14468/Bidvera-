/**
 * Full-corpus vs bounded-context regressions.
 * Application context windows must never become source-of-truth data loss.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import {
  wrapAuthoritativeTenderDataChunks,
  wrapAuthoritativeTenderDataForAi,
} from "@/domain/ai-trust";
import { extractTenderDeadlineFromText } from "@/domain/tender-requirements/tender-deadline";
import { assembleTenderPackage, evaluatePackageScoringGate } from "@/domain/tender-package";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { sanitizeExtractedText } from "@/services/document/extract-sanitize";
import { mergeExtractionResults } from "@/services/ai/merge-extraction";
import { extractDocumentText } from "@/services/document/extract";
import {
  AI_CONTEXT_WINDOW_CHARS,
  assertCompleteChunkCoverage,
  buildAuthoritativeCorpus,
  chunkAuthoritativeCorpus,
  corpusCompletenessFromExtract,
  isSourceTruncated,
} from "./index";

const OLD_DOC_CAP = 80_000;
const OLD_PACKAGE_CAP = 120_000;

function persistShaped(extracted: {
  text: string;
  pageCount?: number | null;
  pages?: Array<{ page: number }>;
}) {
  const corpus = buildAuthoritativeCorpus(extracted);
  return {
    text: extracted.text,
    charCount: extracted.text.length,
    completeness: corpus.completeness,
    textTruncated: isSourceTruncated(corpus.completeness),
  };
}

function pageMarkedDocument(pages: string[]): string {
  return pages
    .map((body, i) => `\n\n--- Page ${i + 1} (pdf-parse) ---\n\n${body}`)
    .join("");
}

describe("extraction corpus — authoritative full text vs context windows", () => {
  it("sanitizes a 100k+ document without dropping characters past the old 80k/200k caps", () => {
    const raw = `${"A".repeat(60_000)}\nLATE_MARKER_AFTER_80K\n${"B".repeat(50_000)}`;
    const sanitized = sanitizeExtractedText(raw);
    assert.ok(sanitized.length > 100_000);
    assert.ok(sanitized.includes("LATE_MARKER_AFTER_80K"));
    const persisted = persistShaped({ text: sanitized, pageCount: 1, pages: [{ page: 1 }] });
    assert.equal(persisted.charCount, sanitized.length);
    assert.equal(persisted.completeness, "FULL");
    assert.equal(persisted.textTruncated, false);
    assert.ok(persisted.text.includes("LATE_MARKER_AFTER_80K"));
  });

  it("package assembly preserves every document past the old 120k package cap", () => {
    const docA = `DOC_A_HEAD ${"a".repeat(70_000)} DOC_A_TAIL`;
    const docB = `DOC_B_HEAD ${"b".repeat(70_000)} LATE_PACKAGE_MARKER_AFTER_120K`;
    const assembly = assembleTenderPackage([
      { documentId: "a", fileName: "spec.pdf", documentKind: "TENDER", text: docA },
      { documentId: "b", fileName: "schedule.pdf", documentKind: "TENDER", text: docB },
    ]);
    assert.ok(assembly.packageText.length > OLD_PACKAGE_CAP);
    assert.ok(assembly.packageText.includes("DOC_A_TAIL"));
    assert.ok(assembly.packageText.includes("LATE_PACKAGE_MARKER_AFTER_120K"));
    assert.ok(assembly.packageText.includes(docA));
    assert.ok(assembly.packageText.includes(docB));
  });

  it("pages after the old 80k boundary remain analyzable for metadata, deadline, and requirements", () => {
    const early = "Introductory packing list and table of contents only.\n";
    const late = [
      "Submission deadline: 18 November 2026 at 14:30",
      "Procuring entity: Northern River Authority",
      "The contractor shall provide System Architecture Design & Disaster Recovery.",
    ].join("\n");
    const filler = "x".repeat(OLD_DOC_CAP);
    const text = pageMarkedDocument([early + filler, late]);
    assert.ok(text.length > OLD_DOC_CAP);
    const persisted = persistShaped({
      text,
      pageCount: 2,
      pages: [{ page: 1 }, { page: 2 }],
    });
    assert.equal(persisted.completeness, "FULL");
    assert.ok(persisted.text.includes("System Architecture Design & Disaster Recovery"));
    const deadline = extractTenderDeadlineFromText(persisted.text, null);
    assert.ok(deadline.deadlineIso);
    assert.match(deadline.deadlineIso ?? "", /2026-11-18/);
    const pack = extractTenderPackageHeuristic({
      text: persisted.text,
      fileName: "schedule-of-requirements.pdf",
    });
    const blob = `${pack.deadlineIso ?? ""} ${pack.client ?? ""} ${pack.requirements.map((r) => r.description).join(" ")}`;
    assert.match(blob, /2026-11-18|System Architecture|Disaster Recovery|Northern River/i);
  });

  it("package content after the old 120k boundary remains analyzable", () => {
    const first = `Notice volume ${"n".repeat(70_000)}`;
    const second = `Instructions volume ${"i".repeat(70_000)}`;
    const third = [
      "LATE_VOLUME_AFTER_120K",
      "Submission deadline: 3 January 2027 at 09:00",
      "Bidders shall submit ISO 27001 certification.",
    ].join("\n");
    const assembly = assembleTenderPackage([
      { documentId: "1", fileName: "notice.pdf", documentKind: "TENDER", text: first },
      { documentId: "2", fileName: "itt.pdf", documentKind: "TENDER", text: second },
      { documentId: "3", fileName: "requirements.pdf", documentKind: "TENDER", text: third },
    ]);
    assert.ok(assembly.packageText.length > OLD_PACKAGE_CAP);
    const pack = extractTenderPackageHeuristic({
      text: assembly.packageText,
      fileName: assembly.packageLabel,
    });
    assert.ok(assembly.packageText.includes("LATE_VOLUME_AFTER_120K"));
    assert.ok(
      (pack.deadlineIso ?? "").includes("2027-01-03") ||
        assembly.packageText.includes("3 January 2027"),
    );
    assert.ok(
      pack.requirements.some((r) => /ISO 27001/i.test(r.description)) ||
        assembly.packageText.includes("ISO 27001"),
    );
  });

  it("AI context windows do not change canonical source completeness", () => {
    const text = `${"H".repeat(90_000)}UNIQUE_AFTER_WINDOW${"T".repeat(20_000)}`;
    const corpus = buildAuthoritativeCorpus({ text, pageCount: 12, pages: Array.from({ length: 12 }, (_, i) => ({ page: i + 1 })) });
    assert.equal(corpus.completeness, "FULL");
    assert.equal(isSourceTruncated(corpus.completeness), false);
    const wrap = wrapAuthoritativeTenderDataForAi(text);
    assert.match(wrap, /CONTEXT_WINDOW_ONLY/);
    assert.ok(!wrap.includes("UNIQUE_AFTER_WINDOW"));
    const chunks = wrapAuthoritativeTenderDataChunks(text);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.some((c) => c.wrap.includes("UNIQUE_AFTER_WINDOW")));
    assert.ok(chunks.every((c) => c.chunk.completeness === "CONTEXT_WINDOW_ONLY"));
    assertCompleteChunkCoverage(text, chunks.map((c) => c.chunk));
    assert.equal(corpus.completeness, "FULL");
  });

  it("deterministic chunks cover 100% of the corpus in stable order", () => {
    const text = "0123456789".repeat(12_000);
    const chunks = chunkAuthoritativeCorpus(text, 80_000, 2_000);
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0]!.start, 0);
    assert.equal(chunks.at(-1)!.end, text.length);
    for (let i = 1; i < chunks.length; i++) {
      assert.ok(chunks[i]!.index === i);
      assert.ok(chunks[i]!.start < chunks[i - 1]!.end);
      assert.ok(chunks[i]!.start > chunks[i - 1]!.start);
    }
    assertCompleteChunkCoverage(text, chunks);
    assert.equal(AI_CONTEXT_WINDOW_CHARS, 80_000);
  });

  it("PDF/DOCX/XLSX/PPTX/TXT-shaped extracts and multi-document packages keep complete coverage", () => {
    const pdf = pageMarkedDocument([
      "PDF page 1 preamble",
      `${"p".repeat(85_000)}\nPDF_LATE_PAGE requirement: provide failover hosting.`,
    ]);
    const docx = `DOCX section 1\n${"d".repeat(90_000)}\nDOCX_LATE_SECTION Submission deadline: 9 March 2027`;
    const xlsx = `[sheet:Pricing]\nitem,qty\nA,1\n${"s".repeat(85_000)}\n[sheet:Instructions]\nXLSX_LATE_SHEET Bidders shall price all lots.`;
    const pptx = `[slide:1] Overview\n${"k".repeat(85_000)}\n[slide:40] PPTX_LATE_SLIDE evaluation criteria published here.`;
    const txt = `Plain text notice\n${"t".repeat(85_000)}\nTXT_LATE_LINE Procuring entity: Inland Ports Board`;
    for (const [label, text] of [
      ["pdf", pdf],
      ["docx", docx],
      ["xlsx", xlsx],
      ["pptx", pptx],
      ["txt", txt],
    ] as const) {
      const persisted = persistShaped({ text, pageCount: 2, pages: [{ page: 1 }, { page: 2 }] });
      assert.equal(persisted.completeness, "FULL", label);
      assert.ok(persisted.charCount > OLD_DOC_CAP, label);
    }
    const assembly = assembleTenderPackage([
      { documentId: "pdf", fileName: "volume.pdf", documentKind: "TENDER", text: pdf },
      { documentId: "docx", fileName: "instructions.docx", documentKind: "TENDER", text: docx },
      { documentId: "xlsx", fileName: "boq.xlsx", documentKind: "TENDER", text: xlsx },
      { documentId: "pptx", fileName: "briefing.pptx", documentKind: "TENDER", text: pptx },
      { documentId: "txt", fileName: "readme.txt", documentKind: "TENDER", text: txt },
    ]);
    assert.ok(assembly.packageText.includes("PDF_LATE_PAGE"));
    assert.ok(assembly.packageText.includes("DOCX_LATE_SECTION"));
    assert.ok(assembly.packageText.includes("XLSX_LATE_SHEET"));
    assert.ok(assembly.packageText.includes("PPTX_LATE_SLIDE"));
    assert.ok(assembly.packageText.includes("TXT_LATE_LINE"));
  });

  it("genuine unreadable and source-truncated extracts still fail closed", () => {
    const failed = corpusCompletenessFromExtract({ text: "", failed: true });
    assert.equal(failed, "FAILED");
    const empty = corpusCompletenessFromExtract({ text: "   " });
    assert.equal(empty, "FAILED");
    const ocrPartial = buildAuthoritativeCorpus({
      text: "scanned page text ".repeat(200),
      pageCount: 97,
      pages: Array.from({ length: 40 }, (_, i) => ({ page: i + 1 })),
    });
    assert.equal(ocrPartial.completeness, "TRUNCATED_BY_SOURCE");
    assert.equal(isSourceTruncated(ocrPartial.completeness), true);
    const docxNoPageMap = buildAuthoritativeCorpus({
      text: "Full DOCX extract without page map ".repeat(100),
      pageCount: 1,
      pages: [],
    });
    assert.equal(docxNoPageMap.completeness, "FULL");
    const assembly = assembleTenderPackage([
      {
        documentId: "ocr",
        fileName: "scan.pdf",
        documentKind: "TENDER",
        text: ocrPartial.text,
      },
    ]);
    const blocked = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: 4,
      packageTextTruncated: isSourceTruncated(ocrPartial.completeness),
    });
    assert.equal(blocked.allowScoring, false);
    assert.equal(blocked.reason, "PACKAGE_TEXT_TRUNCATED");
    const longButComplete = persistShaped({
      text: "complete native extract ".repeat(6_000),
      pageCount: 58,
      pages: Array.from({ length: 58 }, (_, i) => ({ page: i + 1 })),
    });
    assert.equal(longButComplete.textTruncated, false);
    const allowed = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: 4,
      packageTextTruncated: longButComplete.textTruncated,
    });
    assert.notEqual(allowed.reason, "PACKAGE_TEXT_TRUNCATED");
  });

  it("merged AI chunk drafts keep later-window facts without marking the source truncated", () => {
    const merged = mergeExtractionResults([
      {
        title: "Early volume",
        client: null,
        country: null,
        region: null,
        industry: null,
        deadlineIso: null,
        deadlineTimezone: null,
        estimatedValue: null,
        guarantee: null,
        requirements: [
          {
            category: "TECHNICAL",
            description: "Provide staging environment",
            mandatory: true,
            verificationStatus: "UNKNOWN",
          },
        ],
        missingDocuments: [],
      },
      {
        title: null,
        client: "Northern River Authority",
        country: null,
        region: null,
        industry: null,
        deadlineIso: "2026-11-18T14:30:00",
        deadlineTimezone: null,
        estimatedValue: null,
        guarantee: null,
        requirements: [
          {
            category: "TECHNICAL",
            description: "System Architecture Design & Disaster Recovery",
            mandatory: true,
            verificationStatus: "UNKNOWN",
          },
        ],
        missingDocuments: [],
      },
    ]);
    assert.equal(merged.title, "Early volume");
    assert.equal(merged.client, "Northern River Authority");
    assert.equal(merged.deadlineIso, "2026-11-18T14:30:00");
    assert.equal(merged.requirements.length, 2);
    assert.ok(merged.requirements.some((r) => /Disaster Recovery/i.test(r.description)));
  });
});

function findLargestUploadedPdf(): string | null {
  const root = resolve(".data/uploads");
  if (!existsSync(root)) return null;
  const stack = [root];
  let best: { path: string; size: number } | null = null;
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (st.isFile() && name.toLowerCase().endsWith(".pdf") && (!best || st.size > best.size)) {
          best = { path: full, size: st.size };
        }
      } catch {
        /* skip */
      }
    }
  }
  return best && best.size >= 200_000 ? best.path : null;
}

describe("extraction corpus — real multi-document pack when present", () => {
  it("preserves the full native extract of a large uploaded specification volume", async () => {
    const specPath = findLargestUploadedPdf();
    if (!specPath) return;
    const buffer = await readFile(specPath);
    const extracted = await extractDocumentText({
      buffer,
      mimeType: "application/pdf",
      fileName: "specification.pdf",
    });
    const persisted = persistShaped({
      text: extracted.text,
      pageCount: extracted.pageCount,
      pages: extracted.pages.map((p) => ({ page: p.page })),
    });
    assert.equal(persisted.charCount, extracted.text.length);
    assert.equal(persisted.textTruncated, isSourceTruncated(persisted.completeness));
    if (extracted.pageCount && extracted.pages.length === extracted.pageCount && extracted.text.length > 100_000) {
      assert.equal(persisted.completeness, "FULL");
      assert.equal(persisted.textTruncated, false);
    }
  });
});
