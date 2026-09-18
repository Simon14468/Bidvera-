/**
 * Real EIB package E2E after actor / count / action-text hardening.
 * Clones stored PDFs into a fresh tender and runs processTenderAnalysis.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { storageService } from "../src/services/storage";
import { processTenderAnalysis } from "../src/services/tender-processing/index";
import { attributeObligationActor } from "../src/domain/tender-requirements/obligation-actor";
import { isRealBidderObligation } from "../src/domain/tender-requirements/obligation";
import { buildExplainableDecision } from "../src/domain/explainable-decision/build";
import type { TenderDecisionRecommendation } from "../src/domain/decision/recommendation";
import type { ComplianceRow } from "../src/domain/tender-intelligence/types";
import type { TenderReadinessBreakdown } from "../src/domain/decision/tender-readiness";

const SOURCE_TENDER_ID = "cmtm3gnbd0gyerkpojaub3hov";
/** Prior completed run used as before-count baseline when present. */
const PRIOR_COMPLETED_ID = "cmtmvzybo0001rk70kxjqc6ew";

const AUTHORITY_NEVER = [
  "Le dossier d'appel d'offres doit être suffisamment clair",
  "Le pouvoir adjudicateur n'est pas tenu",
  "L'Autorité contractante informera",
  "L'Autorité contractante doit",
];

type Intel = {
  complianceSummary?: {
    totalRequirements?: number;
    verifiedRequirements?: number;
    needsVerification?: number;
    confirmedGaps?: number;
    notApplicable?: number;
  };
  canonicalSnapshot?: {
    counts?: {
      totalRequirements?: number;
      verifiedRequirements?: number;
      needsVerification?: number;
      confirmedGaps?: number;
      notApplicable?: number;
    };
  };
  complianceMatrix?: ComplianceRow[];
  tenderDecisionRecommendation?: TenderDecisionRecommendation;
  readiness?: TenderReadinessBreakdown;
  evidenceIntelligence?: unknown;
  actionPlan?: {
    computed?: boolean;
    items?: Array<{
      linkedRequirementId?: string | null;
      requirementText?: string | null;
      description?: string;
      title?: string;
    }>;
  };
};

function resolveDocPath(companyId: string, tenderId: string, storageKey: string): string {
  const candidates = [
    storageKey,
    path.join(".data", "uploads", storageKey),
    path.join(".data", "uploads", companyId, tenderId, path.basename(storageKey)),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(`Missing file for storageKey=${storageKey}`);
}

async function main() {
  const source = await prisma.tender.findUnique({
    where: { id: SOURCE_TENDER_ID },
    include: { documents: { orderBy: { createdAt: "asc" } }, company: true },
  });
  if (!source?.documents.length) {
    throw new Error(`Source EIB tender ${SOURCE_TENDER_ID} missing documents`);
  }

  const prior = await prisma.tender.findUnique({
    where: { id: PRIOR_COMPLETED_ID },
    include: { requirements: true, decision: true },
  });
  const beforeCount = prior?.requirements.length ?? null;
  const beforeAuthorityLeaks =
    prior?.requirements.filter((r) => {
      const a = attributeObligationActor(r.description);
      return (
        a.actor === "AUTHORITY_SIDE" ||
        a.actor === "DOCUMENT_PROCEDURE" ||
        a.actor === "CLARIFICATION_CONTEXT" ||
        !isRealBidderObligation(r.description) ||
        AUTHORITY_NEVER.some((p) => r.description.includes(p))
      );
    }).length ?? null;

  const clone = await prisma.tender.create({
    data: {
      companyId: source.companyId,
      title: `EIB hardening E2E ${new Date().toISOString()}`,
      status: "DRAFT",
      analysisStatus: "ANALYZING",
      country: source.country,
      industry: source.industry,
      client: source.client,
    },
  });

  for (const doc of source.documents) {
    const filePath = resolveDocPath(source.companyId, source.id, doc.storageKey);
    const body = fs.readFileSync(filePath);
    const stored = await storageService.putObject({
      companyId: source.companyId,
      tenderId: clone.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType || "application/pdf",
      body,
    });
    await prisma.tenderDocument.create({
      data: {
        tenderId: clone.id,
        companyId: source.companyId,
        fileName: doc.fileName,
        storageKey: stored.storageKey,
        mimeType: stored.detectedMimeType,
        fileSize: stored.byteLength,
        checksumSha256: stored.checksumSha256,
        documentKind: doc.documentKind ?? "TENDER",
        processingStatus: "PENDING",
      },
    });
  }

  console.log("Created clone", clone.id, "docs", source.documents.length);
  const t0 = Date.now();
  await processTenderAnalysis(clone.id);
  const elapsedMs = Date.now() - t0;

  const result = await prisma.tender.findUnique({
    where: { id: clone.id },
    include: {
      requirements: { orderBy: { sortOrder: "asc" } },
      decision: true,
      nextActions: true,
    },
  });
  if (!result) throw new Error("clone missing after analysis");

  const intel = (result.decision?.intelligenceBreakdown ?? null) as Intel | null;
  const summary = intel?.complianceSummary;
  const snap = intel?.canonicalSnapshot?.counts;
  const actionPlan = intel?.actionPlan;
  const matrix = (intel?.complianceMatrix ?? []) as ComplianceRow[];
  const recommendation = intel?.tenderDecisionRecommendation as
    | TenderDecisionRecommendation
    | undefined;
  const readiness = intel?.readiness ?? null;
  const explainBuilt =
    recommendation != null
      ? buildExplainableDecision({
          recommendation,
          complianceMatrix: matrix,
          readiness: readiness ?? null,
          evidenceIntelligence: (intel?.evidenceIntelligence as never) ?? null,
        })
      : null;
  const explain = explainBuilt?.executiveSummary;

  const reqs = result.requirements;
  const actorBreakdown = { BIDDER_SIDE: 0, AUTHORITY_SIDE: 0, DOCUMENT_PROCEDURE: 0, CLARIFICATION_CONTEXT: 0, UNATTRIBUTED: 0 };
  const nonBidder: Array<{ actor: string; desc: string }> = [];
  for (const r of reqs) {
    const a = attributeObligationActor(r.description);
    actorBreakdown[a.actor] = (actorBreakdown[a.actor] ?? 0) + 1;
    const isAuthorityLeak =
      a.actor === "AUTHORITY_SIDE" ||
      a.actor === "DOCUMENT_PROCEDURE" ||
      a.actor === "CLARIFICATION_CONTEXT" ||
      !isRealBidderObligation(r.description);
    if (isAuthorityLeak) {
      nonBidder.push({ actor: a.actor, desc: r.description.slice(0, 160) });
    }
  }

  const neverHits = AUTHORITY_NEVER.filter((p) =>
    reqs.some((r) => r.description.includes(p)),
  );

  const headingOnly = reqs.filter((r) => {
    const a = attributeObligationActor(r.description);
    return a.reason === "section_heading_only" || a.actor === "DOCUMENT_PROCEDURE";
  });

  const total = summary?.totalRequirements ?? reqs.length;
  const verified = summary?.verifiedRequirements ?? 0;
  const needs = summary?.needsVerification ?? 0;
  const gaps = summary?.confirmedGaps ?? 0;
  const na = summary?.notApplicable ?? 0;
  const partitionOk = verified + needs + gaps + na === total;

  const snapTotal = snap?.totalRequirements ?? null;
  const explainTotal = explain?.canonicalTotalRequirements ?? null;
  const explainNeeds = explain?.canonicalNeedsVerification ?? null;
  const why = explain?.whyHeadline ?? "";

  const linkedActions = (actionPlan?.items ?? []).filter((i) => i.linkedRequirementId);
  const actionTextOk =
    linkedActions.length === 0 ||
    linkedActions.every((i) => {
      const full = (i.requirementText ?? "").trim();
      if (!full) return false;
      if (full.endsWith("…") && full.length < 120) return false;
      // Complete stored requirement text — not a truncated preview.
      return full.length >= 20 && !/\s\.\.\.\s*$/.test(full);
    });

  const incompleteCanon = reqs.filter(
    (r) => r.description.trim().length < 12 || /…\s*$/.test(r.description.trim()),
  );

  const whyUsesCanonical =
    needs === 0 ||
    /canonical requirement/i.test(why) ||
    new RegExp(`${needs}\\s+canonical`, "i").test(why) ||
    !/^\d+\s+items?\s+require\s+verification/i.test(why);

  const invariants = {
    statusCompleted: result.analysisStatus === "COMPLETED",
    zeroAuthorityLeaks: nonBidder.length === 0 && neverHits.length === 0,
    zeroHeadingDocProcedure: headingOnly.length === 0,
    zeroIncomplete: incompleteCanon.length === 0,
    partitionOk,
    totalsAligned:
      snapTotal === total &&
      (explainTotal == null || explainTotal === total) &&
      (explainNeeds == null || explainNeeds === needs),
    whyUsesCanonical,
    actionsReferenceIds: linkedActions.length === 0 || linkedActions.every((i) => Boolean(i.linkedRequirementId)),
    actionTextComplete: actionTextOk,
  };

  const report = {
    cloneId: clone.id,
    elapsedMs,
    status: result.analysisStatus,
    beforeCount,
    beforeAuthorityLeaks,
    afterCount: reqs.length,
    leaksRemoved:
      beforeAuthorityLeaks != null ? Math.max(0, beforeAuthorityLeaks - nonBidder.length) : null,
    actorBreakdown,
    nonBidder,
    neverHits,
    partition: { total, verified, needs, gaps, na, partitionOk },
    snapTotal,
    explain: { why, explainTotal, explainNeeds, reviewItemCount: explain?.reviewItemCount },
    actionPlan: {
      itemCount: actionPlan?.items?.length ?? 0,
      linkedCount: linkedActions.length,
      actionTextOk,
      sample: linkedActions.slice(0, 3).map((i) => ({
        id: i.linkedRequirementId,
        reqLen: (i.requirementText ?? "").length,
        preview: (i.requirementText ?? i.description ?? "").slice(0, 80),
      })),
    },
    invariants,
  };

  const outPath = path.join(".data", "artifacts", "eib-hardening-e2e.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const failed = Object.entries(invariants).filter(([, v]) => !v);
  if (failed.length) {
    console.error("FAILED INVARIANTS:", failed.map(([k]) => k));
    process.exit(1);
  }
  console.log("EIB E2E PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
