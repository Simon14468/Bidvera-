/**
 * Real-package regression for non-requirement canonical contamination.
 * Uses the latest 6-file failing pack when present. Assertions are general
 * (obligation frame + non-requirement invariant), not solicitation-specific.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageFromParts } from "@/services/tender-extraction/requirements-heuristic";
import { assembleTenderPackage } from "@/domain/tender-package";
import {
  buildCanonicalRequirements,
  getLastCanonicalAdmissionAudit,
} from "@/domain/tender-requirements";
import { isNonRequirementText } from "@/domain/tender-requirements/filter-non-requirements";
import { analyzeObligationFrame } from "@/domain/semantic-tender-intelligence/obligation-frame";

const ROOT = resolve(".");
const PACK = resolve(
  ROOT,
  ".data/uploads/cmtn4wc2n0000rkfw63u0g528/cmtorc1fk0euzrkho2zek6mvq",
);

function mimeFor(fileName: string): string {
  switch (extname(fileName).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

async function main() {
  if (!existsSync(PACK)) {
    throw new Error(`Failing package directory not found: ${PACK}`);
  }
  const files = readdirSync(PACK).filter((n) => !n.startsWith(".") && n !== "intake-report.json");
  if (files.length < 2) throw new Error(`Expected a multi-file pack, found ${files.length}`);

  const parts: Array<{ fileName: string; text: string; failed: boolean }> = [];
  for (const fileName of files) {
    const buf = readFileSync(join(PACK, fileName));
    try {
      const extracted = await extractDocumentText({
        buffer: buf,
        mimeType: mimeFor(fileName),
        fileName,
      });
      const text = extracted.text ?? "";
      parts.push({ fileName, text, failed: text.trim().length < 20 });
    } catch (err) {
      parts.push({ fileName, text: "", failed: true });
      console.warn("extract_failed", fileName, err instanceof Error ? err.message : err);
    }
  }

  assembleTenderPackage(
    parts.map((p) => ({ fileName: p.fileName, documentKind: "TENDER" as const, text: p.text })),
  );
  const pack = extractTenderPackageFromParts(
    parts.map((p) => ({ fileName: p.fileName, text: p.text })),
    "real-failing-pack",
  );
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: pack.requirements,
    sourceDocument: "real-failing-pack",
  });
  const audit = getLastCanonicalAdmissionAudit();

  const contaminated = canonical.filter(
    (r) =>
      isNonRequirementText(r.requirement) ||
      !analyzeObligationFrame(r.requirement).canAdmitAsBidderObligation,
  );
  if (contaminated.length) {
    throw new Error(
      `Non-requirement leaked into canonical (${contaminated.length}): ${contaminated[0]!.requirement.slice(0, 120)}`,
    );
  }

  const identifierRejected = (audit?.firewallRejected ?? []).filter(
    (r) =>
      r.exclusionCode === "DOCUMENT_IDENTIFIER" ||
      r.exclusionCode === "DISCLAIMER_OR_INTRO" ||
      r.exclusionCode === "INFORMATIONAL_FACT",
  );

  const report = {
    fileCount: files.length,
    failedFiles: parts.filter((p) => p.failed).map((p) => p.fileName),
    heuristicDrafts: pack.requirements.length,
    canonicalRequirementCount: canonical.length,
    firewallRejected: audit?.firewallRejected.length ?? 0,
    identifierOrDisclaimerRejected: identifierRejected.length,
    genuinePreserved: canonical.length > 0,
    samplesAdmitted: canonical.slice(0, 4).map((r) => r.requirement.slice(0, 100)),
  };
  console.log(JSON.stringify(report, null, 2));
  if (canonical.length < 1) {
    throw new Error("Expected at least one genuine bidder-stage requirement to remain.");
  }
}

void main();
