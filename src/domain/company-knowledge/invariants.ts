import type { AnalysisTrace, AnalysisTraceStep, CompanyKnowledge, DocumentKind } from "./types";
import { COMPANY_ONLY_MESSAGE } from "./types";

/**
 * Anti-hallucination invariants (RULE A–L condensed into enforceable checks).
 */
export function assertKnowledgeInvariants(input: {
  documentKind: DocumentKind;
  knowledge: CompanyKnowledge | null;
  requirementsCount: number;
  inventedPageNumbers?: boolean;
}): { ok: boolean; violations: string[]; checked: string[] } {
  const violations: string[] = [];
  const checked: string[] = [
    "RULE_A_no_source_no_claim",
    "RULE_B_no_tender_no_invented_requirements",
    "RULE_E_no_fabricated_pages",
    "RULE_F_no_fabricated_certs",
    "RULE_K_limitations_relevance_only",
  ];

  if (
    (input.documentKind === "COMPANY_PROFILE" || input.documentKind === "SUPPORTING_EVIDENCE") &&
    input.requirementsCount > 0
  ) {
    // Company-only analyses must not invent tender requirements
    violations.push("RULE_B: Company evidence document produced tender requirements.");
  }

  if (input.knowledge) {
    for (const s of input.knowledge.services) {
      if (!s.provenance.sourceDocument) {
        violations.push("RULE_A: Service fact without source document.");
      }
    }
    for (const c of input.knowledge.certifications) {
      if (!c.provenance.sourceDocument) {
        violations.push("RULE_F: Certification without source.");
      }
    }
  }

  if (input.inventedPageNumbers) {
    violations.push("RULE_E: Fabricated page numbers detected.");
  }

  return { ok: violations.length === 0, violations, checked };
}

export function buildCompanyOnlyTrace(knowledge: CompanyKnowledge): AnalysisTrace {
  const steps: AnalysisTraceStep[] = [
    {
      field: "documentKind",
      finalValue: knowledge.documentKind,
      rule: "classifyDocument",
      structuredInput: knowledge.classificationSignals,
      sourceDocument: knowledge.sourceDocuments[0] ?? null,
      page: "UNKNOWN",
      section: null,
      originalExcerpt: null,
    },
    {
      field: "services",
      finalValue: knowledge.services.map((s) => s.normalizedValue),
      rule: "extractCompanyKnowledgeHeuristic.services",
      structuredInput: knowledge.services.map((s) => s.originalValue),
      sourceDocument: knowledge.sourceDocuments[0] ?? null,
      page: knowledge.services[0]?.provenance.page ?? "UNKNOWN",
      section: "Main Services",
      originalExcerpt: knowledge.services[0]?.provenance.excerpt ?? null,
    },
    {
      field: "historicalOutcomes",
      finalValue: knowledge.historicalOutcomes.map((h) => `${h.opportunity}:${h.outcome}`),
      rule: "extractCompanyKnowledgeHeuristic.historical",
      structuredInput: knowledge.historicalOutcomes.length,
      sourceDocument: knowledge.sourceDocuments[0] ?? null,
      page: knowledge.historicalOutcomes[0]?.provenance.page ?? "UNKNOWN",
      section: "Historical Tender Outcomes",
      originalExcerpt: null,
    },
    {
      field: "analysisMessage",
      finalValue: COMPANY_ONLY_MESSAGE,
      rule: "COMPANY_PROFILE_WITHOUT_TENDER",
      structuredInput: { requirementsCount: 0 },
      sourceDocument: knowledge.sourceDocuments[0] ?? null,
      page: "UNKNOWN",
      section: null,
      originalExcerpt: null,
    },
  ];

  return {
    documentKind: knowledge.documentKind,
    steps,
    invariantsChecked: assertKnowledgeInvariants({
      documentKind: knowledge.documentKind,
      knowledge,
      requirementsCount: 0,
    }).checked,
    generatedAt: new Date().toISOString(),
  };
}

export function knowledgeToProfileFields(knowledge: CompanyKnowledge): {
  industry: string | null;
  country: string | null;
  companySize: string | null;
  services: string[];
  certifications: string[];
  experienceYears: number | null;
  employeeRange: string | null;
  geographicCoverage: string[];
  contractSizeMin: number | null;
  contractSizeMax: number | null;
  customQualificationRules: string[];
} {
  const held = knowledge.certifications
    .filter((c) => c.status === "AVAILABLE")
    .map((c) => c.name);
  const notHeld = knowledge.certifications
    .filter((c) => c.status === "NOT_HELD")
    .map((c) => `NOT_HELD:${c.name}`);

  const limitationsAsRules = knowledge.limitations.map((l) => `LIMITATION: ${l.value}`);

  const min = knowledge.contractCapacity.preferredMin
    ? Number(String(knowledge.contractCapacity.preferredMin).replace(/[^\d]/g, ""))
    : null;
  const max = knowledge.contractCapacity.preferredMaxNumeric;

  return {
    industry: knowledge.identity.industry,
    country: knowledge.identity.country,
    companySize: knowledge.identity.companySize,
    services: knowledge.services.map((s) => s.normalizedValue),
    certifications: [...held, ...notHeld],
    experienceYears: knowledge.identity.experienceYears,
    employeeRange:
      knowledge.identity.employees != null ? String(knowledge.identity.employees) : null,
    geographicCoverage: knowledge.geographicCoverage.map((g) => g.value).slice(0, 20),
    contractSizeMin: Number.isFinite(min) ? min : null,
    contractSizeMax: max,
    customQualificationRules: [...limitationsAsRules, ...knowledge.strengths.map((s) => `STRENGTH: ${s.value}`)].slice(
      0,
      30,
    ),
  };
}
