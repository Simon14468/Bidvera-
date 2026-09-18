import {
  buildCompanyEvidenceSource,
  buildRequirementTenderSource,
  buildTenderFactProvenance,
  NO_COMPANY_EVIDENCE_MESSAGE,
} from "@/domain/provenance";
import type { TenderFactKey } from "@/domain/provenance/types";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { DeterministicFinding } from "@/domain/decision/types";
import {
  buildVerificationIntelligence,
  isRealEvidenceText,
  selectBestEvidenceByRequirement,
  type CanonicalEvidenceRecord,
} from "@/domain/evidence-verification";
import { buildEvidenceIntelligence } from "@/domain/evidence-intelligence";
import { deriveRequirementVerificationStatus, formatLocationLabel } from "@/domain/evidence-verification/status";
import {
  buildDecisionSeverityView,
  assertDecisionSeverityConsistency,
} from "@/domain/decision/decision-severity";
import { collectMaterialHardBlockers } from "@/domain/decision/decision-integrity";
import {
  buildCanonicalStructuredRisks,
  classifyComplianceEvidenceState,
  complianceNoteForState,
  countIdentifiedRisks,
  enrichComplianceRowRiskFields,
} from "@/domain/risk";
import type { RequirementMatchStatus } from "@prisma/client";
import type {
  ClarificationQuestion,
  ComplianceRow,
  ComplianceSummary,
  ContradictionFinding,
  SourceBasis,
  StructuredRisk,
  TenderIntelligenceBreakdown,
} from "./types";

export type IntelligenceInput = {
  tenderId: string;
  documentName: string | null;
  tenderDeadline: Date | string | null;
  extractedText: string;
  requirements: Array<{
    id: string;
    category: string;
    description: string;
    mandatory: boolean;
    value: string | null;
    status: RequirementMatchStatus;
    sourcePage: number | "UNKNOWN" | null;
    sourceSection: string | null;
    evidence?: string | null;
    fitStatus?: import("@/domain/decision/requirement-fit-status").RequirementFitStatus | null;
    evidenceConflict?: boolean;
    semanticKind?: string | null;
    sourceDocument?: string | null;
    evidenceText?: string | null;
    sourceCell?: string | null;
    columnHeader?: string | null;
    rowLabel?: string | null;
    versionLabel?: string | null;
    locator?: string | null;
    sourceCompleteness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
    fitProvenanceExcerpt?: string | null;
  }>;
  /** Package-identity deadline excerpt — never recovered by rescanning raw text. */
  deadlineEvidence?: string | null;
  deadlineSourceDocument?: string | null;
  evidence: Array<{
    id: string;
    requirementId: string | null;
    sourcePage: number | null;
    sourceSection: string | null;
    evidenceText: string;
    verificationStatus: string;
    teamTaskId?: string | null;
    documentId?: string | null;
    documentName?: string | null;
    verificationReason?: string | null;
    verifiedById?: string | null;
    verifiedAt?: Date | string | null;
  }>;
  readiness: TenderReadinessBreakdown;
  findings: DeterministicFinding[];
  existingRisks: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    sourcePage: number | null;
    mitigation: string | null;
  }>;
  decision: "BID" | "REVIEW" | "NO_BID";
  fitScore: number;
};

function mapRequirementType(category: string): string {
  const c = category.toUpperCase();
  if (c === "MANDATORY_ELIGIBILITY") return "Eligibility";
  if (c === "MANDATORY_TECHNICAL") return "Technical";
  if (c === "MANDATORY_ADMINISTRATIVE") return "Documentation";
  if (c === "CONTRACTUAL") return "Contractual";
  if (c === "PREFERRED") return "Evaluation criterion";
  if (c === "INFORMATIONAL") return "Other";
  const lower = category.toLowerCase();
  if (/eligib|qualif|disqualif/.test(lower)) return "Eligibility";
  if (/cert/.test(lower)) return "Certification";
  if (/exper|years|trading/.test(lower)) return "Experience";
  if (/tech|spec|capability|service/.test(lower)) return "Technical";
  if (/doc|form|attach|annex/.test(lower)) return "Documentation";
  if (/financ|turnover|revenue|commercial|price|bond/.test(lower)) return "Commercial";
  if (/eval|score|award|weight/.test(lower)) return "Evaluation criterion";
  if (/contract|legal|liabil|term/.test(lower)) return "Contractual";
  if (/geo|location|country|region|nation/.test(lower)) return "Geographic";
  if (/submit|deadline|bid|tender/.test(lower)) return "Submission";
  return "Other";
}

function companyFitNote(
  status: RequirementMatchStatus,
  readinessStatus: ComplianceRow["status"],
): string | null {
  if (readinessStatus === "READY") {
    return "Appears satisfied based on company profile (requires verification).";
  }
  if (readinessStatus === "MISSING") return "Potential gap vs company profile.";
  if (readinessStatus === "VERIFY") {
    return "Requires verification against company profile.";
  }
  if (readinessStatus === "UNKNOWN") {
    return "Insufficient profile or tender information.";
  }
  if (status === "MATCHED") return "Profile check matched (assessment).";
  return null;
}

function realEvidence(text: string | null | undefined): string | null {
  return isRealEvidenceText(text) ? text!.trim().slice(0, 500) : null;
}

function toCanonicalEvidence(
  rows: IntelligenceInput["evidence"],
): CanonicalEvidenceRecord[] {
  return rows.map((e) => ({ ...e }));
}

/** @deprecated Use canonical risk module — kept for legacy row hydration without findings. */
function legacyRequiredActionForRow(
  status: ComplianceRow["status"],
  mandatory: boolean,
  notes: string | null,
): string | null {
  switch (status) {
    case "MISSING":
      return mandatory
        ? "Confirm whether this gap can be closed before bid submission."
        : "Decide whether to address this gap or accept the evaluation impact.";
    case "VERIFY":
      return (
        notes ??
        "Verify against company records and the tender wording before proceeding."
      );
    case "UNKNOWN":
      return "Gather additional tender or company evidence before deciding.";
    case "READY":
    case "NOT_APPLICABLE":
      return null;
    default:
      return null;
  }
}

function buildComplianceMatrix(input: IntelligenceInput): ComplianceRow[] {
  const readinessById = new Map(input.readiness.items.map((i) => [i.id, i]));
  const bestEvidence = selectBestEvidenceByRequirement(toCanonicalEvidence(input.evidence));

  return input.requirements.map((req, index) => {
    const ready = readinessById.get(req.id);
    const ev = bestEvidence.get(req.id) ?? null;

    const humanVerified =
      Boolean(ev?.teamTaskId) && ev?.verificationStatus === "VERIFIED";

    // Tender excerpt is the extracted source text. req.evidence / fitProvenance are company.
    const tenderExcerpt =
      realEvidence(req.evidenceText) ??
      (typeof req.sourcePage === "number" || req.sourceSection?.trim() || req.sourceCell
        ? realEvidence(req.description)
        : null);
    const pageNumber = typeof req.sourcePage === "number" ? req.sourcePage : null;
    const section = req.sourceSection?.trim() || null;
    const docName = req.sourceDocument?.trim() || null;
    const companyDocId =
      ev?.verificationStatus === "VERIFIED" || ev?.teamTaskId
        ? ev?.documentId ?? null
        : null;

    const tenderSource = buildRequirementTenderSource({
      documentName: docName,
      documentId: null,
      page: pageNumber,
      section,
      cell: req.sourceCell ?? null,
      columnHeader: req.columnHeader ?? null,
      rowLabel: req.rowLabel ?? null,
      versionLabel: req.versionLabel ?? null,
      locator: req.locator ?? null,
      completeness: req.sourceCompleteness ?? null,
      originalExcerpt: tenderExcerpt,
      normalizedRequirement: req.description,
      requirementType: mapRequirementType(req.category),
    });

    const companyEvidence = humanVerified
      ? buildCompanyEvidenceSource({
          excerpt: ev?.verificationReason ?? null,
          documentName: ev?.documentName ?? null,
          documentId: ev?.documentId ?? null,
          humanVerified: true,
          verificationStatus: "VERIFIED",
        })
      : buildCompanyEvidenceSource({
          excerpt: req.fitProvenanceExcerpt ?? null,
          documentName: ev?.documentName ?? null,
          documentId: companyDocId,
          humanVerified: false,
        });

    const sourceLocated = tenderSource.located;
    const excerpt = tenderExcerpt;

    const sourceBasis: SourceBasis = humanVerified
      ? "DIRECT_SOURCE"
      : tenderExcerpt
        ? "AI_INTERPRETATION"
        : "UNKNOWN";

    const status = ready?.status ?? "UNKNOWN";
    const notes = ready?.reason ?? null;
    const mandatory = req.mandatory;

    const verification = deriveRequirementVerificationStatus({
      readinessStatus: status,
      evidence: ev,
      requirementDescription: req.description,
      requirementValue: req.value,
      storedReason: ev?.verificationReason ?? null,
    });

    const humanRejected = ev?.verificationStatus === "REJECTED";

    const baseRow = {
      id: `CM-${index + 1}`,
      requirementId: req.id,
      requirement: req.description,
      requirementType: mapRequirementType(req.category),
      mandatory,
      priority: ready?.priority ?? (mandatory ? "HIGH" : "LOW"),
      status,
      companyFit: companyFitNote(req.status, status),
      sourceDocument: docName,
      pageNumber,
      section,
      evidence: excerpt,
      tenderSource,
      companyEvidence,
      companyEvidenceMessage: companyEvidence?.excerpt
        ? null
        : NO_COMPANY_EVIDENCE_MESSAGE,
      notes,
      sourceBasis,
      sourceLocated,
      evidenceId: ev?.id ?? null,
      verificationStatus: verification.status,
      verificationReason: verification.reason,
      locationLabel: formatLocationLabel({
        sourceDocument: docName,
        pageNumber,
        section,
      }),
      verifierLabel: ev?.teamTaskId ? "Team workflow reviewer" : null,
      verifiedAt:
        ev?.verifiedAt == null
          ? null
          : typeof ev.verifiedAt === "string"
            ? ev.verifiedAt
            : ev.verifiedAt.toISOString(),
    };

    const riskFields = enrichComplianceRowRiskFields({
      row: baseRow,
      requirement: {
        id: req.id,
        category: req.category,
        description: req.description,
        mandatory: req.mandatory,
        status: req.status,
        evidence: req.evidence ?? null,
        fitStatus: req.fitStatus,
        evidenceConflict: req.evidenceConflict,
        semanticKind: req.semanticKind,
        sourceDocument: req.sourceDocument,
        fitProvenanceExcerpt: req.fitProvenanceExcerpt,
      },
      requirementIndex: index,
      readinessStatus: status,
      verificationStatus: verification.status,
      findings: input.findings,
      humanRejected,
      evidenceExcerpt: excerpt,
      notes,
    });

    return {
      ...baseRow,
      ...riskFields,
    };
  });
}

export function buildComplianceSummary(
  matrix: ComplianceRow[],
  clarificationCount: number,
  risks: StructuredRisk[] = [],
): ComplianceSummary {
  const count = (status: ComplianceRow["status"]) =>
    matrix.filter((r) => r.status === status).length;

  return {
    totalRequirements: matrix.length,
    ready: count("READY"),
    missing: count("MISSING"),
    verify: count("VERIFY"),
    notApplicable: count("NOT_APPLICABLE"),
    unknown: count("UNKNOWN"),
    sources: matrix.filter((r) => r.sourceLocated).length,
    risks: risks.length > 0 ? countIdentifiedRisks(risks) : 0,
    requiredActions: matrix.filter((r) => r.requiredAction != null).length,
    clarifications: clarificationCount,
    verifiedRequirements: count("READY"),
    needsVerification: count("VERIFY") + count("UNKNOWN"),
    confirmedGaps: count("MISSING"),
  };
}

/**
 * Contradictions must come from structured package metadata / STI, never from
 * re-scanning raw tender text with isolated vocabulary (must/shall/deadline).
 */
function quantitativeTokens(text: string): Array<{ kind: string; value: string }> {
  const t = text.toLowerCase();
  const out: Array<{ kind: string; value: string }> = [];
  for (const m of t.matchAll(
    /\b(\d+)\s*(?:calendar\s+|working\s+)?(days?|weeks?|months?|years?)\b/g,
  )) {
    out.push({ kind: `dur:${m[2]![0]}`, value: m[1]! });
  }
  for (const m of t.matchAll(/\b(\d+)\s*%/g)) {
    out.push({ kind: "pct", value: m[1]! });
  }
  for (const m of t.matchAll(
    /\b(?:usd|eur|gbp|mad)\s*([\d,.]+)|([\d,.]+)\s*(?:usd|eur|gbp|mad)\b/g,
  )) {
    out.push({ kind: "amt", value: (m[1] || m[2] || "").replace(/,/g, "") });
  }
  return out;
}

function sharedSignificantTokenCount(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 3),
    );
  const left = toks(a);
  let n = 0;
  for (const t of toks(b)) {
    if (left.has(t)) n += 1;
  }
  return n;
}

/**
 * Conservative contradictions from sealed quantitative fields only.
 * Isolated words never create a conflict. Unresolved pairs keep both paths.
 */
function detectContradictions(input: IntelligenceInput): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];
  const reqs = input.requirements.filter((r) => (r.description ?? "").length > 24);
  const limit = Math.min(reqs.length, 80);
  for (let i = 0; i < limit; i++) {
    const a = reqs[i]!;
    const aTokens = quantitativeTokens(a.description);
    if (aTokens.length === 0) continue;
    for (let j = i + 1; j < limit; j++) {
      const b = reqs[j]!;
      const sameDoc =
        Boolean(a.sourceDocument) && a.sourceDocument === b.sourceDocument;
      const sameVersion =
        (a.versionLabel ?? "") === (b.versionLabel ?? "");
      if (sameDoc && sameVersion && !a.evidenceConflict && !b.evidenceConflict) {
        continue;
      }
      if (sharedSignificantTokenCount(a.description, b.description) < 6) continue;
      if (
        a.semanticKind &&
        b.semanticKind &&
        a.semanticKind !== "UNKNOWN" &&
        b.semanticKind !== "UNKNOWN" &&
        a.semanticKind !== b.semanticKind
      ) {
        continue;
      }
      const bTokens = quantitativeTokens(b.description);
      const conflict = aTokens.some((at) =>
        bTokens.some((bt) => at.kind === bt.kind && at.value !== bt.value),
      );
      if (!conflict) continue;
      findings.push({
        id: `con-${a.id}-${b.id}`,
        title: "Conflicting quantitative condition",
        description:
          "Two authoritative sources state different proven values for the same obligation object. Both evidence paths are preserved for review.",
        items: [a.id, b.id],
        recommendedAction:
          "Review both sources. Do not silently prefer one version.",
      });
      if (findings.length >= 12) return findings;
    }
  }
  return findings;
}

function buildClarifications(
  matrix: ComplianceRow[],
  contradictions: ContradictionFinding[],
): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  let q = 0;

  for (const c of contradictions) {
    questions.push({
      id: `q-${++q}`,
      question: `Please confirm the authoritative ${c.title.toLowerCase().replace("potential ", "")}.`,
      reason: c.description,
      source: c.items.join(" · ") || "Tender document",
      category: "Contradiction",
      priority: "HIGH",
    });
  }

  for (const row of matrix) {
    if (row.status !== "VERIFY" && row.status !== "UNKNOWN") continue;
    if (
      row.requirementType === "Certification" &&
      /time|award|submit|before/i.test(row.requirement)
    ) {
      questions.push({
        id: `q-${++q}`,
        question: `Please confirm whether ${row.requirement.slice(0, 100)} is required at bid submission or only before contract award.`,
        reason:
          "Timing of certification requirements is unclear in the tender text.",
        source: formatSourceLabel(row),
        category: "Eligibility",
        priority: row.mandatory ? "HIGH" : "MEDIUM",
      });
      continue;
    }
    if (row.mandatory && row.status === "VERIFY" && row.priority === "HIGH") {
      questions.push({
        id: `q-${++q}`,
        question: `Please confirm the exact requirement for: ${row.requirement.slice(0, 120)}`,
        reason:
          row.notes ??
          "Mandatory requirement could not be fully verified from available information.",
        source: formatSourceLabel(row),
        category: row.requirementType,
        priority: "HIGH",
      });
    }
  }

  return questions.slice(0, 12);
}

function formatSourceLabel(row: ComplianceRow): string {
  if (!row.sourceLocated) return "Source could not be precisely located.";
  const parts = [
    row.sourceDocument,
    row.section ? `Section ${row.section}` : null,
    row.pageNumber != null ? `Page ${row.pageNumber}` : null,
  ].filter(Boolean);
  return parts.join(" — ") || "Tender document";
}

function buildDecisionContext(input: {
  decision: string;
  fitScore: number;
  readinessScore: number | null;
  hardBlockers: string[];
  reviewItems: string[];
  decisionDrivers: string[];
}): string {
  const lines: string[] = [];
  lines.push(
    `Bidvera recommends ${
      input.decision === "BID"
        ? "GO"
        : input.decision === "REVIEW"
          ? "CONDITIONAL GO"
          : input.decision === "NO_BID"
            ? "NO-BID"
            : input.decision.replace("_", "-")
    } — based on the information provided.`,
  );
  lines.push(`Company–Tender Fit: ${input.fitScore}%`);
  if (input.readinessScore != null) {
    lines.push(`Tender Readiness: ${input.readinessScore}%`);
  }
  if (input.hardBlockers.length) {
    lines.push("Hard blockers:");
    for (const b of input.hardBlockers) lines.push(`• ${b}`);
  }
  if (input.reviewItems.length) {
    lines.push("Items requiring verification:");
    for (const b of input.reviewItems) lines.push(`• ${b}`);
  }
  if (input.decisionDrivers.length) {
    lines.push("Decision drivers:");
    for (const b of input.decisionDrivers) lines.push(`• ${b}`);
  }
  if (input.hardBlockers.length || input.reviewItems.length) {
    lines.push(
      "Recommended next step: Resolve hard blockers and verify outstanding items before final bid decision.",
    );
  }
  return lines.join("\n");
}

/**
 * Enrich legacy stored rows that predate risk / requiredAction fields.
 * Does not invent evidence or source locations.
 */
export function normalizeComplianceMatrix(rows: ComplianceRow[]): ComplianceRow[] {
  return rows.map((row) => {
    const evidence = realEvidence(row.evidence);
    const sourceLocated =
      !!evidence && (row.pageNumber != null || !!row.section?.trim());

    const tenderSource =
      row.tenderSource ??
      buildRequirementTenderSource({
        documentName: row.sourceDocument,
        page: row.pageNumber,
        section: row.section,
        originalExcerpt: evidence,
        normalizedRequirement: row.requirement,
        requirementType: row.requirementType,
      });

    const companyEvidence = row.companyEvidence ?? null;

    const evidenceState =
      row.evidenceState ??
      classifyComplianceEvidenceState({
        readinessStatus: row.status,
        matchStatus: "UNCERTAIN",
        verificationStatus: row.verificationStatus ?? "NEEDS_VERIFICATION",
        mandatory: row.mandatory,
        evidence: row.evidence,
        findings: [],
        requirementIndex: 0,
        humanRejected: false,
        evidenceExcerpt: evidence,
      });
    const notes = complianceNoteForState(evidenceState, row.mandatory);

    return {
      ...row,
      evidence,
      sourceLocated: row.tenderSource?.located ?? sourceLocated,
      tenderSource,
      companyEvidence,
      companyEvidenceMessage:
        row.companyEvidenceMessage ??
        (companyEvidence?.excerpt ? null : NO_COMPANY_EVIDENCE_MESSAGE),
      evidenceState,
      risk: row.risk ?? notes.risk,
      requiredAction:
        row.requiredAction ??
        notes.requiredAction ??
        legacyRequiredActionForRow(row.status, row.mandatory, row.notes),
    };
  });
}

function factKeyFromRequirement(input: {
  description: string;
  category: string;
}): TenderFactKey | null {
  const d = input.description.toLowerCase();
  if (/bid\s+(bond|security)|cautionnement|caution\s+provisoire/i.test(d)) {
    return "bid_security";
  }
  if (/evaluation|award criteria|critères?\s+d['’]attribution|scoring/i.test(d)) {
    return "evaluation_criteria";
  }
  if (/payment|invoice|retention|paiement/i.test(d)) return "payment_terms";
  if (/penalt|liquidated damages|pénalit/i.test(d)) return "penalties";
  if (/warranty|sla|service level|garantie/i.test(d)) return "warranty_sla";
  if (/contract duration|term of contract|durée\s+du\s+marché/i.test(d)) {
    return "contract_duration";
  }
  if (/estimated value|contract value|budget|valeur\s+du\s+marché/i.test(d)) {
    return "estimated_value";
  }
  if (/submission method|submit via|portal|dépôt\s+des\s+offres/i.test(d)) {
    return "submission_method";
  }
  if (/performance bond|guarantee|garantie\s+de\s+bonne\s+exécution/i.test(d)) {
    return "guarantee";
  }
  if (/technical spec|spécification technique|specification/i.test(d)) {
    return "technical_specifications";
  }
  return null;
}

function coerceDeadline(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function buildTenderFactsProvenance(input: IntelligenceInput) {
  const deadline = coerceDeadline(input.tenderDeadline);
  const facts = [
    buildTenderFactProvenance({
      key: "deadline",
      value: deadline ? deadline.toISOString().slice(0, 10) : null,
      documentName: input.deadlineSourceDocument ?? null,
      excerpt: input.deadlineEvidence ?? null,
      note: deadline
        ? null
        : "No reliable deadline date was found in the tender package text.",
    }),
  ];
  const seen = new Set<TenderFactKey>(["deadline"]);
  for (const req of input.requirements) {
    const key = factKeyFromRequirement(req);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    facts.push(
      buildTenderFactProvenance({
        key,
        value: req.value ?? req.description.slice(0, 200),
        documentName: req.sourceDocument ?? null,
        page: typeof req.sourcePage === "number" ? req.sourcePage : null,
        excerpt: realEvidence(req.evidenceText) ?? realEvidence(req.description),
      }),
    );
  }
  return facts;
}

/** Deterministic tender intelligence — reuses extraction, readiness, and risks. No extra AI calls. */
export function buildTenderIntelligence(
  input: IntelligenceInput,
): TenderIntelligenceBreakdown {
  void input.extractedText;
  const complianceMatrix = buildComplianceMatrix(input);
  const contradictions = detectContradictions(input);
  const risks = buildCanonicalStructuredRisks({
    matrix: complianceMatrix,
    requirements: input.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      status: r.status,
      evidence: r.evidence ?? null,
      fitStatus: r.fitStatus,
      evidenceConflict: r.evidenceConflict,
      semanticKind: r.semanticKind,
      sourceDocument: r.sourceDocument,
      page: r.sourcePage,
      section: r.sourceSection,
      fitProvenanceExcerpt: r.fitProvenanceExcerpt,
    })),
    findings: input.findings,
    existingRisks: input.existingRisks,
    documentName: input.documentName,
  });
  const clarificationQuestions = buildClarifications(
    complianceMatrix,
    contradictions,
  );
  const complianceSummary = buildComplianceSummary(
    complianceMatrix,
    clarificationQuestions.length,
    risks,
  );
  const engineHardBlockers = collectMaterialHardBlockers({
    requirements: input.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence ?? null,
      fitStatus: r.fitStatus ?? undefined,
      semanticKind: r.semanticKind ?? null,
    })),
    findings: input.findings,
  });
  const severity = buildDecisionSeverityView({
    hardBlockers: engineHardBlockers,
    complianceMatrix,
    findings: input.findings,
    contradictions,
    risks,
  });
  assertDecisionSeverityConsistency(severity);
  const decisionContext = buildDecisionContext({
    decision: input.decision,
    fitScore: input.fitScore,
    readinessScore: input.readiness.score,
    hardBlockers: severity.hardBlockers,
    reviewItems: severity.reviewItems,
    decisionDrivers: severity.decisionDrivers,
  });

  const verificationIntelligence = buildVerificationIntelligence({
    defaultDocumentName: input.documentName,
    requirements: input.requirements.map((r) => {
      const ready = input.readiness.items.find((i) => i.id === r.id);
      return {
        id: r.id,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        readinessStatus: ready?.status ?? "UNKNOWN",
      };
    }),
    evidence: toCanonicalEvidence(input.evidence),
  });

  const evidenceIntelligence = buildEvidenceIntelligence({
    verificationIntelligence,
    complianceMatrix,
    evidence: toCanonicalEvidence(input.evidence),
    requirements: input.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status,
    })),
  });

  return {
    complianceStatus: "COMPLETE",
    analysisMode: "TENDER",
    complianceMatrix,
    complianceSummary,
    risks,
    contradictions,
    clarificationQuestions,
    keyBlockers: severity.hardBlockers,
    reviewItems: severity.reviewItems,
    decisionDrivers: severity.decisionDrivers,
    actionItems: severity.actionItems,
    decisionContext,
    learningSignal: null,
    verificationIntelligence,
    evidenceIntelligence,
    tenderFactsProvenance: buildTenderFactsProvenance(input),
  };
}
