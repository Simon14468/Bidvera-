/**
 * Canonical admission firewall — last line of defense after STI seal + normalize.
 *
 * Normalization must never resurrect STI-excluded semantics.
 * This module re-checks STI fields on NormalizedRequirement and strips
 * any row that violates bidder-stage invariants (I1–I18).
 *
 * Exclusions are auditable (never silent).
 */

import { isPostAwardOnlyPhase } from "@/domain/semantic-tender-intelligence/phase";
import { resolveSemanticActor } from "@/domain/semantic-tender-intelligence/actor";
import { hasMixedLifecycleFrames } from "@/domain/semantic-tender-intelligence/mixed-clause";
import { detectMetadataFact } from "@/domain/semantic-tender-intelligence/metadata";
import { analyzeObligationFrame } from "@/domain/semantic-tender-intelligence/obligation-frame";
import {
  extractIndependentSignals,
  isBuyerActor,
  isPerformerActor,
} from "@/domain/semantic-tender-intelligence/semantic-signals";
import type { ProcurementPhase } from "@/domain/semantic-tender-intelligence/types";
import { isNonRequirementText } from "./filter-non-requirements";
import type { NormalizedRequirement } from "./types";

export const STI_ADMISSION_VERSION = "sti-admission/v3" as const;

export type FirewallExclusionCode =
  | "BUYER_OBLIGATION"
  | "POST_AWARD_OBLIGATION"
  | "CONTRACT_EXECUTION"
  | "DELIVERY_IMPLEMENTATION"
  | "TEMPLATE_INSTRUCTION"
  | "LEGAL_RESERVATION"
  | "INFORMATIONAL_FACT"
  | "NON_BIDDER_PROCEDURE"
  | "MIXED_OR_AMBIGUOUS"
  | "INCOMPLETE_CLAUSE"
  | "DOCUMENT_IDENTIFIER"
  | "DISCLAIMER_OR_INTRO"
  | "SEMANTIC_CONFLICT"
  | "MISSING_STI_PROVENANCE"
  | "CONDITIONALITY_UPGRADE"
  | "UNSUPPORTED_ACTOR";

export type FirewallRejection = {
  requirement: string;
  exclusionCode: FirewallExclusionCode;
  exclusionReason: string;
  actor: string | null;
  lifecyclePhase: string | null;
  purpose: string | null;
  semanticKind: string | null;
};

const BUYER_ACTORS = new Set([
  "BUYER",
  "AUTHORITY",
  "PROCURING_ENTITY",
  "EVALUATOR",
]);

const BLOCKED_PURPOSES = new Set([
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
]);

const BLOCKED_ROLES = new Set([
  "BUYER_OBLIGATION",
  "POST_AWARD_CONTRACTUAL_OBLIGATION",
  "PROCEDURAL_RULE",
  "TEMPLATE_PLACEHOLDER",
  "TEMPLATE_INSTRUCTION",
  "FORM_INSTRUCTION",
  "INFORMATIONAL_FACT",
  "METADATA_FACT",
  "EVALUATION_CRITERION",
  "LEGAL_RESERVATION",
  "DEFINITION",
  "HEADING",
  "EXAMPLE",
  "Q_AND_A",
  "CLARIFICATION",
  "AMENDMENT",
  "REVISION",
]);

/**
 * Evaluate a single normalized row against bidder-stage admission invariants.
 * Returns null when admissible.
 */
export function evaluateNormalizedAdmissionFirewall(
  row: NormalizedRequirement,
): FirewallRejection | null {
  const actor = row.stiActor ?? null;
  const phase = (row.stiProcurementPhase ?? null) as ProcurementPhase | null;
  const purpose = row.stiClausePurpose ?? null;
  const role = row.stiClauseRole ?? null;
  const snippet = row.requirement.slice(0, 160);

  const base = {
    requirement: snippet,
    actor,
    lifecyclePhase: phase,
    purpose,
    semanticKind: row.semanticKind ?? null,
  };

  const frame = analyzeObligationFrame(row.requirement);
  if (frame.blockReason === "DOCUMENT_IDENTIFIER" || detectMetadataFact(row.requirement).isMetadata) {
    return {
      ...base,
      exclusionCode: "DOCUMENT_IDENTIFIER",
      exclusionReason: "document_identifier_or_metadata_is_not_a_bidder_obligation",
    };
  }
  if (frame.blockReason === "DISCLAIMER_OR_LIMITATION" || frame.blockReason === "INTRODUCTORY_PROSE") {
    return {
      ...base,
      exclusionCode: "DISCLAIMER_OR_INTRO",
      exclusionReason: `excluded_${frame.blockReason.toLowerCase()}`,
    };
  }
  if (isNonRequirementText(row.requirement)) {
    return {
      ...base,
      exclusionCode: "INFORMATIONAL_FACT",
      exclusionReason: "non_requirement_text_cannot_enter_canonical",
    };
  }

  const textActor = resolveSemanticActor(row.requirement).actor;
  const signals = extractIndependentSignals({
    text: row.requirement,
    actor: textActor,
    recipient: "UNKNOWN",
    documentRole: "UNKNOWN",
    sectionRole: "UNKNOWN",
    templateStatus: "NOT_TEMPLATE",
  });

  // I16 / I17 — STI provenance required on production path
  if (!actor || !phase || !purpose || !role) {
    return {
      ...base,
      exclusionCode: "MISSING_STI_PROVENANCE",
      exclusionReason: "normalized_row_missing_sti_semantic_fields",
    };
  }

  // Stamped STI fields cannot contradict independent grammar / lifecycle signals.
  if (isBuyerActor(textActor) && !BUYER_ACTORS.has(actor)) {
    return {
      ...base,
      exclusionCode: "SEMANTIC_CONFLICT",
      exclusionReason: `sti_stamp_contradicts_buyer_grammar:${textActor}/${actor}`,
    };
  }
  if (isPerformerActor(textActor) && actor !== "CONTRACTOR" && actor !== "SUCCESSFUL_BIDDER" && actor !== "SUBCONTRACTOR") {
    return {
      ...base,
      exclusionCode: "POST_AWARD_OBLIGATION",
      exclusionReason: `sti_stamp_contradicts_performer_grammar:${textActor}/${actor}`,
    };
  }
  if (hasMixedLifecycleFrames(row.requirement) && phase !== "MIXED_OR_AMBIGUOUS") {
    return {
      ...base,
      exclusionCode: "MIXED_OR_AMBIGUOUS",
      exclusionReason: "sti_stamp_hid_mixed_lifecycle",
    };
  }
  if (
    signals.action.value === "EXECUTE_PERFORM" &&
    (signals.temporal.value === "POST_AWARD_TIME" ||
      signals.temporal.value === "WARRANTY_PERIOD" ||
      signals.temporal.value === "CONTRACT_PERIOD") &&
    phase === "BID_SUBMISSION" &&
    role !== "AWARD_STAGE_OBLIGATION"
  ) {
    return {
      ...base,
      exclusionCode: "POST_AWARD_OBLIGATION",
      exclusionReason: "sti_stamp_promoted_execution_to_bid_submission",
    };
  }

  // I4
  if (BUYER_ACTORS.has(actor) || purpose === "BUYER_OBLIGATION" || role === "BUYER_OBLIGATION") {
    return {
      ...base,
      exclusionCode: "BUYER_OBLIGATION",
      exclusionReason: `excluded_buyer_actor_or_purpose:${actor}/${purpose}`,
    };
  }

  // I1–I3, I6
  if (phase === "MIXED_OR_AMBIGUOUS") {
    return {
      ...base,
      exclusionCode: "MIXED_OR_AMBIGUOUS",
      exclusionReason: "excluded_phase:MIXED_OR_AMBIGUOUS",
    };
  }
  if (phase === "POST_AWARD") {
    return {
      ...base,
      exclusionCode: "POST_AWARD_OBLIGATION",
      exclusionReason: "excluded_phase:POST_AWARD",
    };
  }
  if (phase === "CONTRACT_EXECUTION" || phase === "CONTRACT_PERFORMANCE") {
    return {
      ...base,
      exclusionCode: "CONTRACT_EXECUTION",
      exclusionReason: `excluded_phase:${phase}`,
    };
  }
  if (phase === "DELIVERY_IMPLEMENTATION") {
    return {
      ...base,
      exclusionCode: "DELIVERY_IMPLEMENTATION",
      exclusionReason: "excluded_phase:DELIVERY_IMPLEMENTATION",
    };
  }
  if (isPostAwardOnlyPhase(phase) && role !== "AWARD_STAGE_OBLIGATION") {
    return {
      ...base,
      exclusionCode: "POST_AWARD_OBLIGATION",
      exclusionReason: `excluded_post_award_phase:${phase}`,
    };
  }

  // I5
  if (
    purpose === "TEMPLATE" ||
    purpose === "FORM_INSTRUCTION" ||
    role === "TEMPLATE_INSTRUCTION" ||
    role === "TEMPLATE_PLACEHOLDER" ||
    role === "FORM_INSTRUCTION" ||
    (row.stiTemplateStatus &&
      row.stiTemplateStatus !== "NOT_TEMPLATE" &&
      role !== "AWARD_STAGE_OBLIGATION")
  ) {
    return {
      ...base,
      exclusionCode: "TEMPLATE_INSTRUCTION",
      exclusionReason: `excluded_template:${row.stiTemplateStatus ?? purpose}`,
    };
  }

  if (purpose === "LEGAL_RESERVATION" || role === "LEGAL_RESERVATION") {
    return {
      ...base,
      exclusionCode: "LEGAL_RESERVATION",
      exclusionReason: "excluded_legal_reservation",
    };
  }

  if (
    purpose === "INFORMATIONAL_FACT" ||
    purpose === "METADATA_FACT" ||
    role === "INFORMATIONAL_FACT" ||
    role === "METADATA_FACT"
  ) {
    return {
      ...base,
      exclusionCode: "INFORMATIONAL_FACT",
      exclusionReason: "excluded_informational",
    };
  }

  if (purpose === "PROCEDURAL_RULE" || role === "PROCEDURAL_RULE") {
    return {
      ...base,
      exclusionCode: "NON_BIDDER_PROCEDURE",
      exclusionReason: "excluded_procedural_rule",
    };
  }

  if (BLOCKED_PURPOSES.has(purpose) || BLOCKED_ROLES.has(role)) {
    return {
      ...base,
      exclusionCode: "SEMANTIC_CONFLICT",
      exclusionReason: `excluded_blocked_purpose_or_role:${purpose}/${role}`,
    };
  }

  // I11 — successful bidder only for award-stage
  if (actor === "SUCCESSFUL_BIDDER" && role !== "AWARD_STAGE_OBLIGATION") {
    return {
      ...base,
      exclusionCode: "SEMANTIC_CONFLICT",
      exclusionReason: "successful_bidder_without_award_stage_duty",
    };
  }

  // Contractor never bidder-stage
  if (actor === "CONTRACTOR" || actor === "SUBCONTRACTOR") {
    return {
      ...base,
      exclusionCode: "POST_AWARD_OBLIGATION",
      exclusionReason: `excluded_performer_actor:${actor}`,
    };
  }

  if (actor === "UNKNOWN" || actor === "IMPERSONAL" || actor === "GENERAL_LEGAL") {
    const unattributedBidderStage =
      (actor === "UNKNOWN" &&
        (row.stiSituation?.unattributedDocumentaryEvidence === true ||
          row.stiSituation?.unattributedEligibilityEvidence === true ||
          row.stiSituation?.unattributedCommercialEvidence === true)) ||
      (actor === "IMPERSONAL" &&
        row.stiSituation?.unattributedImpersonalObligation === true);
    if (!unattributedBidderStage) {
      return {
        ...base,
        exclusionCode: "UNSUPPORTED_ACTOR",
        exclusionReason: `excluded_actor:${actor}`,
      };
    }
  }

  // I9 — never upgrade conditional → mandatory
  if (
    row.obligationStrength === "CONDITIONAL" &&
    row.mandatory === true
  ) {
    return {
      ...base,
      exclusionCode: "CONDITIONALITY_UPGRADE",
      exclusionReason: "conditional_marked_mandatory",
    };
  }

  // Provenance completeness (I17)
  const hasProvenance =
    Boolean(row.sourceDocument?.trim()) ||
    Boolean(row.stiProvenance?.some((p) => p.sourceDocument?.trim()));
  if (!hasProvenance) {
    return {
      ...base,
      exclusionCode: "MISSING_STI_PROVENANCE",
      exclusionReason: "missing_source_document_provenance",
    };
  }

  return null;
}

/**
 * Filter normalized rows through the admission firewall.
 * Rejected rows are returned with audit metadata — never silently dropped without codes.
 */
export function enforceCanonicalAdmissionFirewall(
  rows: readonly NormalizedRequirement[],
): {
  admitted: NormalizedRequirement[];
  rejected: FirewallRejection[];
} {
  const admitted: NormalizedRequirement[] = [];
  const rejected: FirewallRejection[] = [];

  for (const row of rows) {
    const hit = evaluateNormalizedAdmissionFirewall(row);
    if (hit) {
      rejected.push(hit);
      continue;
    }
    admitted.push(row);
  }

  return { admitted, rejected };
}

/** Hard invariants I1–I6 over an admitted set (throws on violation). */
export function assertBidderStageCanonicalInvariants(
  rows: readonly NormalizedRequirement[],
): void {
  for (const row of rows) {
    const hit = evaluateNormalizedAdmissionFirewall(row);
    if (hit) {
      throw new Error(
        `Canonical admission invariant violated: ${hit.exclusionCode} — ${hit.exclusionReason} — ${hit.requirement}`,
      );
    }
  }
}
