import { readFileSync } from "node:fs";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";

const PDF =
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtk43nw100i5rkr04tkf5qb3/1788354511070-Bidvera_Stress_Test_Tender_2026.pdf";

const PROFILE: RuleCompanyProfile = {
  companyName: "NetCo",
  industry: "IT",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["network", "security"],
  certifications: [],
  experienceYears: 5,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

async function main() {
  const buf = readFileSync(PDF);
  const extracted = await extractDocumentText({
    buffer: buf,
    mimeType: "application/pdf",
    fileName: "Bidvera_Stress_Test_Tender_2026.pdf",
  });
  const text = extracted.text;
  const heuristic = extractTenderPackageHeuristic({
    text,
    fileName: "Bidvera_Stress_Test_Tender_2026.pdf",
  });

  console.log("Heuristic drafts:", heuristic.requirements.length);
  for (const r of heuristic.requirements) {
    console.log(" H:", r.description.slice(0, 120));
  }

  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: "Bidvera_Stress_Test_Tender_2026.pdf",
  });

  console.log("\nCanonical:", canonical.length);
  for (const r of canonical) {
    console.log(
      " C:",
      r.semanticKind,
      r.obligationStrength,
      r.mandatory ? "M" : "-",
      r.requirement.slice(0, 100),
    );
  }

  const requirements = canonical.map((r, i) => ({
    id: `r${i + 1}`,
    category: r.category,
    description: r.requirement,
    mandatory: r.mandatory,
    value: r.value ?? null,
    status: "UNCERTAIN" as const,
    sourcePage: r.page ?? null,
    sourceSection: r.sourceSection ?? null,
    evidence: r.evidenceText ?? null,
  }));

  const engine = runDecisionEngine({
    profile: PROFILE,
    requirements,
    estimatedValue: heuristic.estimatedValue,
    tenderContext: {
      title: "Stress",
      client: "NABC",
      country: "Morocco",
      industry: "IT",
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
      evidence: r.evidence,
    })),
    missingDocuments: [],
    profileHasAnyCapability: true,
  });

  const intel = buildTenderIntelligence({
    tenderId: "stress",
    documentName: "Bidvera_Stress_Test_Tender_2026.pdf",
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    extractedText: text,
    requirements: engine.requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: r.page ?? null,
      sourceSection: r.section ?? null,
      evidence: r.evidence ?? null,
    })),
    evidence: [],
    readiness,
    findings: engine.findings,
    existingRisks: [],
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: false,
    readiness: {
      score: readiness.score,
      counts: readiness.counts,
      attention: readiness.attention,
      recommendation: readiness.recommendation,
    },
    compliance: intel.complianceSummary,
    complianceMatrix: intel.complianceMatrix,
    keyBlockers: intel.keyBlockers,
    reviewItems: intel.reviewItems,
    decisionDrivers: intel.decisionDrivers,
    actionItems: intel.actionItems,
  });

  const plan = buildTenderActionPlan({
    tenderId: "stress",
    companyId: "c1",
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    complianceMatrix: intel.complianceMatrix,
    evidenceIntelligence: intel.evidenceIntelligence ?? null,
    risks: intel.risks,
    keyBlockers: intel.keyBlockers,
    readiness: { attention: readiness.attention, items: readiness.items },
    fitBreakdown: engine.fitBreakdown,
    recommendation: finalized.recommendation,
    teamTasks: [],
  });

  console.log("\nActions:", plan.items.length, "blocking:", plan.items.filter((a) => a.blocking).length);
  for (const a of plan.items) {
    console.log(
      " A:",
      a.blocking ? "BLOCK" : "----",
      a.sourceType,
      a.linkedRequirementId ?? "-",
      a.title.slice(0, 90),
    );
  }

  console.log("\nKeyBlockers:", intel.keyBlockers);
  console.log("ReviewItems:", intel.reviewItems);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
