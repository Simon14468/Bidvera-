/**
 * Debug helper: find canonical requirements from Kenya OFFLINE_BACKUP
 * that trigger Guardian REQUIREMENT_TRUNCATED mid-phrase checks.
 *
 * Not part of production pipeline.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";

const PDF = resolve(
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtlnno191cv6rkz49a6wedp1/1788447823241-OFFLINE_BACKUP.pdf",
);
const FILE_NAME = "1788447823241-OFFLINE_BACKUP.pdf";

const truncTailRe =
  /\b(during the|including the|and the|provided by the successful|include programmable|rather than repairing existing units,? the proposed)\s*$/i;
const connectorTailRe = /\b(the|and|or|of|for|with|by|to)\s*$/i;

async function main() {
  const buf = readFileSync(PDF);
  const extracted = await extractDocumentText({
    buffer: buf,
    mimeType: "application/pdf",
    fileName: FILE_NAME,
  });
  const text = extracted.text;

  const heuristic = extractTenderPackageHeuristic({ text, fileName: FILE_NAME });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: FILE_NAME,
  });

  const offenders = canonical.filter((r) => {
    const t = r.requirement.trim();
    return truncTailRe.test(t) || connectorTailRe.test(t);
  });

  console.log(`canonicalCount=${canonical.length} offenders=${offenders.length}`);

  const needle = "disqualification of all tenders in which the";
  const idx = text.toLowerCase().indexOf(needle);
  if (idx !== -1) {
    console.log("---- raw-text context ----");
    console.log(text.slice(idx, idx + 320).replace(/\s+/g, " ").trim());
  }
  for (const o of offenders.slice(0, 10)) {
    console.log("----");
    console.log("id:", o.id ?? "(no-id)");
    console.log("len:", o.requirement.length);
    console.log("tail:", JSON.stringify(o.requirement.slice(-140)));
    console.log("prov:", o.sourceSection ?? o.title ?? "");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

