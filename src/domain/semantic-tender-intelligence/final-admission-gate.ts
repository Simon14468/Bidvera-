/**
 * Final semantic admission gate — last authority check before canonicalization.
 *
 * A candidate enters canonical ONLY when ALL 16 predicates are true.
 * Uncertainty never becomes a requirement. shall/must alone never prove admission.
 *
 * Contaminations are checked as hard invariants (machine-readable codes).
 */

import { isPostAwardOnlyPhase } from "./phase";
import { isTemplateBlocked } from "./template";
import { versionBlocksCanonicalAdmission } from "./versioning";
import { recipientIsBidderSide } from "./recipient";
import { isBidderRelevantActor } from "./entry-gate";
import {
  CANONICAL_COMPATIBLE_CLAUSE_ROLES,
  type ApplicabilityKind,
  type CanonicalSemanticCandidate,
  type ClausePurpose,
  type InterpretedSemanticStatement,
  type ProcurementPhase,
  type SemanticActor,
  type SemanticClauseRole,
  type SemanticExclusionCode,
  type SemanticRecipient,
  type StructuredConditionality,
  type TemplateStatus,
  type VersionSemanticContext,
} from "./types";
import type { RequirementSemanticKind } from "@/domain/tender-requirements/semantic-kind";
import { analyzeObligationFrame } from "./obligation-frame";
import {
  extractLotApplicability,
  parseLotApplicabilityLabel,
} from "@/domain/tender-requirements/lot-applicability";

/** Named conjuncts — every key must be true for admission. */
export const FINAL_ADMISSION_CHECKS = [
  "completeBoundaryAndContext",
  "correctDocumentAndSectionRole",
  "correctActorAndRecipient",
  "correctProcurementPhase",
  "correctClausePurpose",
  "bidderRelevanceProven",
  "conditionalityPreserved",
  "templateFormProceduralSafe",
  "obligationStrengthPreserved",
  "semanticKindCompatible",
  "lotApplicabilityPreserved",
  "provenanceComplete",
  "notHeadingFactDefinitionExampleFragment",
  "notBuyerOrAuthorityOnly",
  "notPostAwardPromotedToPreBid",
  "notDuplicateSemanticRequirement",
] as const;

export type FinalAdmissionCheckId = (typeof FINAL_ADMISSION_CHECKS)[number];

export type FinalAdmissionCheckResult = Record<FinalAdmissionCheckId, boolean>;

export type ContaminationPattern =
  | "BUYER_TO_BIDDER"
  | "CONTRACTOR_TO_BIDDER"
  | "MANUFACTURER_TO_BIDDER"
  | "PROCEDURAL_TO_REQUIREMENT"
  | "TEMPLATE_TO_REQUIREMENT"
  | "POST_AWARD_TO_PREBID"
  | "HEADING_TO_REQUIREMENT"
  | "METADATA_TO_REQUIREMENT"
  | "QA_AMENDMENT_MISCLASSIFICATION"
  | "CONDITIONAL_ACTION_LOSS"
  | "CROSS_PAGE_FRAGMENT_LOSS"
  | "DUPLICATE_FRAGMENT_EXPLOSION"
  | "MISSING_PROVENANCE"
  | "IDENTIFIER_TO_REQUIREMENT"
  | "DISCLAIMER_TO_REQUIREMENT"
  | "INTRO_TO_REQUIREMENT"
  | "INCOMPLETE_OBLIGATION_FRAME"
  | "UNSUPPORTED_ACTOR_PROMOTION"
  | "UNSUPPORTED_PHASE_PROMOTION";

export type FinalAdmissionInput = {
  requirementText: string;
  documentRole: string;
  sectionRole: string;
  actor: SemanticActor;
  recipient: SemanticRecipient;
  procurementPhase: ProcurementPhase;
  clausePurpose: ClausePurpose;
  clauseRole: SemanticClauseRole;
  bidderRelevant: boolean;
  conditionality: StructuredConditionality;
  applicability: ApplicabilityKind;
  templateStatus: TemplateStatus;
  obligationStrength: string;
  semanticKind: RequirementSemanticKind;
  lotLabel: string | null;
  boundaryComplete: boolean;
  provenanceSourceDocument: string | null;
  isTableHeader?: boolean;
  orphanConditionUnresolved?: boolean;
  versionContext?: VersionSemanticContext | null;
  reconstructedFromContext?: boolean;
  /** When sealing a batch, true if another item already owns this semantic identity. */
  isDuplicateIdentity?: boolean;
  situationUncertainty?: boolean;
  unattributedDocumentaryEvidence?: boolean;
  unattributedEligibilityEvidence?: boolean;
  unattributedCommercialEvidence?: boolean;
  unattributedImpersonalObligation?: boolean;
  documentPurpose?: string;
};

export type FinalAdmissionResult = {
  admit: boolean;
  checks: FinalAdmissionCheckResult;
  failedChecks: FinalAdmissionCheckId[];
  contamination: ContaminationPattern[];
  exclusionCode: SemanticExclusionCode | null;
  exclusionReason: string | null;
};

const BUYER_ACTORS = new Set<SemanticActor>([
  "BUYER",
  "PROCURING_ENTITY",
  "AUTHORITY",
]);

const NON_REQUIREMENT_ROLES = new Set<SemanticClauseRole>([
  "HEADING",
  "INFORMATIONAL_FACT",
  "METADATA_FACT",
  "DEFINITION",
  "EXAMPLE",
  "EVALUATION_CRITERION",
  "BUYER_OBLIGATION",
  "POST_AWARD_CONTRACTUAL_OBLIGATION",
  "LEGAL_RESERVATION",
  "PROCEDURAL_RULE",
  "TEMPLATE_PLACEHOLDER",
  "TEMPLATE_INSTRUCTION",
  "FORM_INSTRUCTION",
  "Q_AND_A",
  "CLARIFICATION",
  "AMENDMENT",
  "REVISION",
  "UNKNOWN",
]);

const ADMITTABLE_PURPOSES = new Set<ClausePurpose>([
  "BIDDER_OBLIGATION",
  "BIDDER_PROCEDURAL",
  "AWARD_STAGE_OBLIGATION",
  "ELIGIBILITY",
  "QUALIFICATION",
  "TECHNICAL",
  "COMMERCIAL",
  "FINANCIAL",
  "REQUIRED_DOCUMENT",
  "SUBMISSION",
]);

const BLOCKED_PURPOSES = new Set<ClausePurpose>([
  "BUYER_OBLIGATION",
  "POST_AWARD_OBLIGATION",
  "PROCEDURAL_RULE",
  "FORM_INSTRUCTION",
  "TEMPLATE",
  "INFORMATIONAL_FACT",
  "METADATA_FACT",
  "EVALUATION",
  "Q_AND_A",
  "CLARIFICATION",
  "AMENDMENT",
  "LEGAL_RESERVATION",
  "DEFINITION",
  "HEADING",
  "EXAMPLE",
  "UNKNOWN",
]);

/** Purpose → allowed semantic kinds (compatibility). */
const PURPOSE_KIND_COMPAT: Partial<Record<ClausePurpose, Set<RequirementSemanticKind>>> = {
  BIDDER_OBLIGATION: new Set([
    "ELIGIBILITY_REQUIREMENT",
    "TECHNICAL_REQUIREMENT",
    "ADMINISTRATIVE_REQUIREMENT",
    "PERFORMANCE_OBLIGATION",
    "FINANCIAL_COMMERCIAL_CONDITION",
    "REQUIRED_DOCUMENT",
    "GUARANTEE_SECURITY_REQUIREMENT",
    "CONTRACTUAL_OBLIGATION",
    "UNKNOWN",
  ]),
  BIDDER_PROCEDURAL: new Set([
    "ADMINISTRATIVE_REQUIREMENT",
    "CLARIFICATION_PROCEDURAL",
    "REQUIRED_DOCUMENT",
    "UNKNOWN",
  ]),
  AWARD_STAGE_OBLIGATION: new Set([
    "GUARANTEE_SECURITY_REQUIREMENT",
    "CONTRACTUAL_OBLIGATION",
    "FINANCIAL_COMMERCIAL_CONDITION",
    "PERFORMANCE_OBLIGATION",
    "REQUIRED_DOCUMENT",
    "UNKNOWN",
  ]),
  ELIGIBILITY: new Set([
    "ELIGIBILITY_REQUIREMENT",
    "REQUIRED_DOCUMENT",
    "ADMINISTRATIVE_REQUIREMENT",
    "UNKNOWN",
  ]),
  QUALIFICATION: new Set([
    "ELIGIBILITY_REQUIREMENT",
    "TECHNICAL_REQUIREMENT",
    "PERFORMANCE_OBLIGATION",
    "REQUIRED_DOCUMENT",
    "UNKNOWN",
  ]),
  TECHNICAL: new Set([
    "TECHNICAL_REQUIREMENT",
    "PERFORMANCE_OBLIGATION",
    "REQUIRED_DOCUMENT",
    "UNKNOWN",
  ]),
  COMMERCIAL: new Set([
    "FINANCIAL_COMMERCIAL_CONDITION",
    "GUARANTEE_SECURITY_REQUIREMENT",
    "CONTRACTUAL_OBLIGATION",
    "UNKNOWN",
  ]),
  FINANCIAL: new Set([
    "FINANCIAL_COMMERCIAL_CONDITION",
    "GUARANTEE_SECURITY_REQUIREMENT",
    "REQUIRED_DOCUMENT",
    "UNKNOWN",
  ]),
  REQUIRED_DOCUMENT: new Set([
    "REQUIRED_DOCUMENT",
    "GUARANTEE_SECURITY_REQUIREMENT",
    "ELIGIBILITY_REQUIREMENT",
    "ADMINISTRATIVE_REQUIREMENT",
    "UNKNOWN",
  ]),
  SUBMISSION: new Set([
    "REQUIRED_DOCUMENT",
    "ELIGIBILITY_REQUIREMENT",
    "ADMINISTRATIVE_REQUIREMENT",
    "CLARIFICATION_PROCEDURAL",
    "UNKNOWN",
  ]),
};

const CONDITION_CUE =
  /\b(?:if|unless|when|where(?:\s+applicable)?|provided\s+that|subject\s+to)\b/i;

const MANUFACTURER_SUBJECT =
  /^(?:the\s+)?manufacturer\s+(?:shall|must)\b/i;

/**
 * Lot cues in the obligation text must still be present on the candidate.
 * Expanding Lot N → ALL_LOTS, or dropping the lot, is a semantic invention.
 * No lot cue → unspecified is allowed. ALL in text may stay ALL or narrow.
 */
function lotScopePreserved(text: string, lotLabel: string | null | undefined): boolean {
  const mentioned = extractLotApplicability(text);
  if (mentioned.kind === "UNSPECIFIED") return true;
  if (mentioned.kind === "ALL") return true;
  const stored = parseLotApplicabilityLabel(lotLabel);
  if (stored.kind === "ALL" || stored.kind === "UNSPECIFIED") return false;
  return mentioned.lots.every((lot) => stored.lots.includes(lot));
}

function conditionalityPreserved(c: StructuredConditionality, text: string): boolean {
  if (c.unresolved || c.applicability === "NEEDS_VERIFICATION") return false;
  if (c.applicability === "UNKNOWN") return false;

  // Never allow UNCONDITIONAL when condition cues exist.
  if (c.applicability === "UNCONDITIONAL" && CONDITION_CUE.test(text)) {
    return false;
  }

  if (c.applicability === "CONDITIONAL") {
    if (!c.conditionText) return false;
    // Action must remain attached (explicit actionText or still in full text).
    if (!c.actionText && !/\b(?:shall|must|is\s+required|are\s+required)\b/i.test(text)) {
      return false;
    }
    if (
      c.conditionText &&
      c.actionText &&
      !text.toLowerCase().includes(c.conditionText.slice(0, 12).toLowerCase())
    ) {
      // Reconstructed text must still contain the condition.
      return false;
    }
  }

  return true;
}

function semanticKindCompatible(
  purpose: ClausePurpose,
  kind: RequirementSemanticKind,
): boolean {
  if (BLOCKED_PURPOSES.has(purpose)) return false;
  const allow = PURPOSE_KIND_COMPAT[purpose];
  if (!allow) return ADMITTABLE_PURPOSES.has(purpose);
  return allow.has(kind);
}

function detectContaminations(input: FinalAdmissionInput): ContaminationPattern[] {
  const out: ContaminationPattern[] = [];
  const t = input.requirementText;
  const frame = analyzeObligationFrame(t);
  if (frame.blockReason === "DOCUMENT_IDENTIFIER") {
    out.push("IDENTIFIER_TO_REQUIREMENT");
    out.push("METADATA_TO_REQUIREMENT");
  } else if (frame.blockReason === "DISCLAIMER_OR_LIMITATION") {
    out.push("DISCLAIMER_TO_REQUIREMENT");
  } else if (frame.blockReason === "INTRODUCTORY_PROSE") {
    out.push("INTRO_TO_REQUIREMENT");
  }

  if (BUYER_ACTORS.has(input.actor) && input.bidderRelevant) {
    out.push("BUYER_TO_BIDDER");
  }
  if (input.actor === "CONTRACTOR" && input.bidderRelevant) {
    out.push("CONTRACTOR_TO_BIDDER");
  }
  if (
    (input.actor === "MANUFACTURER" || MANUFACTURER_SUBJECT.test(t)) &&
    input.bidderRelevant &&
    !/\b(?:bidder|tenderer|offeror)s?\b/i.test(t)
  ) {
    out.push("MANUFACTURER_TO_BIDDER");
  }
  if (
    input.clausePurpose === "PROCEDURAL_RULE" ||
    input.clauseRole === "PROCEDURAL_RULE" ||
    /\b(?:click\s+on|e-?sourc(?:e|ing)|upload\s+button)\b/i.test(t)
  ) {
    if (input.bidderRelevant) out.push("PROCEDURAL_TO_REQUIREMENT");
  }
  if (
    isTemplateBlocked(input.templateStatus) ||
    input.clausePurpose === "TEMPLATE" ||
    input.clausePurpose === "FORM_INSTRUCTION"
  ) {
    out.push("TEMPLATE_TO_REQUIREMENT");
  }
  if (
    isPostAwardOnlyPhase(input.procurementPhase) &&
    input.clauseRole !== "AWARD_STAGE_OBLIGATION"
  ) {
    out.push("POST_AWARD_TO_PREBID");
  }
  if (
    input.clauseRole === "HEADING" ||
    input.clausePurpose === "HEADING" ||
    input.isTableHeader
  ) {
    out.push("HEADING_TO_REQUIREMENT");
  }
  if (
    input.clausePurpose === "METADATA_FACT" ||
    input.clauseRole === "METADATA_FACT"
  ) {
    out.push("METADATA_TO_REQUIREMENT");
  }
  if (
    input.clausePurpose === "Q_AND_A" ||
    input.clausePurpose === "CLARIFICATION" ||
    input.clausePurpose === "AMENDMENT" ||
    input.clauseRole === "Q_AND_A" ||
    input.clauseRole === "CLARIFICATION" ||
    input.clauseRole === "AMENDMENT" ||
    input.clauseRole === "REVISION"
  ) {
    out.push("QA_AMENDMENT_MISCLASSIFICATION");
  }
  if (
    input.conditionality.applicability === "CONDITIONAL" &&
    input.conditionality.conditionText &&
    !input.conditionality.actionText &&
    !/\b(?:shall|must)\b/i.test(t)
  ) {
    out.push("CONDITIONAL_ACTION_LOSS");
  }
  if (!input.boundaryComplete || input.orphanConditionUnresolved) {
    out.push("CROSS_PAGE_FRAGMENT_LOSS");
  }
  if (input.isDuplicateIdentity) {
    out.push("DUPLICATE_FRAGMENT_EXPLOSION");
  }
  if (!input.provenanceSourceDocument) {
    out.push("MISSING_PROVENANCE");
  }
  const unattributedBidderStage =
    input.unattributedDocumentaryEvidence === true ||
    input.unattributedEligibilityEvidence === true ||
    input.unattributedCommercialEvidence === true ||
    input.unattributedImpersonalObligation === true;
  if (
    (input.actor === "UNKNOWN" && !unattributedBidderStage) ||
    (input.actor === "IMPERSONAL" &&
      !input.unattributedImpersonalObligation &&
      !input.unattributedCommercialEvidence) ||
    (input.actor === "BIDDER" &&
      !/\b(?:bidder|tenderer|offeror|supplier|consultant|economic\s+operator)s?\b/i.test(
        t,
      ) &&
      input.clausePurpose === "UNKNOWN")
  ) {
    out.push("UNSUPPORTED_ACTOR_PROMOTION");
  }
  if (
    input.situationUncertainty ||
    (input.procurementPhase === "UNKNOWN" &&
      (input.clauseRole === "PERFORMANCE_REQUIREMENT" ||
        input.clausePurpose === "POST_AWARD_OBLIGATION"))
  ) {
    out.push("UNSUPPORTED_PHASE_PROMOTION");
  }

  return out;
}

/**
 * Evaluate the 16-check final admission gate.
 */
export function evaluateFinalSemanticAdmission(
  input: FinalAdmissionInput,
): FinalAdmissionResult {
  const contamination = detectContaminations(input);

  const checks: FinalAdmissionCheckResult = {
    completeBoundaryAndContext:
      input.boundaryComplete &&
      !input.isTableHeader &&
      !input.orphanConditionUnresolved,

    correctDocumentAndSectionRole:
      Boolean(input.documentRole) &&
      Boolean(input.sectionRole) &&
      // Contract / sample-contract packs are never pre-bid bidder requirements.
      !(
        (input.documentRole === "SAMPLE_CONTRACT" ||
          input.documentRole === "CONTRACT_FORM") &&
        input.clauseRole !== "AWARD_STAGE_OBLIGATION"
      ) &&
      // Q&A / clarification packaging is not a requirement source by itself.
      input.documentRole !== "Q_AND_A" &&
      !(
        input.documentRole === "CLARIFICATION" &&
        (input.clausePurpose === "Q_AND_A" ||
          input.clausePurpose === "CLARIFICATION" ||
          input.clausePurpose === "AMENDMENT")
      ) &&
      // Purpose is first-class: portal-only ops and policy context never admit.
      // A Vendor Guide or policy volume may still admit a genuine bidder duty
      // after purpose is reclassified to a requirement source.
      input.documentPurpose !== "PORTAL_GUIDE" &&
      input.documentPurpose !== "POLICY_OR_CODE",

    correctActorAndRecipient:
      (isBidderRelevantActor(input.actor) &&
        input.actor !== "UNKNOWN" &&
        input.actor !== "GENERAL_LEGAL" &&
        input.actor !== "IMPERSONAL" &&
        (input.actor !== "SUCCESSFUL_BIDDER" ||
          input.clauseRole === "AWARD_STAGE_OBLIGATION") &&
        (recipientIsBidderSide(input.recipient) ||
          // Bidder-side actor with unresolved recipient still binds the bidder.
          (input.recipient === "UNKNOWN" && isBidderRelevantActor(input.actor)))) ||
      (input.actor === "UNKNOWN" &&
        input.unattributedDocumentaryEvidence === true &&
        input.clausePurpose === "REQUIRED_DOCUMENT" &&
        input.clauseRole === "REQUIRED_SUBMISSION_DOCUMENT") ||
      (input.actor === "UNKNOWN" &&
        input.unattributedEligibilityEvidence === true &&
        (input.clausePurpose === "ELIGIBILITY" ||
          input.clausePurpose === "QUALIFICATION") &&
        (input.clauseRole === "ELIGIBILITY_CONDITION" ||
          input.clauseRole === "QUALIFICATION_REQUIREMENT")) ||
      ((input.actor === "UNKNOWN" || input.actor === "IMPERSONAL") &&
        input.unattributedCommercialEvidence === true &&
        (input.clausePurpose === "COMMERCIAL" || input.clausePurpose === "FINANCIAL") &&
        (input.clauseRole === "COMMERCIAL_REQUIREMENT" ||
          input.clauseRole === "FINANCIAL_REQUIREMENT")) ||
      (input.actor === "IMPERSONAL" &&
        input.unattributedImpersonalObligation === true &&
        (input.clausePurpose === "SUBMISSION" ||
          input.clausePurpose === "BIDDER_OBLIGATION" ||
          input.clausePurpose === "TECHNICAL" ||
          input.clausePurpose === "REQUIRED_DOCUMENT" ||
          input.clausePurpose === "ELIGIBILITY" ||
          input.clausePurpose === "COMMERCIAL")),

    correctProcurementPhase:
      input.procurementPhase !== "MIXED_OR_AMBIGUOUS" &&
      input.procurementPhase !== "UNKNOWN" &&
      !input.situationUncertainty &&
      (!isPostAwardOnlyPhase(input.procurementPhase) ||
        input.clauseRole === "AWARD_STAGE_OBLIGATION"),

    correctClausePurpose:
      ADMITTABLE_PURPOSES.has(input.clausePurpose) &&
      !BLOCKED_PURPOSES.has(input.clausePurpose),

    bidderRelevanceProven: input.bidderRelevant === true,

    conditionalityPreserved: conditionalityPreserved(
      input.conditionality,
      input.requirementText,
    ),

    templateFormProceduralSafe:
      !isTemplateBlocked(input.templateStatus) &&
      input.clausePurpose !== "PROCEDURAL_RULE" &&
      input.clausePurpose !== "FORM_INSTRUCTION" &&
      input.clausePurpose !== "TEMPLATE" &&
      !versionBlocksCanonicalAdmission(input.versionContext),

    obligationStrengthPreserved:
      input.obligationStrength === "MANDATORY" ||
      input.obligationStrength === "CONDITIONAL" ||
      input.obligationStrength === "OPTIONAL",

    semanticKindCompatible: semanticKindCompatible(
      input.clausePurpose,
      input.semanticKind,
    ),

    lotApplicabilityPreserved: lotScopePreserved(
      input.requirementText,
      input.lotLabel,
    ),

    provenanceComplete: Boolean(input.provenanceSourceDocument?.trim()),

    notHeadingFactDefinitionExampleFragment:
      !NON_REQUIREMENT_ROLES.has(input.clauseRole) &&
      CANONICAL_COMPATIBLE_CLAUSE_ROLES.has(input.clauseRole) &&
      input.boundaryComplete &&
      analyzeObligationFrame(input.requirementText).canAdmitAsBidderObligation,

    notBuyerOrAuthorityOnly: !BUYER_ACTORS.has(input.actor),

    notPostAwardPromotedToPreBid:
      input.actor !== "CONTRACTOR" &&
      input.clausePurpose !== "POST_AWARD_OBLIGATION" &&
      input.clauseRole !== "POST_AWARD_CONTRACTUAL_OBLIGATION" &&
      (!isPostAwardOnlyPhase(input.procurementPhase) ||
        input.clauseRole === "AWARD_STAGE_OBLIGATION"),

    notDuplicateSemanticRequirement: !input.isDuplicateIdentity,
  };

  const failedChecks = FINAL_ADMISSION_CHECKS.filter((id) => !checks[id]);
  const admit = failedChecks.length === 0 && contamination.length === 0;

  let exclusionCode: SemanticExclusionCode | null = null;
  let exclusionReason: string | null = null;
  if (!admit) {
    exclusionCode = mapFailedToExclusion(failedChecks, contamination);
    exclusionReason = [
      failedChecks.length ? `failed:${failedChecks.join(",")}` : null,
      contamination.length ? `contamination:${contamination.join(",")}` : null,
    ]
      .filter(Boolean)
      .join("|");
  }

  return {
    admit,
    checks,
    failedChecks,
    contamination,
    exclusionCode,
    exclusionReason,
  };
}

function mapFailedToExclusion(
  failed: FinalAdmissionCheckId[],
  contamination: ContaminationPattern[],
): SemanticExclusionCode {
  if (contamination.includes("MISSING_PROVENANCE") || failed.includes("provenanceComplete")) {
    return "EXCLUDED_MISSING_PROVENANCE";
  }
  if (
    contamination.includes("BUYER_TO_BIDDER") ||
    failed.includes("notBuyerOrAuthorityOnly")
  ) {
    return "EXCLUDED_BUYER_OBLIGATION";
  }
  if (
    contamination.includes("POST_AWARD_TO_PREBID") ||
    contamination.includes("CONTRACTOR_TO_BIDDER") ||
    failed.includes("notPostAwardPromotedToPreBid")
  ) {
    return "EXCLUDED_POST_AWARD";
  }
  if (
    contamination.includes("TEMPLATE_TO_REQUIREMENT") ||
    failed.includes("templateFormProceduralSafe")
  ) {
    return "EXCLUDED_TEMPLATE";
  }
  if (contamination.includes("PROCEDURAL_TO_REQUIREMENT")) {
    return "EXCLUDED_PROCEDURAL";
  }
  if (
    contamination.includes("HEADING_TO_REQUIREMENT") ||
    failed.includes("notHeadingFactDefinitionExampleFragment")
  ) {
    return "EXCLUDED_HEADING";
  }
  if (
    contamination.includes("METADATA_TO_REQUIREMENT") ||
    contamination.includes("IDENTIFIER_TO_REQUIREMENT")
  ) {
    return "EXCLUDED_METADATA_FACT";
  }
  if (
    contamination.includes("DISCLAIMER_TO_REQUIREMENT") ||
    contamination.includes("INTRO_TO_REQUIREMENT")
  ) {
    return "EXCLUDED_INFORMATIONAL";
  }
  if (contamination.includes("INCOMPLETE_OBLIGATION_FRAME")) {
    return "EXCLUDED_INCOMPLETE_BOUNDARY";
  }
  if (contamination.includes("QA_AMENDMENT_MISCLASSIFICATION")) {
    return "EXCLUDED_Q_AND_A";
  }
  if (
    contamination.includes("CONDITIONAL_ACTION_LOSS") ||
    failed.includes("conditionalityPreserved")
  ) {
    return "AMBIGUOUS_APPLICABILITY";
  }
  if (
    contamination.includes("CROSS_PAGE_FRAGMENT_LOSS") ||
    failed.includes("completeBoundaryAndContext")
  ) {
    return "EXCLUDED_INCOMPLETE_BOUNDARY";
  }
  if (
    contamination.includes("DUPLICATE_FRAGMENT_EXPLOSION") ||
    failed.includes("notDuplicateSemanticRequirement")
  ) {
    return "EXCLUDED_DUPLICATE_FRAGMENT";
  }
  if (
    contamination.includes("UNSUPPORTED_ACTOR_PROMOTION") ||
    failed.includes("correctActorAndRecipient")
  ) {
    return "AMBIGUOUS_ACTOR";
  }
  if (
    contamination.includes("UNSUPPORTED_PHASE_PROMOTION") ||
    failed.includes("correctProcurementPhase")
  ) {
    return "AMBIGUOUS_PHASE";
  }
  if (failed.includes("bidderRelevanceProven")) {
    return "NOT_BIDDER_RELEVANT";
  }
  return "NOT_ADMITTED";
}

/** Build final-gate input from a full interpreted statement. */
export function finalAdmissionFromInterpreted(
  stmt: InterpretedSemanticStatement,
  opts?: { isDuplicateIdentity?: boolean },
): FinalAdmissionResult {
  return evaluateFinalSemanticAdmission({
    requirementText: stmt.requirementText,
    documentRole: stmt.documentRole,
    sectionRole: stmt.sectionRole,
    actor: stmt.actor,
    recipient: stmt.recipient,
    procurementPhase: stmt.procurementPhase,
    clausePurpose: stmt.clausePurpose,
    clauseRole: stmt.clauseRole,
    bidderRelevant: stmt.bidderRelevant,
    conditionality: stmt.conditionality,
    applicability: stmt.applicability,
    templateStatus: stmt.templateStatus,
    obligationStrength: stmt.obligationStrength,
    semanticKind: stmt.semanticKind,
    lotLabel: stmt.lotLabel,
    boundaryComplete: stmt.boundaryComplete,
    provenanceSourceDocument: stmt.provenance.sourceDocument,
    isTableHeader: stmt.tableContext?.isTableHeader === true,
    orphanConditionUnresolved:
      stmt.conditionality.unresolved &&
      Boolean(stmt.conditionality.conditionText) &&
      !stmt.conditionality.actionText,
    versionContext: stmt.versionContext,
    reconstructedFromContext: stmt.reconstructedFromContext,
    isDuplicateIdentity: opts?.isDuplicateIdentity === true,
    situationUncertainty: stmt.situation?.admissionBlockedByUncertainty === true,
    unattributedDocumentaryEvidence:
      stmt.situation?.unattributedDocumentaryEvidence === true,
    unattributedEligibilityEvidence:
      stmt.situation?.unattributedEligibilityEvidence === true,
    unattributedCommercialEvidence:
      stmt.situation?.unattributedCommercialEvidence === true,
    unattributedImpersonalObligation:
      stmt.situation?.unattributedImpersonalObligation === true,
    documentPurpose: stmt.documentPurpose,
  });
}

/** Build final-gate input from a sealed-path candidate (must carry full STI fields). */
export function finalAdmissionFromCandidate(
  c: CanonicalSemanticCandidate,
  opts?: { isDuplicateIdentity?: boolean },
): FinalAdmissionResult {
  const conditionality: StructuredConditionality = c.conditionality ?? {
    applicability: c.applicability,
    conditionText: c.condition,
    actionText: null,
    thresholdText: null,
    exceptionText: null,
    timeframeText: null,
    scopeText: null,
    unresolved: c.applicability === "NEEDS_VERIFICATION",
  };

  return evaluateFinalSemanticAdmission({
    requirementText: c.fullRequirementText,
    documentRole: c.documentRole,
    sectionRole: c.sectionRole,
    actor: c.actor,
    recipient: c.recipient,
    procurementPhase: c.procurementPhase,
    clausePurpose: c.clausePurpose,
    clauseRole: c.clauseRole,
    bidderRelevant: c.bidderRelevant,
    conditionality,
    applicability: c.applicability,
    templateStatus: c.templateStatus,
    obligationStrength: c.obligationStrength,
    semanticKind: c.semanticKind,
    lotLabel: c.lotApplicability,
    boundaryComplete: c.boundaryComplete,
    provenanceSourceDocument: c.sourceDocument ?? c.provenance[0]?.sourceDocument ?? null,
    isTableHeader: c.tableContext?.isTableHeader === true,
    orphanConditionUnresolved:
      conditionality.unresolved &&
      Boolean(conditionality.conditionText) &&
      !conditionality.actionText,
    versionContext: c.versionContext,
    isDuplicateIdentity: opts?.isDuplicateIdentity === true,
    situationUncertainty: c.situation?.admissionBlockedByUncertainty === true,
    unattributedDocumentaryEvidence:
      c.situation?.unattributedDocumentaryEvidence === true,
    unattributedEligibilityEvidence:
      c.situation?.unattributedEligibilityEvidence === true,
    unattributedCommercialEvidence:
      c.situation?.unattributedCommercialEvidence === true,
    unattributedImpersonalObligation:
      c.situation?.unattributedImpersonalObligation === true,
    documentPurpose: c.documentPurpose,
  });
}

/**
 * Hard invariant: sealed/admitted items must never exhibit contamination.
 * Returns empty array when clean.
 */
export function assertNoContaminationInvariants(
  input: FinalAdmissionInput,
): ContaminationPattern[] {
  return detectContaminations(input);
}
