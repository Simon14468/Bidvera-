/**
 * Document purpose — first-class semantic signal before admission.
 * Content evidence first. Role may corroborate; filename never decides alone.
 * A Vendor Guide may still contain real bidder obligations.
 * Portal-operation instructions never become requirements.
 */

import type {
  DocumentPurpose,
  SemanticDocumentRole,
  SemanticSectionRole,
} from "./types";

export type { DocumentPurpose } from "./types";

const PORTAL_OPERATION =
  /\b(?:click\s+(?:on|here|the)|log\s*in\s+to|sign\s+in\s+to|upload\s+(?:button|icon)|navigate\s+to\s+(?:the\s+)?(?:e-?sourcing|portal|system)|browser\s+(?:settings?|cookies?)|reset\s+(?:your\s+)?password|forgot\s+password|enable\s+javascript|supported\s+browsers?|select\s+the\s+(?:upload|browse)\s+button)\b/i;

const VENDOR_GUIDE_FRAMING =
  /\b(?:vendor|supplier|bidder)\s+guide\b|\bhow\s+to\s+(?:register|use|access)\s+(?:the\s+)?(?:portal|e-?sourcing|system|platform)\b|\bvendor\s+registration\s+(?:guide|manual|instructions?)\b|\be-?sourcing\s+(?:user\s+)?(?:guide|manual)\b|\bthis\s+guide\s+(?:explains|describes|will\s+help|covers|provides)\b|\bregister\s+as\s+a\s+(?:vendor|supplier)\b/i;

const POLICY_FRAMING =
  /\b(?:code\s+of\s+conduct|ethics\s+policy|sustainability\s+policy|environmental\s+policy|this\s+policy\s+(?:describes|sets\s+out|applies\s+to|is\s+provided))\b/i;

const BIDDER_STAGE_OBLIGATION_CUE =
  /\b(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator)s?\s+(?:shall|must|is\s+required|are\s+required)\b|\b(?:shall|must)\s+(?:submit|provide|include|attach|demonstrate|comply)\b/i;

const EXPLICIT_BIDDER_POLICY_OBLIGATION =
  /\b(?:bidder|tenderer|offeror)s?\s+(?:shall|must)\s+comply\b|\bcompliance\s+with\s+(?:this\s+)?(?:code|policy)\s+(?:is|shall\s+be)\s+(?:a\s+)?(?:condition|mandatory|required)\b/i;

const CORE_PROCUREMENT_ROLES = new Set<SemanticDocumentRole>([
  "INSTRUCTIONS_TO_BIDDERS",
  "SCHEDULE_OF_REQUIREMENTS",
  "TECHNICAL_SPECIFICATION",
  "STATEMENT_OF_WORK",
  "TERMS_AND_CONDITIONS",
  "RETURNABLE_BIDDING_FORMS",
  "FINANCIAL_FORMS",
  "NOTICE",
  "QUALIFICATION",
]);

export function isPortalOperationInstruction(text: string): boolean {
  return PORTAL_OPERATION.test(text);
}

export function isVendorGuideFraming(text: string): boolean {
  return VENDOR_GUIDE_FRAMING.test(text);
}

export function isPolicyFraming(text: string): boolean {
  return POLICY_FRAMING.test(text);
}

export function hasBidderStageObligationCue(text: string): boolean {
  return BIDDER_STAGE_OBLIGATION_CUE.test(text);
}

export function isExplicitBidderPolicyObligation(text: string): boolean {
  return EXPLICIT_BIDDER_POLICY_OBLIGATION.test(text);
}

export function isCoreProcurementVolume(role: SemanticDocumentRole): boolean {
  return CORE_PROCUREMENT_ROLES.has(role);
}

/**
 * What is this document for? Never admits a clause by itself.
 */
export function classifyDocumentPurpose(input: {
  text: string;
  documentRole: SemanticDocumentRole;
  sectionRole?: SemanticSectionRole | null;
}): DocumentPurpose {
  const t = input.text;
  const role = input.documentRole;

  if (role === "PORTAL_GUIDE") {
    return hasBidderStageObligationCue(t) ? "VENDOR_GUIDE" : "PORTAL_GUIDE";
  }
  if (role === "VENDOR_GUIDE") return "VENDOR_GUIDE";
  if (role === "POLICY_OR_CODE_OF_CONDUCT") {
    return isExplicitBidderPolicyObligation(t)
      ? "PROCUREMENT_REQUIREMENT_SOURCE"
      : "POLICY_OR_CODE";
  }
  if (role === "SAMPLE_CONTRACT" || role === "CONTRACT_FORM") {
    return "CONTRACT_EXECUTION_SOURCE";
  }
  if (
    role === "Q_AND_A" ||
    role === "CLARIFICATION" ||
    role === "CORRIGENDUM" ||
    role === "AMENDMENT"
  ) {
    return "CLARIFICATION_SOURCE";
  }
  if (role === "PREBID_MATERIAL") {
    return hasBidderStageObligationCue(t)
      ? "PROCUREMENT_REQUIREMENT_SOURCE"
      : "BACKGROUND";
  }

  if (isPortalOperationInstruction(t) && !hasBidderStageObligationCue(t)) {
    return "PORTAL_GUIDE";
  }
  if (isVendorGuideFraming(t)) {
    // A mislabelled notice/annex/other must not erase guide purpose.
    // ITT / schedule / specification / returnable volumes stay requirement sources.
    if (
      role === "INSTRUCTIONS_TO_BIDDERS" ||
      role === "SCHEDULE_OF_REQUIREMENTS" ||
      role === "TECHNICAL_SPECIFICATION" ||
      role === "STATEMENT_OF_WORK" ||
      role === "RETURNABLE_BIDDING_FORMS" ||
      role === "FINANCIAL_FORMS" ||
      role === "QUALIFICATION" ||
      role === "TERMS_AND_CONDITIONS"
    ) {
      // fall through
    } else {
      return "VENDOR_GUIDE";
    }
  }
  if (
    isPolicyFraming(t) &&
    !isExplicitBidderPolicyObligation(t) &&
    !isCoreProcurementVolume(role)
  ) {
    return "POLICY_OR_CODE";
  }
  if (isCoreProcurementVolume(role)) return "PROCUREMENT_REQUIREMENT_SOURCE";
  if (input.sectionRole === "EVALUATION") return "EVALUATION_METHODOLOGY";
  if (input.sectionRole === "INFORMATIONAL_BACKGROUND") return "BACKGROUND";
  if (
    /\b(?:minutes?\s+of\s+(?:the\s+)?(?:pre[- ]?bid|pre[- ]?tender|bidders?['']?\s+conference)|pre[- ]?bid\s+(?:meeting|conference|slides|presentation)|this\s+presentation\s+(?:is|provides|summarises|summarizes))\b/i.test(
      t,
    ) &&
    !hasBidderStageObligationCue(t)
  ) {
    return "BACKGROUND";
  }
  return "UNKNOWN";
}
