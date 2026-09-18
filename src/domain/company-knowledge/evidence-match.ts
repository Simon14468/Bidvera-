/**
 * Semantic evidence matching — routes requirements to specialized matchers
 * and enforces provenance / conflict rules before fit status derivation.
 */

import { classifyRequirementSemanticKind } from "@/domain/tender-requirements/semantic-kind";
import { hasValidCompanyProvenance } from "@/domain/decision/requirement-fit-status";
import { matchRequirementToKnowledge } from "./match";
import type { CompanyKnowledge, RequirementMatchResult } from "./types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRequiredExperienceYears(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:\+?\s*)?(?:years?|ann[eé]es?)/i);
  return m ? Number(m[1]) : null;
}

function detectCertConflict(knowledge: CompanyKnowledge, certNeedle: string): boolean {
  const key = normalize(certNeedle).replace(/\s+/g, "");
  let available = false;
  let notHeld = false;
  for (const c of knowledge.certifications) {
    const nameKey = normalize(c.name).replace(/\s+/g, "");
    if (!nameKey.includes(key) && !key.includes(nameKey)) continue;
    if (c.status === "AVAILABLE") available = true;
    if (c.status === "NOT_HELD") notHeld = true;
  }
  return available && notHeld;
}

function matchExperienceRequirement(
  knowledge: CompanyKnowledge,
  requirement: string,
): RequirementMatchResult | null {
  const years = extractRequiredExperienceYears(requirement);
  if (years == null || !/\b(experience|exp[eé]rience|r[eé]f[eé]rence|projects?)\b/i.test(requirement)) {
    return null;
  }

  const sectorCue =
    /\b(public[- ]sector|government|audiovisual|healthcare|it|cloud|construction)\b/i.exec(
      requirement,
    )?.[1] ?? null;
  const geoCue = /\b(morocco|maroc|uk|europe|africa)\b/i.exec(requirement)?.[1] ?? null;

  const qualifyingProjects = knowledge.projects.filter((p) => {
    const blob = normalize(`${p.name} ${p.clientSector ?? ""} ${p.description ?? ""}`);
    if (sectorCue && !blob.includes(normalize(sectorCue))) return false;
    if (geoCue && !blob.includes(normalize(geoCue))) return false;
    return true;
  });

  const companyYears = knowledge.identity.experienceYears;
  const projectCount = qualifyingProjects.length;

  if (companyYears != null && companyYears >= years && projectCount >= 1) {
    const p = qualifyingProjects[0]!;
    return {
      requirement,
      status: "MATCHED",
      evidence: `${companyYears} years company experience; project: ${p.name}`,
      sourceDocument: p.provenance.sourceDocument,
      page: p.provenance.page,
      section: p.provenance.section,
      rationale: `Experience dimensions satisfied: ${years}+ years and relevant project reference.`,
    };
  }

  if (companyYears != null && companyYears >= years && projectCount === 0 && sectorCue) {
    return {
      requirement,
      status: "UNCERTAIN",
      evidence: `${companyYears} years stated — sector-specific projects not confirmed.`,
      sourceDocument: knowledge.sourceDocuments[0] ?? null,
      page: "UNKNOWN",
      section: "Company Overview",
      rationale: "Partial experience match — sector/project dimension requires verification.",
    };
  }

  if (companyYears != null && companyYears < years) {
    return {
      requirement,
      status: "FAILED",
      evidence: `Company states ${companyYears} years; tender requires ${years}+.`,
      sourceDocument: knowledge.sourceDocuments[0] ?? null,
      page: "UNKNOWN",
      section: "Company Overview",
      rationale: "Definitive experience shortfall based on company-stated years.",
    };
  }

  return {
    requirement,
    status: "UNCERTAIN",
    evidence: null,
    sourceDocument: null,
    page: null,
    section: null,
    rationale: `Experience requirement (${years}+ years) cannot be confirmed from company evidence.`,
  };
}

function matchRequiredDocument(
  knowledge: CompanyKnowledge,
  requirement: string,
): RequirementMatchResult | null {
  if (
    !/\b(submit|soumettre|fournir|provide|attach|certificat|attestation|registration|clearance|dossier)\b/i.test(
      requirement,
    )
  ) {
    return null;
  }

  const docCue =
    requirement.match(
      /\b(cnss|tax\s+clearance|registre\s+de\s+commerce|certificate\s+of\s+incorporation|company\s+registration|iso\s?\d+|acte\s+d['']engagement)\b/i,
    )?.[0] ?? null;

  if (docCue) {
    const key = normalize(docCue);
    for (const c of [...knowledge.certifications, ...knowledge.policies]) {
      const nameKey = normalize(c.name);
      if (nameKey.includes(key) || key.includes(nameKey)) {
        if (c.status === "NOT_HELD") {
          return {
            requirement,
            status: "FAILED",
            evidence: c.detail ?? c.provenance.originalValue,
            sourceDocument: c.provenance.sourceDocument,
            page: c.provenance.page,
            section: c.provenance.section,
            rationale: `Company evidence states required document/certification is not held.`,
          };
        }
        if (c.status === "AVAILABLE") {
          return {
            requirement,
            status: "MATCHED",
            evidence: c.detail ?? c.provenance.originalValue,
            sourceDocument: c.provenance.sourceDocument,
            page: c.provenance.page,
            section: c.provenance.section,
            rationale: "Required submission document appears available in company evidence.",
          };
        }
        return {
          requirement,
          status: "UNCERTAIN",
          evidence: c.detail,
          sourceDocument: c.provenance.sourceDocument,
          page: c.provenance.page,
          section: c.provenance.section,
          rationale: `${c.name} requires validity/scope verification.`,
        };
      }
    }
  }

  return {
    requirement,
    status: "UNCERTAIN",
    evidence: null,
    sourceDocument: null,
    page: null,
    section: null,
    rationale: "Required document submission — existence in company records not confirmed.",
  };
}

function enforceProvenance(result: RequirementMatchResult): RequirementMatchResult {
  if (result.status !== "MATCHED") return result;
  if (hasValidCompanyProvenance(result)) return result;
  return {
    ...result,
    status: "UNCERTAIN",
    rationale: `${result.rationale} Provenance incomplete — requires verification.`,
  };
}

/**
 * Match one requirement with semantic routing and provenance enforcement.
 */
export function matchRequirementWithEvidence(input: {
  requirementId?: string;
  requirement: string;
  category: string;
  mandatory: boolean;
  value?: string | null;
  semanticKind?: string | null;
  knowledge: CompanyKnowledge;
}): RequirementMatchResult & { evidenceConflict?: boolean } {
  const semanticKind =
    input.semanticKind ??
    classifyRequirementSemanticKind({
      description: input.requirement,
      existingCategory: input.category,
      mandatoryHint: input.mandatory,
    });

  const certNeedle =
    input.requirement.match(/\b(ISO\s?\d+|PCI\s?DSS|Cyber Essentials(?:\sPlus)?)\b/i)?.[0] ??
    null;
  const evidenceConflict = certNeedle
    ? detectCertConflict(input.knowledge, certNeedle)
    : false;

  if (evidenceConflict) {
    return {
      requirementId: input.requirementId,
      requirement: input.requirement,
      status: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      page: null,
      section: null,
      rationale: "Conflicting certification evidence in company knowledge.",
      evidenceConflict: true,
    };
  }

  let result: RequirementMatchResult | null = null;

  if (semanticKind === "ELIGIBILITY_REQUIREMENT" || semanticKind === "FINANCIAL_COMMERCIAL_CONDITION") {
    result = matchExperienceRequirement(input.knowledge, input.requirement);
  }

  if (!result && semanticKind === "REQUIRED_DOCUMENT") {
    result = matchRequiredDocument(input.knowledge, input.requirement);
  }

  if (!result) {
    result = matchRequirementToKnowledge({
      requirementId: input.requirementId,
      requirement: input.requirement,
      category: input.category,
      mandatory: input.mandatory,
      value: input.value,
      knowledge: input.knowledge,
    });
  }

  return { ...enforceProvenance(result), evidenceConflict: false };
}

export function matchAllRequirementsWithEvidence(input: {
  requirements: {
    id?: string;
    category: string;
    description: string;
    mandatory: boolean;
    value?: string | null;
    semanticKind?: string | null;
  }[];
  knowledge: CompanyKnowledge;
}): Array<RequirementMatchResult & { evidenceConflict?: boolean }> {
  return input.requirements.map((r) =>
    matchRequirementWithEvidence({
      requirementId: r.id,
      requirement: r.description,
      category: r.category,
      mandatory: r.mandatory,
      value: r.value,
      semanticKind: r.semanticKind ?? null,
      knowledge: input.knowledge,
    }),
  );
}
