/**
 * Canonical requirement entry gate — runs AFTER full semantic interpretation.
 * Never admits solely because of shall/must/required keywords.
 * Every rejection carries a machine-readable exclusion code (no silent drops).
 */

import {
  CANONICAL_COMPATIBLE_CLAUSE_ROLES,
  type ApplicabilityKind,
  type InterpretedSemanticStatement,
  type ProcurementPhase,
  type SemanticActor,
  type SemanticClauseRole,
  type SemanticExclusionCode,
  type TemplateStatus,
  type VersionSemanticContext,
} from "./types";
import { isPostAwardOnlyPhase } from "./phase";
import { isTemplateBlocked } from "./template";
import { versionBlocksCanonicalAdmission } from "./versioning";

const BIDDER_RELEVANT_ACTORS = new Set<SemanticActor>([
  "BIDDER",
  "TENDERER",
  "OFFEROR",
  "PROSPECTIVE_BIDDER",
  "SUCCESSFUL_BIDDER",
  "SUPPLIER",
  "ECONOMIC_OPERATOR",
  "CONSULTANT",
]);

export function isBidderRelevantActor(actor: SemanticActor): boolean {
  return BIDDER_RELEVANT_ACTORS.has(actor);
}

/** Successful-bidder is bidder-relevant only for explicit award-stage duties. */
export function isSuccessfulBidderAdmissible(
  actor: SemanticActor,
  clauseRole: SemanticClauseRole,
): boolean {
  if (actor !== "SUCCESSFUL_BIDDER") return true;
  return clauseRole === "AWARD_STAGE_OBLIGATION";
}

export function evaluateCanonicalEntryGate(input: {
  clauseRole: SemanticClauseRole;
  actor: SemanticActor;
  procurementPhase: ProcurementPhase;
  applicability: ApplicabilityKind;
  templateStatus: TemplateStatus;
  boundaryComplete: boolean;
  bidderRelevant: boolean;
  hasProvenance: boolean;
  conditionalUnresolved: boolean;
  isTableHeader?: boolean;
  orphanConditionUnresolved?: boolean;
  versionContext?: VersionSemanticContext | null;
  /** Multi-signal fusion preserved uncertainty — never convert into admission. */
  situationUncertainty?: boolean;
  /** Documentary artefact with no named subject — actor stays UNKNOWN. */
  unattributedDocumentaryEvidence?: boolean;
  /** Eligibility evidence with no named subject — actor stays UNKNOWN. */
  unattributedEligibilityEvidence?: boolean;
  unattributedCommercialEvidence?: boolean;
  unattributedImpersonalObligation?: boolean;
  documentPurpose?: string;
}): {
  admit: boolean;
  exclusionCode: SemanticExclusionCode | null;
  exclusionReason: string | null;
} {
  if (!input.boundaryComplete) {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_INCOMPLETE_BOUNDARY",
      exclusionReason: "incomplete_obligation_boundary",
    };
  }
  if (!input.hasProvenance) {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_MISSING_PROVENANCE",
      exclusionReason: "missing_provenance",
    };
  }
  if (input.isTableHeader) {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_TABLE_HEADER",
      exclusionReason: "table_header_or_label",
    };
  }
  if (input.orphanConditionUnresolved) {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_ORPHAN_CONDITION",
      exclusionReason: "orphan_condition_without_action",
    };
  }
  if (versionBlocksCanonicalAdmission(input.versionContext)) {
    const status = input.versionContext?.status ?? "REVIEW";
    return {
      admit: false,
      exclusionCode:
        status === "CONFLICT"
          ? "EXCLUDED_VERSION_CONFLICT"
          : status === "NOT_APPLICABLE" || status === "SUPERSEDED"
            ? "EXCLUDED_VERSION_METADATA"
            : "EXCLUDED_VERSION_REVIEW",
      exclusionReason: `version_status:${status}`,
    };
  }
  if (input.situationUncertainty) {
    return {
      admit: false,
      exclusionCode: "AMBIGUOUS_PHASE",
      exclusionReason: "situation_uncertainty_preserved",
    };
  }
  if (isTemplateBlocked(input.templateStatus)) {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_TEMPLATE",
      exclusionReason: `excluded_template:${input.templateStatus}`,
    };
  }

  switch (input.clauseRole) {
    case "BUYER_OBLIGATION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_BUYER_OBLIGATION",
        exclusionReason: "excluded_content_kind:BUYER_OBLIGATION",
      };
    case "HEADING":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_HEADING",
        exclusionReason: "excluded_content_kind:HEADING",
      };
    case "INFORMATIONAL_FACT":
    case "METADATA_FACT":
      return {
        admit: false,
        exclusionCode:
          input.clauseRole === "METADATA_FACT"
            ? "EXCLUDED_METADATA_FACT"
            : input.documentPurpose === "POLICY_OR_CODE"
              ? "EXCLUDED_POLICY_CONTEXT"
              : "EXCLUDED_INFORMATIONAL",
        exclusionReason: `excluded_content_kind:${input.clauseRole}`,
      };
    case "PROCEDURAL_RULE":
      return {
        admit: false,
        exclusionCode:
          input.documentPurpose === "PORTAL_GUIDE"
            ? "EXCLUDED_PORTAL_OPERATION"
            : "EXCLUDED_PROCEDURAL",
        exclusionReason: `excluded_content_kind:${input.clauseRole}`,
      };
    case "SUBMISSION_INSTRUCTION":
    case "BIDDER_PROCEDURAL_REQUIREMENT":
      if (
        (input.bidderRelevant && isBidderRelevantActor(input.actor)) ||
        input.unattributedImpersonalObligation === true
      ) {
        break;
      }
      return {
        admit: false,
        exclusionCode: "EXCLUDED_PROCEDURAL",
        exclusionReason: `excluded_content_kind:${input.clauseRole}`,
      };
    case "POST_AWARD_CONTRACTUAL_OBLIGATION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_POST_AWARD",
        exclusionReason: "excluded_content_kind:POST_AWARD_CONTRACTUAL_OBLIGATION",
      };
    case "LEGAL_RESERVATION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_LEGAL_RESERVATION",
        exclusionReason: "excluded_content_kind:LEGAL_RESERVATION",
      };
    case "EVALUATION_CRITERION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_EVALUATION_CRITERION",
        exclusionReason: "excluded_content_kind:EVALUATION_CRITERION",
      };
    case "Q_AND_A":
    case "CLARIFICATION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_Q_AND_A",
        exclusionReason: `excluded_content_kind:${input.clauseRole}`,
      };
    case "AMENDMENT":
    case "REVISION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_AMENDMENT_METADATA",
        exclusionReason: `excluded_content_kind:${input.clauseRole}`,
      };
    case "EXAMPLE":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_EXAMPLE",
        exclusionReason: "excluded_content_kind:EXAMPLE",
      };
    case "DEFINITION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_DEFINITION",
        exclusionReason: "excluded_content_kind:DEFINITION",
      };
    case "TEMPLATE_PLACEHOLDER":
    case "TEMPLATE_INSTRUCTION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_TEMPLATE",
        exclusionReason: `excluded_content_kind:${input.clauseRole}`,
      };
    case "FORM_INSTRUCTION":
      return {
        admit: false,
        exclusionCode: "EXCLUDED_FORM_INSTRUCTION",
        exclusionReason: "excluded_content_kind:FORM_INSTRUCTION",
      };
    default:
      break;
  }

  if (isPostAwardOnlyPhase(input.procurementPhase) && input.clauseRole !== "AWARD_STAGE_OBLIGATION") {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_POST_AWARD",
      exclusionReason: `excluded_phase:${input.procurementPhase}`,
    };
  }

  if (
    input.procurementPhase === "MIXED_OR_AMBIGUOUS" &&
    input.clauseRole !== "AWARD_STAGE_OBLIGATION"
  ) {
    return {
      admit: false,
      exclusionCode: "AMBIGUOUS_PHASE",
      exclusionReason: "ambiguous_phase:MIXED_OR_AMBIGUOUS",
    };
  }

  if (!isSuccessfulBidderAdmissible(input.actor, input.clauseRole)) {
    return {
      admit: false,
      exclusionCode: "EXCLUDED_POST_AWARD",
      exclusionReason: "successful_bidder_without_award_stage_duty",
    };
  }

  const unattributedBidderStage =
    ((input.actor === "UNKNOWN" || input.actor === "IMPERSONAL") &&
      ((input.unattributedDocumentaryEvidence === true &&
        input.clauseRole === "REQUIRED_SUBMISSION_DOCUMENT") ||
        (input.unattributedEligibilityEvidence === true &&
          (input.clauseRole === "ELIGIBILITY_CONDITION" ||
            input.clauseRole === "QUALIFICATION_REQUIREMENT")) ||
        (input.unattributedCommercialEvidence === true &&
          (input.clauseRole === "COMMERCIAL_REQUIREMENT" ||
            input.clauseRole === "FINANCIAL_REQUIREMENT")) ||
        (input.unattributedImpersonalObligation === true &&
          (input.clauseRole === "SUBMISSION_INSTRUCTION" ||
            input.clauseRole === "BIDDER_REQUIREMENT" ||
            input.clauseRole === "TECHNICAL_REQUIREMENT" ||
            input.clauseRole === "REQUIRED_SUBMISSION_DOCUMENT" ||
            input.clauseRole === "ELIGIBILITY_CONDITION" ||
            input.clauseRole === "COMMERCIAL_REQUIREMENT"))));

  if (input.actor === "UNKNOWN" || input.actor === "GENERAL_LEGAL" || input.actor === "IMPERSONAL") {
    if (!unattributedBidderStage) {
      return {
        admit: false,
        exclusionCode: "AMBIGUOUS_ACTOR",
        exclusionReason: `not_admitted:${input.clauseRole}/UNKNOWN`,
      };
    }
  }

  if (
    !input.bidderRelevant ||
    (!isBidderRelevantActor(input.actor) && !unattributedBidderStage)
  ) {
    if (input.actor === "CONTRACTOR") {
      return {
        admit: false,
        exclusionCode: "EXCLUDED_POST_AWARD",
        exclusionReason: "non_bidder_actor:CONTRACTOR",
      };
    }
    return {
      admit: false,
      exclusionCode: "NOT_BIDDER_RELEVANT",
      exclusionReason: `non_bidder_actor:${input.actor}`,
    };
  }

  if (input.conditionalUnresolved || input.applicability === "NEEDS_VERIFICATION") {
    return {
      admit: false,
      exclusionCode: "AMBIGUOUS_APPLICABILITY",
      exclusionReason: "ambiguous_applicability",
    };
  }

  if (input.procurementPhase === "UNKNOWN") {
    return {
      admit: false,
      exclusionCode: "AMBIGUOUS_PHASE",
      exclusionReason: "ambiguous_phase",
    };
  }

  if (!CANONICAL_COMPATIBLE_CLAUSE_ROLES.has(input.clauseRole)) {
    return {
      admit: false,
      exclusionCode: "NOT_ADMITTED",
      exclusionReason: `not_admitted:${input.clauseRole}/${input.actor}`,
    };
  }

  return { admit: true, exclusionCode: null, exclusionReason: null };
}

/** Stable exclusion reason string for logging (includes code). */
export function formatExclusion(
  code: SemanticExclusionCode | null,
  reason: string | null,
): string | null {
  if (!code && !reason) return null;
  if (code && reason) return `${code}:${reason}`;
  return code ?? reason;
}

export type EntryGateResult = ReturnType<typeof evaluateCanonicalEntryGate>;

export function gateFromInterpreted(
  stmt: Pick<
    InterpretedSemanticStatement,
    | "clauseRole"
    | "actor"
    | "procurementPhase"
    | "applicability"
    | "templateStatus"
    | "boundaryComplete"
    | "bidderRelevant"
    | "provenance"
    | "conditional"
    | "conditionText"
    | "tableContext"
    | "versionContext"
    | "conditionality"
    | "situation"
    | "documentPurpose"
  >,
): EntryGateResult {
  const unresolved =
    stmt.conditionality?.unresolved === true ||
    (stmt.conditional &&
      stmt.applicability === "NEEDS_VERIFICATION");

  return evaluateCanonicalEntryGate({
    clauseRole: stmt.clauseRole,
    actor: stmt.actor,
    procurementPhase: stmt.procurementPhase,
    applicability: stmt.applicability,
    templateStatus: stmt.templateStatus,
    boundaryComplete: stmt.boundaryComplete,
    bidderRelevant: stmt.bidderRelevant,
    hasProvenance: Boolean(stmt.provenance.sourceDocument),
    conditionalUnresolved: unresolved,
    isTableHeader: stmt.tableContext?.isTableHeader === true,
    orphanConditionUnresolved:
      stmt.conditionality?.unresolved === true &&
      Boolean(stmt.conditionality?.conditionText) &&
      !stmt.conditionality?.actionText,
    versionContext: stmt.versionContext,
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
