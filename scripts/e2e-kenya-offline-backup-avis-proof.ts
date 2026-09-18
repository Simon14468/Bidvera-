/**
 * ONE real PDF E2E proof: AVIS role must not force CPS/TECHNICAL_SPECIFICATION missing.
 *
 * This is a read-only proof runner: it uses canonical domain modules only and
 * still enforces package completeness gates + Decision Guardian final integrity.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";

import { assembleTenderPackage, evaluatePackageScoringGate } from "@/domain/tender-package";
import {
  assertAnalysisReadyForCompletion,
  buildCanonicalRequirements,
} from "@/domain/tender-requirements";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
  DecisionGuardianError,
} from "@/domain/decision-validation";
import type { RuleCompanyProfile } from "@/domain/decision/types";

import type { NormalizedRequirement } from "@/domain/tender-requirements";

const PDF = resolve(
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtlnno191cv6rkz49a6wedp1/1788447823241-OFFLINE_BACKUP.pdf",
);
const FILE_NAME = "1788447823241-OFFLINE_BACKUP.pdf";
const ANALYSIS_ID = `e2e-kenya-offline-${Date.now()}`;

const PROFILE: RuleCompanyProfile = {
  companyName: "E2E Proof Company",
  industry: "General Services",
  country: "Kenya",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["technical support", "procurement compliance"],
  certifications: [],
  experienceYears: 5,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Kenya"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

function toCompletenessReqs(canonical: NormalizedRequirement[]) {
  return canonical.map((r) => ({
    semanticKind: r.semanticKind,
    obligationStrength: r.obligationStrength,
    mandatory: r.mandatory,
    requirement: r.requirement,
    category: r.category,
  }));
}

async function main() {
  const buf = readFileSync(PDF);
  const sourceFileHash = createHash("sha256").update(buf).digest("hex");

  const extracted = await extractDocumentText({
    buffer: buf,
    mimeType: "application/pdf",
    fileName: FILE_NAME,
  });
  const text = extracted.text;
  if (text.trim().length < 200) {
    throw new Error(`E2E Kenya OFFLINE_BACKUP: extracted text too short (${text.length} chars)`);
  }

  const heuristic = extractTenderPackageHeuristic({ text, fileName: FILE_NAME });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: FILE_NAME,
  });

  if (canonical.length === 0) {
    throw new Error("E2E Kenya OFFLINE_BACKUP: canonical requirement set is empty");
  }

  // Gate tracing: AVIS must not force CPS/TECHNICAL_SPECIFICATION missing
  const assembly = assembleTenderPackage([
    { fileName: FILE_NAME, documentKind: "TENDER", text },
  ]);
  const gate = evaluatePackageScoringGate({
    assembly,
    reliableRequirementCount: canonical.length,
    canonicalRequirements: toCompletenessReqs(canonical),
  });

  if (!gate.allowScoring) {
    throw new Error(
      `E2E Kenya OFFLINE_BACKUP blocked by package gate: ${gate.reason} (missing=${gate.missingDocumentTypes.join(",")})`,
    );
  }
  if (gate.reason === "ONLY_AVIS") {
    throw new Error("E2E Kenya OFFLINE_BACKUP: gate should not remain ONLY_AVIS when substantive canonical obligations exist");
  }
  if (gate.missingDocumentTypes.length > 0) {
    throw new Error(
      `E2E Kenya OFFLINE_BACKUP: gate reported missing docs unexpectedly: ${gate.missingDocumentTypes.join(",")}`,
    );
  }

  const requirements = canonical.map((r, i) => ({
    id: r.id ?? `kenya-r${i + 1}`,
    category: r.category,
    description: r.requirement,
    mandatory: r.mandatory,
    value: r.value ?? null,
    status: "UNCERTAIN" as const,
    sourcePage: r.page ?? null,
    section: r.sourceSection ?? null,
    evidence: r.evidenceText ?? null,
    semanticKind: r.semanticKind ?? null,
    obligationStrength: r.obligationStrength,
  }));

  const engine = runDecisionEngine({
    profile: PROFILE,
    requirements,
    estimatedValue: heuristic.estimatedValue,
    tenderContext: {
      title: heuristic.title ?? "Kenya OFFLINE_BACKUP tender",
      client: heuristic.client ?? "Client",
      country: heuristic.country ?? "Kenya",
      industry: heuristic.industry ?? null,
      tenderText: text,
    },
  });

  const readiness = computeTenderReadiness({
    requirements: engine.requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence ?? null,
    })),
    missingDocuments: [],
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: ANALYSIS_ID,
    documentName: FILE_NAME,
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    extractedText: text,
    requirements: engine.requirements.map((r, i) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: r.status,
      sourcePage: typeof r.page === "number" ? r.page : null,
      sourceSection: typeof r.section === "string" ? r.section : null,
      evidence: r.evidence ?? null,
      semanticKind: r.semanticKind ?? canonical[i]?.semanticKind ?? null,
    })),
    evidence: [],
    readiness,
    findings: engine.findings,
    existingRisks: [],
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  assertAnalysisReadyForCompletion({ requirements: canonical, intelligence });
  if (intelligence.complianceSummary.totalRequirements !== canonical.length) {
    throw new Error("E2E Kenya OFFLINE_BACKUP: compliance total diverged from canonical requirement count");
  }

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: false,
    readiness: {
      score: readiness.score,
      counts: readiness.counts,
      attention: readiness.attention,
      recommendation: readiness.recommendation,
    },
    compliance: intelligence.complianceSummary,
    complianceMatrix: intelligence.complianceMatrix,
    keyBlockers: intelligence.keyBlockers,
    reviewItems: intelligence.reviewItems,
    decisionDrivers: intelligence.decisionDrivers,
    actionItems: intelligence.actionItems,
  });

  const actionPlan = buildTenderActionPlan({
    tenderId: ANALYSIS_ID,
    companyId: "e2e-proof-c1",
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    complianceMatrix: intelligence.complianceMatrix,
    evidenceIntelligence: intelligence.evidenceIntelligence ?? null,
    risks: intelligence.risks,
    keyBlockers: intelligence.keyBlockers,
    readiness: { attention: readiness.attention, items: readiness.items },
    fitBreakdown: engine.fitBreakdown,
    recommendation: finalized.recommendation,
    teamTasks: [],
  });
  intelligence.actionPlan = actionPlan;

  const guardianReqs = engine.requirements.map((r, i) => {
    const c = canonical[i];
    const fit = r.fitStatus ?? null;
    return {
      id: r.id ?? c?.id ?? `r${i + 1}`,
      requirement: r.description,
      category: r.category,
      semanticKind: r.semanticKind ?? c?.semanticKind ?? null,
      obligationStrength: c?.obligationStrength ?? null,
      mandatory: r.mandatory,
      sourceSection: (typeof r.section === "string" ? r.section : null) ?? c?.sourceSection ?? null,
      page: (typeof r.page === "number" ? r.page : null) ?? c?.page ?? null,
      evidenceText: c?.evidenceText ?? r.evidence ?? null,
      fitStatus: fit ?? r.status ?? null,
      hasCompanyEvidence:
        fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP" ? Boolean(r.evidence) : false,
      companyEvidenceText:
        fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP" ? r.evidence ?? null : null,
    };
  });

  const contentHash = hashCanonicalReleasePayload(
    intelligence.complianceMatrix.map((row) => ({
      id: row.requirementId,
      text: row.requirement,
    })),
  );

  const guardianInput = buildDecisionGuardianInput({
    textLength: text.trim().length,
    readable: true,
    validityPassed: true,
    fileName: FILE_NAME,
    requirements: guardianReqs,
    matrix: intelligence.complianceMatrix.map((row) => ({
      requirementId: row.requirementId,
    })),
    readinessItems: readiness.items.map((item) => ({ id: item.id })),
    actions: actionPlan.items.map((a) => ({
      linkedRequirementId: a.linkedRequirementId,
      blocking: a.blocking,
      sourceType: a.sourceType,
      title: a.title,
      simulationOnly: a.simulationOnly,
    })),
    decision: {
      decision: engine.decision,
      hardFailure: Boolean(finalized.recommendation?.hardFailure),
      hardBlockerCount: intelligence.keyBlockers.length,
      aiOverrodeCanonical: false,
    },
    deadline: {
      deadlineIso: heuristic.deadlineIso,
      deadlineTimezone: heuristic.deadlineTimezone,
      sourceEvidence: heuristic.deadlineEvidence ?? heuristic.deadlineIso,
    },
    fitScore: engine.fitScore,
    fitBreakdownOverall: engine.fitBreakdown?.overall ?? null,
    reasoning: engine.reasoning,
    complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
    tenderSourceText: text.slice(0, 80_000),
    risks: intelligence.risks.map((risk) => ({
      id: risk.id,
      requirementId: risk.requirementId ?? null,
      severity: risk.severityCanonical ?? risk.severity,
      fitStatus: risk.fitStatus ?? null,
      evidenceState: risk.evidenceState ?? null,
      title: risk.title,
    })),
    staleResult: {
      canonicalContentHash: contentHash,
      projectedContentHash: contentHash,
    },
  });

  try {
    const release = assertFinalReleaseIntegrity(guardianInput, contentHash);
    intelligence.decisionGuardian = release.snapshot;
    // F — report projection uses the same canonical slice.
    // Web/PDF projection identity is enforced by Decision Guardian's final checklist.

    console.log(
      JSON.stringify(
        {
          analysisId: ANALYSIS_ID,
          fileName: FILE_NAME,
          sourceFileHash,
          detectedRoles: assembly.rolesPresent,
          packageCompleteness: assembly.completeness,
          gateReason: gate.reason,
          canonicalRequirementCount: canonical.length,
          complianceMatrixCount: intelligence.complianceMatrix.length,
          decision: engine.decision,
          guardianOk: true,
        },
        null,
        2,
      ),
    );

    mkdirSync(resolve(".data/artifacts"), { recursive: true });
    const outPath = resolve(`.data/artifacts/e2e-kenya-offline-avis-${Date.now()}.json`);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          analysisId: ANALYSIS_ID,
          fileName: FILE_NAME,
          canonicalCount: canonical.length,
          complianceMatrixCount: intelligence.complianceMatrix.length,
          decision: engine.decision,
          gate,
          release: { ok: true, validatedAt: release.snapshot?.validatedAt },
        },
        null,
        2,
      ),
    );
    console.log(`PASS — wrote ${outPath}`);
  } catch (err) {
    if (err instanceof DecisionGuardianError) {
      console.error("FAIL — Decision Guardian blocked release:", err.result.blockingFailures);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

