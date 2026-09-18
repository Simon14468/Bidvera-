import { TEST_2_FIXTURE } from "../src/domain/tender-requirements/test-2-canonical-regression.test";
import { extractTenderPackageHeuristic } from "../src/services/tender-extraction/requirements-heuristic";
import { buildCanonicalRequirements } from "../src/domain/tender-requirements";
import { runDecisionEngine } from "../src/domain/decision/engine";
import type { RuleCompanyProfile } from "../src/domain/decision/types";
import { computeTenderReadiness } from "../src/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "../src/domain/tender-intelligence";
import { buildTenderActionPlan } from "../src/domain/tender-action-plan";
import { finalizeTenderDecision } from "../src/domain/decision/tender-decision-engine";

const PROFILE: RuleCompanyProfile = {
  companyName: "NetSec Co",
  industry: "IT",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["network", "security"],
  certifications: [],
  experienceYears: 6,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

const h = extractTenderPackageHeuristic({ text: TEST_2_FIXTURE, fileName: "t2.pdf" });
const c = buildCanonicalRequirements({ heuristicDrafts: h.requirements, sourceDocument: "t2.pdf" });
console.log("count", c.length);
c.forEach((r, i) =>
  console.log(i + 1, r.id ?? "-", r.semanticKind, r.sourceSection?.slice(0, 45), r.requirement.slice(0, 75)),
);
console.log("deadline", h.deadlineIso, h.deadlineTimezone);

const requirements = c.map((r, i) => ({
  id: r.id ?? `t2-r${i + 1}`,
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
  estimatedValue: 380_000,
  tenderContext: { title: "T2", client: "X", country: "Morocco", industry: "IT", tenderText: TEST_2_FIXTURE },
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

const intelligence = buildTenderIntelligence({
  tenderId: "test-2",
  documentName: "t2.pdf",
  tenderDeadline: null,
  extractedText: TEST_2_FIXTURE,
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
  compliance: intelligence.complianceSummary,
  complianceMatrix: intelligence.complianceMatrix,
  keyBlockers: intelligence.keyBlockers,
  reviewItems: intelligence.reviewItems,
  decisionDrivers: intelligence.decisionDrivers,
  actionItems: intelligence.actionItems,
});

const actionPlan = buildTenderActionPlan({
  tenderId: "test-2",
  companyId: "c1",
  tenderDeadline: null,
  complianceMatrix: intelligence.complianceMatrix,
  evidenceIntelligence: intelligence.evidenceIntelligence ?? null,
  risks: intelligence.risks,
  keyBlockers: intelligence.keyBlockers,
  readiness: { attention: readiness.attention, items: readiness.items },
  fitBreakdown: engine.fitBreakdown,
  recommendation: finalized.recommendation,
  teamTasks: [],
});

console.log("\nactions", actionPlan.items.filter((a) => !a.simulationOnly).length);
for (const a of actionPlan.items.filter((a) => !a.simulationOnly)) {
  console.log(a.linkedRequirementId, a.title.slice(0, 80));
}
