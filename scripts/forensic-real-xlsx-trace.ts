/**
 * Forensic-only: real Jordan UNOPS XLSX → STI phase/actor (no fixes).
 */
import fs from "fs";
import { extractSpreadsheetText } from "../src/services/document/extract-spreadsheet";
import { resolveSemanticActor } from "../src/domain/semantic-tender-intelligence/actor";
import { classifyProcurementPhase } from "../src/domain/semantic-tender-intelligence/phase";
import { classifyClausePurpose } from "../src/domain/semantic-tender-intelligence/clause-purpose";
import { interpretSemanticStatement } from "../src/domain/semantic-tender-intelligence/interpret";
import { resolveRecipient } from "../src/domain/semantic-tender-intelligence/recipient";
import { detectTemplateStatus } from "../src/domain/semantic-tender-intelligence/template";
import { isObligationBoundaryComplete } from "../src/domain/semantic-tender-intelligence/boundary";
import {
  mapPackageDocumentRole,
  inferSectionRole,
} from "../src/domain/semantic-tender-intelligence/document-context";

const file =
  ".data/uploads/cmtncpk1j0000rkv42owtcrej/cmtodz18l0glxrk380moagr33/1788612955950-UNOPS_General_Requirements___Delivery_Table.xlsx";

const buf = fs.readFileSync(file);
const r = extractSpreadsheetText(buf, {
  fileName: "UNOPS_General_Requirements___Delivery_Table.xlsx",
});

const keys = [
  "transport",
  "offload",
  "defective",
  "delivery note",
  "warranty",
  "coordinate",
  "storage",
  "placement",
  "repair",
  "installation completion",
  "bidder shall",
  "commercial registration",
];

const hits = r.text.split(/\n/).filter((line) => {
  const lo = line.toLowerCase();
  return keys.some((k) => lo.includes(k.toLowerCase()));
});

function cellText(row: string): string {
  const m = row.match(/B\d+=(.*?)(?:\s\|\s[A-Z]+\d+=|$)/);
  if (m?.[1]) return m[1].trim();
  // fallback: longest cell value
  const cells = [...row.matchAll(/[A-Z]+\d+=(.*?)(?=\s\|\s[A-Z]+\d+=|$)/g)].map(
    (x) => x[1]!.trim(),
  );
  return cells.sort((a, b) => b.length - a.length)[0] ?? row.trim();
}

function pick(re: RegExp): string {
  return hits.find((h) => re.test(h)) ?? "";
}

const samples: Record<string, string> = {
  A: pick(/transport|offload|placement/i),
  B: pick(/defective|repair or replace|repaired or replaced/i),
  C: pick(/delivery note|warranty cert|installation completion/i),
  E: pick(/coordinate/i),
  F: pick(/storage/i),
  COMPARE: pick(/commercial registration|bidder shall possess/i),
};

const documentRole = mapPackageDocumentRole("SCHEDULE_OF_REQUIREMENTS");
const sectionRole = inferSectionRole(null, documentRole);

const out: Record<string, unknown> = {
  file,
  sheets: r.sheetCount,
  documentRole,
  sectionRole,
  hitCount: hits.length,
  sampleHits: hits.slice(0, 30).map((h) => h.slice(0, 300)),
  traces: {} as Record<string, unknown>,
};

for (const [id, row] of Object.entries(samples)) {
  if (!row) {
    (out.traces as Record<string, unknown>)[id] = { missing: true };
    continue;
  }
  const text = cellText(row);
  const actorInfo = resolveSemanticActor(text);
  const recipient = resolveRecipient({ text, actor: actorInfo.actor });
  const phase = classifyProcurementPhase({
    text,
    actor: actorInfo.actor,
    documentRole,
    sectionRole,
  });
  const purpose = classifyClausePurpose({
    text,
    documentRole,
    sectionRole,
    actor: actorInfo.actor,
    recipient,
    phase,
    templateStatus: detectTemplateStatus(text),
    isMetadata: false,
    boundaryComplete: isObligationBoundaryComplete(text),
  });
  const interp = interpretSemanticStatement({
    text,
    provenance: {
      sourceDocument: "UNOPS_General_Requirements___Delivery_Table.xlsx",
      sourcePage: null,
      sourceSection: null,
    },
    context: {
      documentRole,
      packageDocumentRole: "SCHEDULE_OF_REQUIREMENTS",
      sectionRole,
    },
  });

  (out.traces as Record<string, unknown>)[id] = {
    rawRow: row.slice(0, 360),
    clauseText: text,
    actor: actorInfo.actor,
    recipient,
    phaseFromClassifier: phase,
    purposeFromClassifier: purpose,
    interpretAdmit: interp.admittedToCanonical,
    interpretExclusion: interp.exclusionCode ?? null,
    interpretPhase: interp.procurementPhase,
    interpretActor: interp.actor,
    interpretPurpose: interp.clausePurpose,
    interpretKind: interp.semanticKind,
    interpretRole: interp.clauseRole,
    bidderRelevant: interp.bidderRelevant,
  };
}

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/forensic-real-xlsx-trace.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify(out, null, 2));
