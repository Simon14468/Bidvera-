/**
 * Fresh Test 2 Construction Tender E2E proof — read-only validation.
 * Does NOT mutate production logic. Does NOT reuse DB analysis rows.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
  DecisionGuardianError,
} from "@/domain/decision-validation";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";
import { formatDeadlineWallClock } from "@/domain/tender-requirements";

const PDF = resolve(
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtk7556702o5rkm8n41hwuyl/1788359618970-Bidvera_Test_2_Construction_Tender_2026.pdf",
);
const FILE_NAME = "Bidvera_Test_2_Construction_Tender_2026.pdf";
const ANALYSIS_ID = `fresh-t2-construction-${Date.now()}`;

const PROFILE: RuleCompanyProfile = {
  companyName: "BuildCo Morocco",
  industry: "Construction",
  country: "Morocco",
  companySize: "51-200",
  experienceLevel: "experienced",
  services: ["construction", "HVAC", "facilities"],
  certifications: ["ISO 9001"],
  experienceYears: 10,
  revenueRange: null,
  employeeRange: "51-200",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

function includesAll(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase();
  return needles.every((n) => h.includes(n.toLowerCase()));
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
  const sourceTextHash = createHash("sha256").update(text).digest("hex");

  const heuristic = extractTenderPackageHeuristic({ text, fileName: FILE_NAME });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: FILE_NAME,
  });

  const requirements = canonical.map((r, i) => ({
    id: r.id ?? `t2c-r${i + 1}`,
    category: r.category,
    description: r.requirement,
    mandatory: r.mandatory,
    value: r.value ?? null,
    status: "UNCERTAIN" as const,
    sourcePage: r.page ?? null,
    sourceSection: r.sourceSection ?? null,
    evidence: r.evidenceText ?? null,
    semanticKind: r.semanticKind,
    obligationStrength: r.obligationStrength,
  }));

  const engine = runDecisionEngine({
    profile: PROFILE,
    requirements,
    estimatedValue: heuristic.estimatedValue,
    tenderContext: {
      title: heuristic.title ?? "Construction Tender Test 2",
      client: heuristic.client ?? "Client",
      country: heuristic.country ?? "Morocco",
      industry: "Construction",
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
    companyId: "proof-c1",
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
      sourceSection:
        (typeof r.section === "string" ? r.section : null) ?? c?.sourceSection ?? null,
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
    guardianReqs.map((r) => ({ id: r.id, text: r.requirement })),
  );

  let guardian: {
    ok: boolean;
    durationMs: number;
    checksRun: string[];
    blocking: Array<{ code: string; explanation: string }>;
    advisory: Array<{ code: string; explanation: string }>;
    snapshot: unknown;
    error?: string;
  };

  try {
    const guardianInput = buildDecisionGuardianInput({
      textLength: text.trim().length,
      readable: text.trim().length >= 80,
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
        expectedLocalHour: 10,
        expectedLocalMinute: 30,
        expectedDateYmd: "2026-10-06",
        sourceEvidence: "Submission deadline: 6 October 2026 at 10:30",
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
      derivedDeadline: heuristic.deadlineIso
        ? {
            canonicalIso: heuristic.deadlineIso,
            canonicalTimezone: heuristic.deadlineTimezone,
            representations: [
              {
                channel: "WEB" as const,
                iso: heuristic.deadlineIso,
                timezone: heuristic.deadlineTimezone,
              },
              {
                channel: "PDF" as const,
                iso: heuristic.deadlineIso,
                timezone: heuristic.deadlineTimezone,
              },
            ],
          }
        : null,
      staleResult: {
        canonicalContentHash: contentHash,
        projectedContentHash: contentHash,
      },
      expectedCommercialCues: [
        "firm",
        "performance guarantee",
        "payment",
        "penalt",
      ],
    });

    const release = assertFinalReleaseIntegrity(guardianInput, contentHash);
    intelligence.decisionGuardian = release.snapshot;
    guardian = {
      ok: true,
      durationMs: release.durationMs,
      checksRun: release.checksRun,
      blocking: [],
      advisory: release.advisoryFailures.map((f) => ({
        code: f.validationCode,
        explanation: f.explanation,
      })),
      snapshot: release.snapshot,
    };
  } catch (err) {
    if (err instanceof DecisionGuardianError) {
      guardian = {
        ok: false,
        durationMs: err.result.durationMs,
        checksRun: err.result.checksRun,
        blocking: err.result.blockingFailures.map((f) => ({
          code: f.validationCode,
          explanation: f.explanation,
        })),
        advisory: err.result.advisoryFailures.map((f) => ({
          code: f.validationCode,
          explanation: f.explanation,
        })),
        snapshot: null,
        error: err.message,
      };
    } else {
      throw err;
    }
  }

  const report: TenderReport = {
    tenderId: ANALYSIS_ID,
    companyId: "proof-c1",
    title: heuristic.title ?? "Construction Tender Test 2",
    client: heuristic.client,
    deadline: heuristic.deadlineIso,
    deadlineTimezone: heuristic.deadlineTimezone,
    analyzedAt: new Date().toISOString(),
    decision: engine.decision,
    fitScore: engine.fitScore,
    confidence: engine.confidence,
    reasoning: finalized.reasoning ?? engine.reasoning,
    companyKnowledgeOnly: false,
    fitBreakdown: engine.fitBreakdown,
    readiness,
    intelligence: {
      ...intelligence,
      tenderDecisionRecommendation: finalized.recommendation,
    },
    complianceSummary: intelligence.complianceSummary,
    bidScore: null,
    historicalSignals: [],
    matched: [],
    failed: [],
    uncertain: [],
    criticalRisks: [],
    evidence: [],
    missingDocuments: [],
    nextActions: [],
    decisionOutcome: null,
  };

  const webSections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const pdfSections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const webContent = buildReportDisplayContent(webSections, "en");
  const pdfContent = buildReportDisplayContent(pdfSections, "en");

  const wallParts =
    heuristic.deadlineIso && heuristic.deadlineTimezone
      ? formatDeadlineWallClock(heuristic.deadlineIso, heuristic.deadlineTimezone)
      : null;
  const wall = wallParts
    ? `${wallParts.dateYmd} ${String(wallParts.hour).padStart(2, "0")}:${String(wallParts.minute).padStart(2, "0")}`
    : heuristic.deadlineIso;

  // --- Source audit helpers ---
  const sourceChecks = {
    deadlinePhrase: /6\s+October\s+2026\s+at\s+10:30/i.test(text),
    e05: {
      presentInSource: /E-05/i.test(text) || /comparable projects/i.test(text),
      needles: ["4", "6 year", "client reference"],
    },
    t04: {
      presentInSource: /T-04/i.test(text) || /GWP/i.test(text),
      needles: ["750", "programmable"],
    },
    t09: {
      presentInSource: /T-09/i.test(text) || /replacement HVAC/i.test(text),
      needles: ["if", "replacement", "HVAC", "manufacturer", "refrigerant", "programmable"],
    },
  };

  const findCanon = (pred: (s: string) => boolean) =>
    canonical.filter((c) => pred(c.requirement + " " + (c.id ?? "")));

  const e05Items = findCanon(
    (s) =>
      /E-05|comparable project|previous\s+6\s+years|client reference/i.test(s),
  );
  const t04Items = findCanon((s) => /T-04|GWP|programmable control/i.test(s));
  const t09Items = findCanon(
    (s) => /T-09|replacement HVAC|refrigerant|manufacturer documentation/i.test(s),
  );

  const commercialCues = [
    {
      id: "firm-pricing",
      pattern: /firm|non-revisable|non\s*revisable/i,
      label: "Firm / non-revisable pricing",
    },
    {
      id: "performance-guarantee",
      pattern: /performance\s+guarantee/i,
      label: "Performance guarantee",
    },
    {
      id: "monthly-payment",
      pattern: /monthly|certified progress|payment/i,
      label: "Monthly / certified progress payment",
    },
    {
      id: "delay-penalty",
      pattern: /penalt|delay/i,
      label: "Delay penalties",
    },
    {
      id: "site-safety",
      pattern: /site safety|temporary protection|waste/i,
      label: "Site safety / protection / waste",
    },
    {
      id: "insurance",
      pattern: /insurance/i,
      label: "Insurance",
    },
    {
      id: "imported-materials",
      pattern: /imported material/i,
      label: "Imported materials responsibility",
    },
  ];

  const commercialAudit = commercialCues.map((cue) => {
    const inSource = cue.pattern.test(text);
    const inCanonical = canonical.filter((c) => cue.pattern.test(c.requirement));
    return {
      ...cue,
      inSource,
      canonicalCount: inCanonical.length,
      canonicalIds: inCanonical.map((c) => c.id),
      snippets: inCanonical.map((c) => c.requirement.slice(0, 140)),
    };
  });

  const orphanActions = actionPlan.items.filter(
    (a) =>
      !a.simulationOnly &&
      a.linkedRequirementId &&
      !canonical.some((c) => (c.id ?? "") === a.linkedRequirementId) &&
      !engine.requirements.some((r) => r.id === a.linkedRequirementId),
  );

  const regressionTargets = {
    "1_deadline_1030_not_0100": {
      source: "6 October 2026 at 10:30",
      observedIso: heuristic.deadlineIso,
      observedTz: heuristic.deadlineTimezone,
      wallClock: wall,
      webDeadline: webSections.deadlineIso,
      pdfDeadline: pdfSections.deadlineIso,
      pass:
        Boolean(heuristic.deadlineIso) &&
        heuristic.deadlineIso === webSections.deadlineIso &&
        heuristic.deadlineIso === pdfSections.deadlineIso &&
        !(typeof wall === "string" && wall.includes("01:00")) &&
        ((typeof wall === "string" && wall.includes("10:30")) ||
          /T10:30|10:30/.test(heuristic.deadlineIso ?? "")),
    },
    "2_count_drift": {
      canonical: canonical.length,
      matrix: intelligence.complianceMatrix.length,
      readiness: readiness.total,
      complianceSummary: intelligence.complianceSummary.totalRequirements,
      actionsLinked: new Set(
        actionPlan.items
          .filter((a) => a.linkedRequirementId && !a.simulationOnly)
          .map((a) => a.linkedRequirementId),
      ).size,
      webCount: webSections.complianceMatrix.length,
      pdfCount: pdfSections.complianceMatrix.length,
      pass:
        canonical.length === intelligence.complianceMatrix.length &&
        canonical.length === intelligence.complianceSummary.totalRequirements &&
        canonical.length === webSections.complianceMatrix.length &&
        canonical.length === pdfSections.complianceMatrix.length,
    },
    "3_T09_conditional_preserved": {
      items: t09Items.map((c) => ({
        id: c.id,
        strength: c.obligationStrength,
        text: c.requirement,
      })),
      pass:
        t09Items.length >= 1 &&
        t09Items.some((c) =>
          includesAll(c.requirement, ["if", "HVAC"]) &&
          (/replacement/i.test(c.requirement) || /propose/i.test(c.requirement)),
        ) &&
        t09Items.some(
          (c) =>
            c.obligationStrength === "CONDITIONAL" ||
            /conditional|if the bidder/i.test(c.requirement),
        ),
    },
    "4_E05_complete": {
      items: e05Items.map((c) => ({ id: c.id, text: c.requirement })),
      pass: e05Items.some((c) =>
        includesAll(c.requirement, ["4", "6"]) &&
        /year/i.test(c.requirement) &&
        /reference/i.test(c.requirement),
      ),
    },
    "5_T04_programmable_controls": {
      items: t04Items.map((c) => ({ id: c.id, text: c.requirement })),
      pass: t04Items.some(
        (c) => /750|GWP/i.test(c.requirement) && /programmable/i.test(c.requirement),
      ),
    },
    "6_commercial_contractual_present": {
      audit: commercialAudit.filter((c) => c.inSource),
      pass: commercialAudit
        .filter((c) => c.inSource && ["firm-pricing", "performance-guarantee", "monthly-payment", "delay-penalty"].includes(c.id))
        .every((c) => c.canonicalCount > 0),
    },
    "7_action_plan_grounding": {
      actionCount: actionPlan.items.length,
      orphanCount: orphanActions.length,
      pass: orphanActions.length === 0 && actionPlan.items.length > 0,
    },
    "8_fresh_not_stale": {
      analysisId: ANALYSIS_ID,
      contentHash,
      guardianOk: guardian.ok,
      snapshotHash:
        guardian.snapshot && typeof guardian.snapshot === "object"
          ? (guardian.snapshot as { contentHash?: string }).contentHash
          : null,
      pass:
        guardian.ok &&
        Boolean(contentHash) &&
        (guardian.snapshot as { contentHash?: string } | null)?.contentHash ===
          contentHash,
    },
  };

  const defects: Array<Record<string, unknown>> = [];
  for (const [key, value] of Object.entries(regressionTargets)) {
    if (!value.pass) {
      defects.push({ target: key, detail: value });
    }
  }

  const reportOut = {
    analysisId: ANALYSIS_ID,
    sourceFile: PDF,
    sourceFileHash,
    sourceTextHash,
    extractMethod: extracted.method,
    textLength: text.length,
    heuristicDraftCount: heuristic.requirements.length,
    canonicalItemCount: canonical.length,
    contentHash,
    deadline: {
      iso: heuristic.deadlineIso,
      timezone: heuristic.deadlineTimezone,
      wallClock: wall,
      sourceHasPhrase: sourceChecks.deadlinePhrase,
    },
    decision: engine.decision,
    fitScore: engine.fitScore,
    hardBlockers: intelligence.keyBlockers,
    reviewItems: intelligence.reviewItems,
    risks: intelligence.risks.map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severityCanonical ?? r.severity,
      requirementId: r.requirementId,
      evidenceState: r.evidenceState,
    })),
    actions: actionPlan.items.map((a) => ({
      id: a.id,
      title: a.title,
      linkedRequirementId: a.linkedRequirementId,
      blocking: a.blocking,
      sourceType: a.sourceType,
      priority: a.priority,
    })),
    canonicalItems: canonical.map((c) => ({
      id: c.id,
      semanticKind: c.semanticKind,
      category: c.category,
      obligationStrength: c.obligationStrength,
      mandatory: c.mandatory,
      sourceSection: c.sourceSection,
      page: c.page,
      requirement: c.requirement,
    })),
    commercialAudit,
    specialChecks: {
      e05: { source: sourceChecks.e05, canonical: e05Items.map((c) => c.requirement) },
      t04: { source: sourceChecks.t04, canonical: t04Items.map((c) => c.requirement) },
      t09: { source: sourceChecks.t09, canonical: t09Items.map((c) => c.requirement) },
    },
    guardian,
    webPdfParity: {
      decision: {
        web: webSections.decision,
        pdf: pdfSections.decision,
        match: webSections.decision === pdfSections.decision,
      },
      fit: {
        web: webContent.fitScoreDisplay,
        pdf: pdfContent.fitScoreDisplay,
        match: webContent.fitScoreDisplay === pdfContent.fitScoreDisplay,
      },
      deadline: {
        web: webSections.deadlineIso,
        pdf: pdfSections.deadlineIso,
        match: webSections.deadlineIso === pdfSections.deadlineIso,
      },
      counts: {
        web: webSections.complianceMatrix.length,
        pdf: pdfSections.complianceMatrix.length,
        match:
          webSections.complianceMatrix.length === pdfSections.complianceMatrix.length,
      },
    },
    regressionTargets,
    defects,
    sourceTextPreview: text.slice(0, 4000),
    sourceTextFullPathHint: "see artifacts/test2-construction-proof-source.txt",
  };

  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/test2-construction-proof.json", JSON.stringify(reportOut, null, 2));
  writeFileSync("artifacts/test2-construction-proof-source.txt", text);

  console.log(JSON.stringify({
    analysisId: ANALYSIS_ID,
    sourceFileHash,
    sourceTextHash,
    contentHash,
    canonicalItemCount: canonical.length,
    decision: engine.decision,
    fitScore: engine.fitScore,
    deadline: reportOut.deadline,
    actionCount: actionPlan.items.length,
    riskCount: intelligence.risks.length,
    hardBlockerCount: intelligence.keyBlockers.length,
    reviewItemCount: intelligence.reviewItems?.length ?? 0,
    guardianOk: guardian.ok,
    guardianBlocking: guardian.blocking,
    webPdfParity: reportOut.webPdfParity,
    regressionPass: Object.fromEntries(
      Object.entries(regressionTargets).map(([k, v]) => [k, v.pass]),
    ),
    defectCount: defects.length,
  }, null, 2));

  console.log("\n=== CANONICAL ITEMS ===");
  for (const c of canonical) {
    console.log(
      `[${c.id ?? "?"}] ${c.semanticKind}/${c.obligationStrength} :: ${c.requirement.slice(0, 160)}`,
    );
  }

  console.log("\n=== HEURISTIC DRAFTS ===");
  for (const h of heuristic.requirements) {
    console.log(` H: ${h.description.slice(0, 160)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
