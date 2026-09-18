/**
 * FORENSIC TRACE ONLY — no code changes.
 * Traces Jordan UNOPS supplier clauses through STI admission.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { interpretSemanticStatement } from "../src/domain/semantic-tender-intelligence/interpret";
import { classifyProcurementPhase } from "../src/domain/semantic-tender-intelligence/phase";
import { resolveSemanticActor } from "../src/domain/semantic-tender-intelligence/actor";
import { classifyClausePurpose } from "../src/domain/semantic-tender-intelligence/clause-purpose";
import { resolveRecipient } from "../src/domain/semantic-tender-intelligence/recipient";
import {
  buildCanonicalSemanticCandidates,
} from "../src/domain/semantic-tender-intelligence/candidates";
import { StiApprovedRequirementBatch } from "../src/domain/semantic-tender-intelligence/sti-seal";
import { buildCanonicalRequirements } from "../src/domain/tender-requirements";
import { evaluateCanonicalEntryGate } from "../src/domain/semantic-tender-intelligence/entry-gate";
import { finalAdmissionFromCandidate } from "../src/domain/semantic-tender-intelligence/final-admission-gate";
import { detectTemplateStatus } from "../src/domain/semantic-tender-intelligence/template";
import { analyzeConditionality } from "../src/domain/semantic-tender-intelligence/conditionality";
import {
  inferSectionRole,
  mapPackageDocumentRole,
} from "../src/domain/semantic-tender-intelligence/document-context";
import { isObligationBoundaryComplete } from "../src/domain/semantic-tender-intelligence/boundary";
import { evaluateNormalizedAdmissionFirewall } from "../src/domain/tender-requirements/admission-firewall";

function applyEnv(file: string, override = false) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i);
    const v = line.slice(i + 1).replace(/^["']|["']$/g, "");
    if (override || process.env[k] === undefined) process.env[k] = v;
  }
}
applyEnv(".env");
applyEnv(".env.local", true);

const prisma = new PrismaClient();

const CLAUSE_PATTERNS = [
  { id: "A", label: "transportation/offloading/placement", re: /transport|offload|placement/i },
  { id: "B", label: "repair/replacement defective", re: /repair|replace.*defect|defective/i },
  { id: "C", label: "delivery notes / installation completion / warranty", re: /delivery notes|installation completion|warranty cert/i },
  { id: "D_COMPARE", label: "correct bidder commercial registration", re: /commercial registration|bidder shall possess|bidder must possess/i },
  { id: "E_COORD", label: "coordinate delivery/installation", re: /coordinate delivery|installation schedule/i },
  { id: "F_STORAGE", label: "storage before installation", re: /storage.*before|before installation/i },
];

function stageInterpret(text: string, meta: {
  sourceDocument: string | null;
  documentRole?: string | null;
  sectionLabel?: string | null;
}) {
  const documentRole = mapPackageDocumentRole(meta.documentRole ?? meta.sourceDocument);
  const sectionRole = inferSectionRole(meta.sectionLabel ?? null, text);
  const actorResolved = resolveSemanticActor(text);
  const actor = actorResolved.actor;
  const recipient = resolveRecipient({ text, actor });
  const phase = classifyProcurementPhase({
    text,
    actor,
    documentRole,
    sectionRole,
  });
  const template = detectTemplateStatus(text);
  const boundaryComplete = isObligationBoundaryComplete(text);
  const conditionality = analyzeConditionality(text);
  const purpose = classifyClausePurpose({
    text,
    documentRole,
    sectionRole,
    actor,
    recipient,
    phase,
    templateStatus: template.status,
    isMetadata: false,
    boundaryComplete,
  });
  const full = interpretSemanticStatement({
    text,
    provenance: {
      sourceDocument: meta.sourceDocument,
      sourcePage: null,
      sourceSection: meta.sectionLabel ?? null,
    },
    context: {
      packageDocumentRole: meta.documentRole ?? null,
      sectionLabel: meta.sectionLabel ?? null,
    },
  });
  return {
    documentRole,
    sectionRole,
    actor,
    actorHint: actorResolved.isBidderRequirementHint,
    recipient,
    phase,
    purpose,
    template: template.status,
    conditionality: {
      applicability: conditionality.applicability,
      conditionText: conditionality.conditionText,
      unresolved: conditionality.unresolved,
    },
    boundaryComplete,
    interpret: {
      admit: full.admitToCanonical,
      exclusionCode: full.exclusionCode,
      exclusionReason: full.exclusionReason,
      actor: full.actor,
      phase: full.procurementPhase,
      purpose: full.clausePurpose,
      clauseRole: full.clauseRole,
      semanticKind: full.semanticKind,
      obligationStrength: full.obligationStrength,
      bidderRelevant: full.bidderRelevant,
      applicability: full.applicability,
    },
  };
}

async function main() {
  // Prefer the Jordan multi-doc pack from contamination check
  const preferredIds = [
    "cmtodz18l0glxrk380moagr33",
    "cmtnm1umi0d52rk38ug10xpsm",
    "cmtnkhv580blxrk38sfayjw98",
  ];

  let tender = null as Awaited<ReturnType<typeof prisma.tender.findUnique>>;
  for (const id of preferredIds) {
    tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            documentKind: true,
            extractedText: true,
            processingStatus: true,
          },
        },
        requirements: {
          select: {
            id: true,
            category: true,
            description: true,
            mandatory: true,
            sourceSection: true,
            sourcePage: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        decision: { select: { intelligenceBreakdown: true } },
      },
    });
    if (tender?.requirements.some((r) => /supplier shall|delivery notes|defective/i.test(r.description))) {
      break;
    }
  }

  if (!tender) {
    console.log(JSON.stringify({ error: "tender not found" }));
    await prisma.$disconnect();
    return;
  }

  const intel = tender.decision?.intelligenceBreakdown as {
    canonicalSnapshot?: { stiAdmission?: unknown; version?: string };
    complianceMatrix?: Array<{
      requirement?: string;
      description?: string;
      sourceDocument?: string | null;
      category?: string | null;
    }>;
  } | null;

  const xlsxDocs = tender.documents.filter((d) =>
    /\.xlsx?$/i.test(d.fileName) || /delivery|general.?requirement/i.test(d.fileName),
  );

  // Find matching persisted requirements + matrix rows + extracted text snippets
  const found: Array<{
    id: string;
    label: string;
    persisted: typeof tender.requirements;
    matrixHits: Array<{ text: string; sourceDocument: string | null }>;
    sourceSnippets: Array<{ fileName: string; snippet: string; around: string }>;
  }> = [];

  for (const pat of CLAUSE_PATTERNS) {
    const persisted = tender.requirements.filter((r) => pat.re.test(r.description));
    const matrixHits = (intel?.complianceMatrix ?? [])
      .filter((r) => pat.re.test(r.requirement ?? r.description ?? ""))
      .map((r) => ({
        text: r.requirement ?? r.description ?? "",
        sourceDocument: r.sourceDocument ?? null,
      }));
    const sourceSnippets: Array<{ fileName: string; snippet: string; around: string }> = [];
    for (const d of tender.documents) {
      const text = d.extractedText ?? "";
      if (!pat.re.test(text)) continue;
      const idx = text.search(pat.re);
      if (idx < 0) continue;
      const start = Math.max(0, idx - 200);
      const end = Math.min(text.length, idx + 400);
      const around = text.slice(start, end).replace(/\s+/g, " ");
      // try to find sentence/row
      const window = text.slice(Math.max(0, idx - 80), Math.min(text.length, idx + 250));
      sourceSnippets.push({
        fileName: d.fileName,
        snippet: window.replace(/\s+/g, " ").trim(),
        around,
      });
    }
    found.push({ id: pat.id, label: pat.label, persisted, matrixHits, sourceSnippets });
  }

  // Deep STI trace for each found clause text (prefer persisted description)
  const traces = [];
  for (const f of found) {
    const texts: string[] = [];
    for (const p of f.persisted) texts.push(p.description);
    for (const m of f.matrixHits) if (!texts.includes(m.text)) texts.push(m.text);
    for (const s of f.sourceSnippets.slice(0, 1)) {
      // use a cleaned candidate line from around if no persisted
      if (texts.length === 0) texts.push(s.snippet);
    }

    for (const text of texts.slice(0, 2)) {
      const sourceDoc =
        f.matrixHits.find((m) => m.text === text)?.sourceDocument ??
        f.sourceSnippets[0]?.fileName ??
        null;
      const docMeta = tender.documents.find((d) => d.fileName === sourceDoc);
      const rolesGuess =
        /\.xlsx/i.test(sourceDoc ?? "") || /delivery|general.?req/i.test(sourceDoc ?? "")
          ? "SCHEDULE_OF_REQUIREMENTS"
          : docMeta?.documentKind ?? null;

      const stages = stageInterpret(text, {
        sourceDocument: sourceDoc,
        documentRole: rolesGuess,
        sectionLabel: f.persisted[0]?.sourceSection ?? null,
      });

      // Pipeline: candidates → seal → normalize → firewall
      const { candidates, rejected, interpreted } = buildCanonicalSemanticCandidates(
        [
          {
            description: text,
            sourceDocument: sourceDoc,
            category: f.persisted[0]?.category ?? null,
            mandatory: true,
            packageDocumentRole: rolesGuess,
            sourceSection: f.persisted[0]?.sourceSection ?? null,
          },
        ],
        { packageLabel: tender.title },
      );
      const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
        candidates,
        tender.title,
      );
      const canonical = buildCanonicalRequirements({ stiApproved: sealed });
      const firewallOnCanonical = canonical.map((r) => ({
        text: r.requirement.slice(0, 120),
        firewall: evaluateNormalizedAdmissionFirewall(r),
        sti: {
          actor: r.stiActor,
          phase: r.stiProcurementPhase,
          purpose: r.stiClausePurpose,
          kind: r.semanticKind,
        },
      }));

      // Also: if we force POST_AWARD manually, would firewall catch?
      const hypothetical = canonical[0]
        ? evaluateNormalizedAdmissionFirewall({
            ...canonical[0],
            stiProcurementPhase: "CONTRACT_EXECUTION",
            stiClausePurpose: "POST_AWARD_OBLIGATION",
            stiClauseRole: "POST_AWARD_CONTRACTUAL_OBLIGATION",
            stiActor: "SUPPLIER",
          })
        : null;

      traces.push({
        patternId: f.id,
        label: f.label,
        persistedIds: f.persisted.map((p) => p.id),
        text: text.slice(0, 300),
        sourceDocument: sourceDoc,
        documentKind: docMeta?.documentKind ?? null,
        rolesGuess,
        stageBreakdown: stages,
        interpretedCount: interpreted.length,
        interpreted: interpreted.map((i) => ({
          admit: i.admitToCanonical,
          actor: i.actor,
          phase: i.procurementPhase,
          purpose: i.clausePurpose,
          role: i.clauseRole,
          kind: i.semanticKind,
          strength: i.obligationStrength,
          bidderRelevant: i.bidderRelevant,
          excl: i.exclusionCode,
          reason: i.exclusionReason,
        })),
        candidateCount: candidates.length,
        rejectedCount: rejected.length,
        rejected: rejected.map((r) => ({
          excl: r.exclusionCode,
          purpose: r.clausePurpose,
          phase: r.procurementPhase,
          actor: r.actor,
        })),
        sealedSize: sealed.size,
        sealedFinalRejected: sealed.finalRejected.map((r) => ({
          excl: r.exclusionCode,
          reason: r.exclusionReason,
          failed: r.failedChecks,
          actor: r.candidate.actor,
          phase: r.candidate.procurementPhase,
          purpose: r.candidate.clausePurpose,
        })),
        canonicalCount: canonical.length,
        firewallOnCanonical,
        ifPhaseWereContractExecutionFirewallWouldReject: hypothetical,
        sourceContext: f.sourceSnippets[0]?.around?.slice(0, 500) ?? null,
      });
    }
  }

  // XLSX extraction sample
  const xlsxForensics = xlsxDocs.map((d) => {
    const t = d.extractedText ?? "";
    return {
      fileName: d.fileName,
      documentKind: d.documentKind,
      textLength: t.length,
      head: t.slice(0, 800).replace(/\s+/g, " "),
      hasTableMarkers: /A\d+=|B\d+=|\|/.test(t),
      sampleRows: t
        .split(/\n/)
        .filter((l) => /supplier shall|defective|delivery notes|transport|offload/i.test(l))
        .slice(0, 8)
        .map((l) => l.replace(/\s+/g, " ").slice(0, 220)),
    };
  });

  // Default BID_SUBMISSION paths — static report from code knowledge + live proof
  const supplierBare = stageInterpret(
    "The Supplier shall deliver the goods to the Site.",
    { sourceDocument: "UNOPS_General_Requirements___Delivery_Table.xlsx", documentRole: "SCHEDULE_OF_REQUIREMENTS" },
  );
  const supplierAfterDelivery = stageInterpret(
    "The Supplier shall install the equipment after delivery.",
    { sourceDocument: "UNOPS_General_Requirements___Delivery_Table.xlsx", documentRole: "SCHEDULE_OF_REQUIREMENTS" },
  );

  const out = {
    tenderId: tender.id,
    title: tender.title,
    requirementCount: tender.requirements.length,
    documentCount: tender.documents.length,
    documents: tender.documents.map((d) => ({
      fileName: d.fileName,
      kind: d.documentKind,
      textLen: (d.extractedText ?? "").length,
    })),
    snapshotStiAdmission: intel?.canonicalSnapshot?.stiAdmission ?? null,
    snapshotVersion: intel?.canonicalSnapshot?.version ?? null,
    found,
    traces,
    xlsxForensics,
    controlProbes: {
      supplierBareDeliver: supplierBare,
      supplierInstallAfterDelivery: supplierAfterDelivery,
    },
  };

  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync(
    "artifacts/forensic-jordan-supplier-trace.json",
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
