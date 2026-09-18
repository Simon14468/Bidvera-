/**
 * Deterministic action titles from the canonical obligation, not category keywords.
 * A named class is used only when the requirement text explicitly states that duty.
 */

import { isGenericVerificationText } from "./canonical-dedupe";
import type { TenderActionSourceType } from "./types";

export type RequirementActionKind =
  | "CERTIFICATION"
  | "COMPANY_REGISTRATION"
  | "TECHNICAL_CAPACITY"
  | "CUSTOMER_REFERENCES"
  | "FINANCIAL_ELIGIBILITY"
  | "REQUIRED_FORM"
  | "BID_SECURITY"
  | "INSURANCE"
  | "METHODOLOGY"
  | "PROCEDURAL"
  | "GENERIC_OBJECT";

const NAMED_TITLE: Record<Exclude<RequirementActionKind, "GENERIC_OBJECT">, string> = {
  CERTIFICATION: "the required certification",
  COMPANY_REGISTRATION: "company registration",
  TECHNICAL_CAPACITY: "technical capacity",
  CUSTOMER_REFERENCES: "relevant references",
  FINANCIAL_ELIGIBILITY: "financial eligibility",
  REQUIRED_FORM: "the required form",
  BID_SECURITY: "the required bid security",
  INSURANCE: "the required insurance",
  METHODOLOGY: "the required methodology",
  PROCEDURAL: "the submission/procedural requirement",
};

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Display-facing obligation text: strip chrome, keep original wording. */
export function normalizeObligationForActionTitle(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(?:[-–—•*]+\s*)?(?:Important|Note|N\.?B\.?|Attention|Remark|Warning)\s*[:\-–—]\s*/i,
      "",
    )
    .replace(/^(?:[-–—•*]+\s*)+/, "")
    .replace(/^\d{1,3}(?:\.\d{1,3})+\s*/, "")
    .replace(/^\d{1,3}[\.)]\s+/, "")
    .replace(/^\([a-z0-9]{1,3}\)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sliceRequirement(text: string, max = 90): string {
  const t = normalizeObligationForActionTitle(text);
  return t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`;
}

/** Clauses that must never be rewritten as company registration / certification. */
function isNonRegistrationEligibility(t: string): boolean {
  return (
    /\bconflict(?:s)?\s+of\s+interest\b/.test(t) ||
    /\bassociated(?:\s*,|\s+or)\s+has\s+been\s+associated\b/.test(t) ||
    /\bnationalit(?:y|ies)\b/.test(t) ||
    /\bnational\s+of\b/.test(t) ||
    /\bcitizen(?:ship)?\s+of\b/.test(t) ||
    /\bpersonal\s+data\b/.test(t) ||
    /\bexport\s+to\b/.test(t)
  );
}

function hasExplicitBidSecurity(t: string): boolean {
  return /\b(?:bid\s+(?:bond|security)|caution(?:nement)?(?:\s+provisoire)?|provisional\s+(?:bond|guarantee)|performance\s+(?:bond|guarantee)|bank\s+guarantee)\b/.test(
    t,
  );
}

function hasExplicitCompanyRegistration(t: string): boolean {
  if (isNonRegistrationEligibility(t)) return false;
  return /\b(?:company\s+registration|certificate\s+of\s+incorporation|tax\s+clearance|attestation\s+fiscale|registre\s+du\s+commerce|cnss(?:\s+(?:certificate|attestation|clearance))?|business\s+licen[cs]e|trade\s+licen[cs]e|registration\s+certificate)\b/.test(
    t,
  );
}

function hasExplicitCertification(t: string): boolean {
  if (isNonRegistrationEligibility(t)) return false;
  if (hasExplicitCompanyRegistration(t)) return false;
  return (
    /\biso\s*\d{3,5}\b/.test(t) ||
    /\b(?:required\s+)?certification(?:s)?\b/.test(t) ||
    /\baccredit(?:ed|ation)\b/.test(t) ||
    /\battestation\s+de\s+conformite\b/.test(t)
  );
}

function hasExplicitReferences(t: string): boolean {
  return (
    /\b(?:customer\s+references?|client\s+references?|relevant\s+references?|past\s+performance|references?\s+from)\b/.test(
      t,
    ) ||
    /\b(?:similar\s+(?:contracts?|projects?|assignments?))\b/.test(t) ||
    /\b(?:minimum|at\s+least|min\.?)\s+\d+\s+(?:years?|ans)\b/.test(t) ||
    /\b\d+\s+(?:years?|ans)\s+(?:of\s+)?(?:experience|experience\s+in)\b/.test(t)
  );
}

function hasExplicitFinancial(t: string): boolean {
  return /\b(?:annual\s+turnover|minimum\s+turnover|chiffre\s+d['’]affaires|audited\s+(?:accounts?|statements?)|financial\s+(?:statements?|capacity|eligibility|threshold)|balance\s+sheet)\b/.test(
    t,
  );
}

function hasExplicitRequiredForm(t: string): boolean {
  return (
    /\b(?:returnable\s+(?:form|document)|complete\s+this\s+form|fill\s+in\s+this\s+form|formulaire|bidding\s+form|form\s+of\s+(?:tender|offer|bid)|qualification\s+form|comparative\s+data\s+tables?)\b/.test(
      t,
    ) || /\b(?:complete|fill\s+in|fill\s+out)\b.{0,40}\bform\b/.test(t)
  );
}

function hasExplicitInsurance(t: string): boolean {
  return /\b(?:insurance\s+polic(?:y|ies)|liability\s+insurance|professional\s+indemnity\s+insurance|required\s+insurance|\binsurance\b)\b/.test(
    t,
  );
}

function hasExplicitMethodology(t: string): boolean {
  return /\b(?:methodology|methodologie|work\s+plan|approach\s+paper|technical\s+approach)\b/.test(
    t,
  );
}

function hasExplicitTechnicalCapacity(t: string): boolean {
  return /\b(?:technical\s+(?:capacity|capability|brochure|data(?:\s+sheet)?|datasheet)|datasheet|brochure)\b/.test(
    t,
  );
}

function hasExplicitProcedural(t: string): boolean {
  return /\b(?:submission\s+deadline|closing\s+date|two[- ]envelope|sealed\s+envelope|procedural\s+requirement|deadline\s+for\s+(?:the\s+)?(?:proposal|bid|offer|tender)?\s*submission)\b/.test(
    t,
  );
}

export function classifyRequirementActionObject(
  requirementText: string,
  _requirementType?: string | null,
): { kind: RequirementActionKind; objectLabel: string } {
  void _requirementType;
  const t = fold(requirementText);

  if (hasExplicitBidSecurity(t)) {
    return { kind: "BID_SECURITY", objectLabel: NAMED_TITLE.BID_SECURITY };
  }
  if (hasExplicitCompanyRegistration(t)) {
    return { kind: "COMPANY_REGISTRATION", objectLabel: NAMED_TITLE.COMPANY_REGISTRATION };
  }
  if (hasExplicitCertification(t)) {
    return { kind: "CERTIFICATION", objectLabel: NAMED_TITLE.CERTIFICATION };
  }
  if (hasExplicitRequiredForm(t)) {
    return { kind: "REQUIRED_FORM", objectLabel: NAMED_TITLE.REQUIRED_FORM };
  }
  if (hasExplicitInsurance(t)) {
    return { kind: "INSURANCE", objectLabel: NAMED_TITLE.INSURANCE };
  }
  if (hasExplicitFinancial(t)) {
    return { kind: "FINANCIAL_ELIGIBILITY", objectLabel: NAMED_TITLE.FINANCIAL_ELIGIBILITY };
  }
  if (hasExplicitReferences(t)) {
    return { kind: "CUSTOMER_REFERENCES", objectLabel: NAMED_TITLE.CUSTOMER_REFERENCES };
  }
  if (hasExplicitMethodology(t)) {
    return { kind: "METHODOLOGY", objectLabel: NAMED_TITLE.METHODOLOGY };
  }
  if (hasExplicitTechnicalCapacity(t)) {
    return { kind: "TECHNICAL_CAPACITY", objectLabel: NAMED_TITLE.TECHNICAL_CAPACITY };
  }
  if (hasExplicitProcedural(t)) {
    return { kind: "PROCEDURAL", objectLabel: NAMED_TITLE.PROCEDURAL };
  }

  return { kind: "GENERIC_OBJECT", objectLabel: sliceRequirement(requirementText) };
}

function verbFor(sourceType: TenderActionSourceType, kind: RequirementActionKind): string {
  if (sourceType === "EXPIRED_EVIDENCE") return "Renew";
  if (sourceType === "FAILED_VERIFICATION") return "Resolve";
  if (kind === "REQUIRED_FORM") {
    return sourceType === "MISSING_EVIDENCE" || sourceType === "MISSING_MANDATORY_REQUIREMENT"
      ? "Complete"
      : "Confirm";
  }
  if (kind === "CUSTOMER_REFERENCES") {
    return sourceType === "MISSING_EVIDENCE" || sourceType === "MISSING_MANDATORY_REQUIREMENT"
      ? "Provide"
      : "Confirm";
  }
  if (kind === "PROCEDURAL") return "Confirm";
  if (sourceType === "MISSING_EVIDENCE" || sourceType === "MISSING_MANDATORY_REQUIREMENT") {
    return kind === "GENERIC_OBJECT" ? "Verify" : "Provide";
  }
  if (kind === "CERTIFICATION" || kind === "TECHNICAL_CAPACITY") {
    return "Confirm";
  }
  return "Verify";
}

function expectedOutcomeFor(
  sourceType: TenderActionSourceType,
  objectLabel: string,
): string {
  if (sourceType === "MISSING_EVIDENCE" || sourceType === "MISSING_MANDATORY_REQUIREMENT") {
    return `Traceable evidence for ${objectLabel} is linked and ready for verification.`;
  }
  if (sourceType === "EXPIRED_EVIDENCE") {
    return `Current, unexpired evidence for ${objectLabel} is linked.`;
  }
  return `Verified company evidence for ${objectLabel} is accepted by the team or verifier.`;
}

const NAMED_TITLE_PATTERN: Array<{ kind: Exclude<RequirementActionKind, "GENERIC_OBJECT">; re: RegExp }> =
  [
    { kind: "COMPANY_REGISTRATION", re: /company registration/i },
    { kind: "CERTIFICATION", re: /required certification/i },
    { kind: "INSURANCE", re: /required insurance/i },
    { kind: "TECHNICAL_CAPACITY", re: /technical capacity/i },
    { kind: "FINANCIAL_ELIGIBILITY", re: /financial eligibility/i },
    { kind: "REQUIRED_FORM", re: /required form/i },
    { kind: "CUSTOMER_REFERENCES", re: /relevant references|customer references/i },
    { kind: "BID_SECURITY", re: /bid security/i },
    { kind: "METHODOLOGY", re: /required methodology/i },
    { kind: "PROCEDURAL", re: /submission\/procedural requirement/i },
  ];

/** True when the action title claims the same duty as the linked requirement. */
export function actionTitleMatchesRequirement(title: string, requirementText: string): boolean {
  if (isGenericVerificationText(title)) return false;
  const classified = classifyRequirementActionObject(requirementText);
  const claimed = NAMED_TITLE_PATTERN.find((p) => p.re.test(title));
  if (claimed) {
    return classified.kind === claimed.kind;
  }
  if (classified.kind === "GENERIC_OBJECT") {
    const obligation = normalizeObligationForActionTitle(requirementText).toLowerCase();
    const body = title.replace(/^(?:verify|provide|confirm|complete|renew|resolve)\s*:?\s*/i, "").toLowerCase();
    if (!body) return false;
    return obligation.includes(body.replace(/…$/, "").trim().slice(0, 40));
  }
  return true;
}

export function deriveRequirementActionTitle(input: {
  requirementText: string;
  requirementType?: string | null;
  requiredAction?: string | null;
  sourceType: TenderActionSourceType;
}): { title: string; expectedOutcome: string } {
  const object = classifyRequirementActionObject(
    input.requirementText,
    input.requirementType,
  );
  const required = input.requiredAction?.trim() ?? "";
  if (required && !isGenericVerificationText(required)) {
    const requiredKind = classifyRequirementActionObject(required).kind;
    const sameDuty =
      (requiredKind === object.kind && object.kind !== "GENERIC_OBJECT") ||
      actionTitleMatchesRequirement(required, input.requirementText);
    if (sameDuty) {
      return {
        title: sliceRequirement(required, 110),
        expectedOutcome: expectedOutcomeFor(input.sourceType, object.objectLabel),
      };
    }
  }

  const verb = verbFor(input.sourceType, object.kind);
  const title =
    object.kind === "GENERIC_OBJECT"
      ? `${verb}: ${object.objectLabel}`
      : `${verb} ${object.objectLabel}`;
  return {
    title,
    expectedOutcome: expectedOutcomeFor(input.sourceType, object.objectLabel),
  };
}
