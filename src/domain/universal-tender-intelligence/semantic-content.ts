/**
 * UTI semantic content — thin adapter over Semantic Tender Intelligence.
 * STI is the single authoritative interpretation boundary.
 * Kept for UTI tests / package tooling compatibility.
 */

import { interpretSemanticStatement } from "@/domain/semantic-tender-intelligence";
import type { ObligationActorKind } from "@/domain/tender-requirements/obligation-actor";
import type { RequirementSemanticKind } from "@/domain/tender-requirements/semantic-kind";
import type {
  ClassifiedContentUnit,
  SemanticContentType,
  UniversalActor,
  UtiFailureCode,
} from "./types";

function mapActor(actor: string, kind: ObligationActorKind): UniversalActor {
  switch (actor) {
    case "BIDDER":
    case "TENDERER":
    case "OFFEROR":
    case "SUPPLIER":
    case "ECONOMIC_OPERATOR":
    case "CONSULTANT":
      return "BIDDER";
    case "MANUFACTURER":
    case "SUBCONTRACTOR":
      return "THIRD_PARTY";
    case "CONTRACTOR":
      return "CONTRACTOR";
    case "AUTHORITY":
    case "BUYER":
      return "CONTRACTING_AUTHORITY";
    case "PROCURING_ENTITY":
      return "PROCURING_ENTITY";
    case "EVALUATOR":
      return "EVALUATOR";
    case "DOCUMENT_AUTHOR":
      return "DOCUMENT_AUTHOR";
    case "THIRD_PARTY":
      return "THIRD_PARTY";
    default:
      if (kind === "BIDDER_SIDE") return "BIDDER";
      if (kind === "AUTHORITY_SIDE") return "CONTRACTING_AUTHORITY";
      if (kind === "DOCUMENT_PROCEDURE") return "DOCUMENT_AUTHOR";
      if (kind === "CLARIFICATION_CONTEXT") return "PROCURING_ENTITY";
      return "UNKNOWN";
  }
}

function mapContentType(clauseRole: string): SemanticContentType {
  switch (clauseRole) {
    case "BIDDER_REQUIREMENT":
      return "BIDDER_OBLIGATION";
    case "BUYER_OBLIGATION":
      return "AUTHORITY_OBLIGATION";
    case "REQUIRED_SUBMISSION_DOCUMENT":
      return "REQUIRED_DOCUMENT";
    case "ELIGIBILITY_CONDITION":
      return "ELIGIBILITY_CONDITION";
    case "TECHNICAL_REQUIREMENT":
      return "TECHNICAL_REQUIREMENT";
    case "COMMERCIAL_REQUIREMENT":
    case "FINANCIAL_REQUIREMENT":
      return "COMMERCIAL_REQUIREMENT";
    case "POST_AWARD_CONTRACTUAL_OBLIGATION":
    case "AWARD_STAGE_OBLIGATION":
    case "PERFORMANCE_REQUIREMENT":
    case "DELIVERY_REQUIREMENT":
      return "CONTRACTUAL_OBLIGATION";
    case "EVALUATION_CRITERION":
      return "EVALUATION_CRITERION";
    case "PROCEDURAL_RULE":
    case "SUBMISSION_INSTRUCTION":
      return "DOCUMENT_PROCEDURE";
    case "HEADING":
      return "SECTION_HEADING";
    case "INFORMATIONAL_FACT":
    case "METADATA_FACT":
    case "DEFINITION":
      return "INFORMATIONAL_FACT";
    case "Q_AND_A":
      return "Q_AND_A";
    case "CLARIFICATION":
      return "CLARIFICATION";
    case "REVISION":
      return "REVISION";
    case "AMENDMENT":
      return "ADDENDUM";
    case "EXAMPLE":
      return "EXAMPLE";
    case "TEMPLATE_PLACEHOLDER":
    case "TEMPLATE_INSTRUCTION":
      return "DOCUMENT_DESCRIPTION";
    case "LEGAL_RESERVATION":
      return "INFORMATIONAL_FACT";
    default:
      return "UNKNOWN";
  }
}

/**
 * Classify one extracted statement — delegates to STI interpretSemanticStatement.
 */
export function classifySemanticContent(input: {
  text: string;
  fileId?: string | null;
  fileName?: string | null;
  page?: number | null;
  categoryHint?: string | null;
}): ClassifiedContentUnit {
  const stmt = interpretSemanticStatement({
    text: input.text,
    categoryHint: input.categoryHint ?? null,
    provenance: {
      sourceDocument: input.fileName ?? input.fileId ?? "uti-unit",
      sourcePage: input.page ?? null,
    },
  });

  const failureCodes: UtiFailureCode[] = [];
  if (!stmt.boundaryComplete) failureCodes.push("INCOMPLETE_FRAGMENT");
  if (stmt.actor === "UNKNOWN") failureCodes.push("UNKNOWN_ACTOR");
  if (stmt.clauseRole === "UNKNOWN" || stmt.semanticKind === "UNKNOWN") {
    failureCodes.push("UNKNOWN_CLASSIFICATION");
  }
  if (!input.fileName && !input.fileId) failureCodes.push("MISSING_PROVENANCE");
  if (stmt.confidence < 0.35) failureCodes.push("LOW_CONFIDENCE");
  if (stmt.exclusionCode === "AMBIGUOUS_ACTOR") failureCodes.push("AMBIGUOUS_CONTENT");

  return {
    text: stmt.requirementText,
    contentType: mapContentType(stmt.clauseRole),
    actor: mapActor(stmt.actor, stmt.obligationActorKind),
    obligationActorKind: stmt.obligationActorKind,
    semanticKind: stmt.semanticKind as RequirementSemanticKind,
    obligationStrength:
      stmt.obligationStrength === "UNKNOWN"
        ? "INFORMATIONAL"
        : stmt.obligationStrength,
    conditional: stmt.conditional,
    conditionText: stmt.conditionText,
    confidence: stmt.confidence,
    provenance: {
      fileId: input.fileId ?? null,
      fileName: input.fileName ?? null,
      page: input.page ?? null,
    },
    failureCodes: [...new Set(failureCodes)],
    // STI is authoritative — admit only when STI admits (ignore synthetic provenance).
    admitToRequirements: stmt.admitToCanonical && Boolean(input.fileName || input.fileId),
  };
}
