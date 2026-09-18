/**
 * Real multi-document package identity report.
 * Evidence only — no pack-specific rules.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageFromParts } from "@/services/tender-extraction/requirements-heuristic";
import { classifyTenderDocumentRole } from "@/domain/tender-package/classify-role";
import { extractTenderDeadlineFromText } from "@/domain/tender-requirements/tender-deadline";

const ROOT = resolve(".");
const UPLOADS = resolve(ROOT, ".data/uploads");

function newestPack(): string {
  const env = process.env.BIDVERA_IDENTITY_PACK?.trim();
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
    const files = entries.filter((n) =>
      [".pdf", ".docx", ".xlsx", ".doc"].includes(extname(n).toLowerCase()),
    );
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
  const parts: Array<{ fileName: string; text: string }> = [];
  for (const fileName of files) {
    const buf = readFileSync(join(pack, fileName));
    try {
      const extracted = await extractDocumentText({
        buffer: buf,
        mimeType: mimeFor(fileName),
        fileName,
      });
      parts.push({ fileName, text: extracted.text ?? "" });
    } catch {
      parts.push({ fileName, text: "" });
    }
  }

  const concat = parts.map((p) => p.text).join("\n\n");
  const concatDeadline = extractTenderDeadlineFromText(concat, null);
  const firstDocDeadline = extractTenderDeadlineFromText(parts[0]?.text ?? "", null);
  const legacyRoles = parts.map((p) => ({
    fileName: p.fileName,
    role: classifyTenderDocumentRole({ text: p.text, fileName: p.fileName }).role,
  }));

  const heuristic = extractTenderPackageFromParts(parts, "identity-pack");
  const identity = heuristic.packageIdentity;

  const firstDivergence: string[] = [];
  if (concatDeadline.deadlineIso && !identity?.deadline.deadlineIso) {
    firstDivergence.push(
      "CONCAT_DEADLINE_VS_IDENTITY: concatenated parse found a date identity rejected",
    );
  }
  if (!firstDocDeadline.deadlineIso && identity?.deadline.status === "OK") {
    firstDivergence.push(
      "FIRST_DOC_MISS: first file had no deadline; package identity recovered it",
    );
  }
  const collapsed = legacyRoles.filter((r) =>
    ["OTHER", "RFP", "TECHNICAL_SPECIFICATION"].includes(r.role),
  );
  if (
    collapsed.length >= 2 &&
    (identity?.documents.filter((d) => d.role !== "UNKNOWN" && d.role !== "OTHER").length ?? 0) >= 3
  ) {
    firstDivergence.push(
      "LEGACY_ROLE_COLLAPSE: assembly classifier collapsed volumes that identity kept distinct",
    );
  }

  console.log(
    JSON.stringify(
      {
        pack,
        files: parts.map((p) => ({
          fileName: p.fileName,
          chars: p.text.length,
          legacyRole: legacyRoles.find((r) => r.fileName === p.fileName)?.role,
          identityRole: identity?.documents.find((d) => d.fileName === p.fileName)?.role,
        })),
        buyer: identity?.buyer,
        title: { status: identity?.title.status, value: identity?.title.value },
        deadline: identity?.deadline,
        concatDeadline: concatDeadline.deadlineIso,
        firstDocDeadline: firstDocDeadline.deadlineIso,
        firstDivergence,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
