/**
 * Real-package regression for lifecycle admission.
 * Uses the newest multi-file pack when present. Assertions are general
 * (lifecycle frame), not solicitation-specific.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageFromParts } from "@/services/tender-extraction/requirements-heuristic";
import { assembleTenderPackage } from "@/domain/tender-package";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import {
  analyzeLifecycleCommitmentFrame,
} from "@/domain/semantic-tender-intelligence/phase";
import { interpretSemanticStatement } from "@/domain/semantic-tender-intelligence/interpret";
const ROOT = resolve(".");
const UPLOADS = resolve(ROOT, ".data/uploads");

function newestPack(): string {
  const env = process.env.BIDVERA_LIFECYCLE_PACK?.trim();
  if (env && existsSync(env)) return env;
  const stack = [UPLOADS];
  let best: { path: string; mtime: number; files: number } | null = null;
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    const files = entries.filter((n) => {
      const ext = extname(n).toLowerCase();
      return [".pdf", ".docx", ".xlsx", ".doc"].includes(ext);
    });
    if (files.length >= 2) {
      const mtime = statSync(dir).mtimeMs;
      if (!best || mtime > best.mtime) best = { path: dir, mtime, files: files.length };
    }
    for (const e of entries) {
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory() && e !== "company-knowledge") stack.push(p);
      } catch {
        /* skip */
      }
    }
  }
  if (!best) throw new Error("No multi-file pack found under .data/uploads");
  return best.path;
}

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
  const pack = newestPack();
  const files = readdirSync(pack).filter(
    (n) => !n.startsWith(".") && n !== "intake-report.json",
  );
  const parts: Array<{ fileName: string; text: string; failed: boolean }> = [];
  for (const fileName of files) {
    const buf = readFileSync(join(pack, fileName));
    try {
      const extracted = await extractDocumentText({
        buffer: buf,
        mimeType: mimeFor(fileName),
        fileName,
      });
      parts.push({
        fileName,
        text: extracted.text ?? "",
        failed: !extracted.text,
      });
    } catch {
      parts.push({ fileName, text: "", failed: true });
    }
  }

  assembleTenderPackage(
    parts.map((p) => ({
      fileName: p.fileName,
      documentKind: "TENDER" as const,
      text: p.text,
    })),
  );
  const heuristic = extractTenderPackageFromParts(
    parts.map((p) => ({ fileName: p.fileName, text: p.text })),
    "real-lifecycle-pack",
  );
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: "real-lifecycle-pack",
  });

  const leaked = canonical.filter((row) => {
    const s = interpretSemanticStatement({
      text: row.requirement,
      provenance: {
        sourceDocument: row.sourceDocument ?? "pack",
        sourcePage: row.page ?? 1,
        sourceSection: row.sourceSection ?? null,
        sourceCell: null,
        versionLabel: null,
        locator: null,
      },
      context: null,
    });
    if (s.actor !== "SUPPLIER" && s.actor !== "CONTRACTOR") return false;
    return analyzeLifecycleCommitmentFrame({
      text: row.requirement,
      actor: s.actor,
    }).insufficientFrame;
  });

  const genuine = canonical.filter((row) => {
    const s = interpretSemanticStatement({
      text: row.requirement,
      provenance: {
        sourceDocument: row.sourceDocument ?? "pack",
        sourcePage: row.page ?? 1,
        sourceSection: row.sourceSection ?? null,
        sourceCell: null,
        versionLabel: null,
        locator: null,
      },
      context: null,
    });
    return s.admitToCanonical;
  });

  const report = {
    pack,
    files: parts.length,
    failedFiles: parts.filter((p) => p.failed).length,
    heuristicDrafts: heuristic.requirements.length,
    canonical: canonical.length,
    leakedInsufficientFrame: leaked.length,
    leakedSamples: leaked.slice(0, 8).map((r) => r.requirement.slice(0, 140)),
    genuinePreserved: genuine.length,
    genuineSamples: genuine.slice(0, 6).map((r) => r.requirement.slice(0, 120)),
  };
  console.log(JSON.stringify(report, null, 2));

  if (leaked.length > 0) {
    throw new Error(
      `Lifecycle leak: ${leaked.length} canonical rows lack a complete commitment frame`,
    );
  }
  if (genuine.length < 3) {
    throw new Error("Expected genuine bidder-stage requirements to remain");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
