/**
 * Authoritative semantic interpretation of a tender statement.
 *
 * Mandatory reasoning order (universal procurement engine):
 *   DOCUMENT → DOCUMENT ROLE → SECTION ROLE → CLAUSE BOUNDARY
 *   → ACTOR → RECIPIENT/TARGET → PROCUREMENT PHASE
 *   → CLAUSE PURPOSE → CONDITIONALITY → TEMPLATE STATUS
 *   → OBLIGATION STRENGTH → BIDDER RELEVANCE
 *   → SEMANTIC KIND → CANONICAL ENTRY GATE
 *
 * Actor and phase are NOT interchangeable.
 * Shall/must/required alone never prove a bidder requirement.
 * Does not use company profile. Does not invent obligations.
 */

import {
  classifyRequirementSemanticKind,
  deriveObligationStrength,
} from "@/domain/tender-requirements/semantic-kind";
import {
  extractLotApplicability,
  formatLotApplicability,
} from "@/domain/tender-requirements/lot-applicability";
import { isObligationBoundaryComplete } from "./boundary";
import { hasBidSecurityArtefact } from "./obligation-lexicon";
import { buildSemanticIdentity } from "./identity";
import {
  inferSectionRole,
  mapPackageDocumentRole,
} from "./document-context";
import { classifyDocumentPurpose } from "./document-purpose";
import { classifyProcurementPhase } from "./phase";
import { hasMixedLifecycleFrames } from "./mixed-clause";
import { detectTemplateStatus, isTemplateBlocked } from "./template";
import {
  evaluateCanonicalEntryGate,
  isBidderRelevantActor,
} from "./entry-gate";
import { resolveSemanticActor } from "./actor";
import { resolveRecipient, recipientIsBidderSide } from "./recipient";
import {
  analyzeConditionality,
  preserveConditionalRequirementText,
} from "./conditionality";
import { detectMetadataFact } from "./metadata";
import {
  classifyClausePurpose,
  purposeToClauseRole,
} from "./clause-purpose";
import { reunifyClauseFromContext } from "./context-window";
import {
  buildTableSemanticContext,
  enrichRequirementWithTableContext,
  isTableHeaderText,
  isTableResponseChrome,
  stripTableResponseChrome,
} from "./table-context";
import { analyzeVersionApplicability } from "./versioning";
import { fuseSemanticSituation } from "./semantic-situation";
import type {
  ClausePurpose,
  InterpretedSemanticStatement,
  SemanticClauseRole,
  SemanticDocumentRole,
  SemanticInterpretationContext,
  SemanticObligationStrength,
  SemanticProvenance,
  SemanticSectionRole,
  StructuredConditionality,
  TableSemanticContext,
  VersionSemanticContext,
} from "./types";
import type { RequirementSemanticKind } from "@/domain/tender-requirements/semantic-kind";

function purposeToSemanticKind(
  purpose: ClausePurpose,
  text: string,
  categoryHint?: string | null,
): RequirementSemanticKind {
  switch (purpose) {
    case "EVALUATION":
      return "EVALUATION_CRITERION";
    case "METADATA_FACT":
    case "INFORMATIONAL_FACT":
    case "HEADING":
    case "DEFINITION":
      return "INFORMATIONAL_FACT";
    case "Q_AND_A":
    case "CLARIFICATION":
    case "AMENDMENT":
      return "CLARIFICATION_PROCEDURAL";
    case "EXAMPLE":
      return "TEST_SCENARIO";
    case "ELIGIBILITY":
    case "QUALIFICATION":
      return "ELIGIBILITY_REQUIREMENT";
    case "TECHNICAL":
      return "TECHNICAL_REQUIREMENT";
    case "COMMERCIAL":
    case "FINANCIAL":
      return hasBidSecurityArtefact(text)
        ? "GUARANTEE_SECURITY_REQUIREMENT"
        : "FINANCIAL_COMMERCIAL_CONDITION";
    case "REQUIRED_DOCUMENT":
      return hasBidSecurityArtefact(text)
        ? "GUARANTEE_SECURITY_REQUIREMENT"
        : "REQUIRED_DOCUMENT";
    case "FORM_INSTRUCTION":
    case "PROCEDURAL_RULE":
    case "TEMPLATE":
      return "CLARIFICATION_PROCEDURAL";
    case "BIDDER_PROCEDURAL":
    case "SUBMISSION":
      return "ADMINISTRATIVE_REQUIREMENT";
    case "BUYER_OBLIGATION":
    case "LEGAL_RESERVATION":
      return "INFORMATIONAL_FACT";
    case "POST_AWARD_OBLIGATION":
      return "CONTRACTUAL_OBLIGATION";
    case "AWARD_STAGE_OBLIGATION":
      return hasBidSecurityArtefact(text)
        ? "GUARANTEE_SECURITY_REQUIREMENT"
        : "CONTRACTUAL_OBLIGATION";
    case "BIDDER_OBLIGATION":
    default: {
      // Secondary keyword map only after purpose — never drives actor/phase.
      const kind = classifyRequirementSemanticKind({
        description: text,
        existingCategory: categoryHint ?? null,
      });
      return kind;
    }
  }
}

function deriveStrength(input: {
  text: string;
  purpose: ClausePurpose;
  conditionality: StructuredConditionality;
  semanticKind: RequirementSemanticKind;
  bidderRelevant: boolean;
}): SemanticObligationStrength {
  if (
    input.purpose === "INFORMATIONAL_FACT" ||
    input.purpose === "METADATA_FACT" ||
    input.purpose === "HEADING" ||
    input.purpose === "DEFINITION" ||
    input.purpose === "EXAMPLE" ||
    input.purpose === "EVALUATION" ||
    input.purpose === "BUYER_OBLIGATION" ||
    input.purpose === "PROCEDURAL_RULE" ||
    input.purpose === "FORM_INSTRUCTION" ||
    input.purpose === "TEMPLATE" ||
    input.purpose === "Q_AND_A" ||
    input.purpose === "CLARIFICATION" ||
    input.purpose === "AMENDMENT" ||
    input.purpose === "LEGAL_RESERVATION"
  ) {
    return "INFORMATIONAL";
  }

  if (input.purpose === "BIDDER_PROCEDURAL" || input.purpose === "SUBMISSION") {
    if (input.conditionality.applicability === "OPTIONAL") return "OPTIONAL";
    if (
      input.conditionality.applicability === "CONDITIONAL" ||
      input.conditionality.applicability === "NEEDS_VERIFICATION"
    ) {
      return "CONDITIONAL";
    }
    return deriveObligationStrength(input.text, input.semanticKind);
  }

  if (input.conditionality.applicability === "OPTIONAL") return "OPTIONAL";
  if (
    input.conditionality.applicability === "CONDITIONAL" ||
    input.conditionality.applicability === "NEEDS_VERIFICATION"
  ) {
    return "CONDITIONAL";
  }

  if (!input.bidderRelevant) {
    return "UNKNOWN";
  }

  return deriveObligationStrength(input.text, input.semanticKind);
}

function computeBidderRelevance(input: {
  actor: ReturnType<typeof resolveSemanticActor>["actor"];
  recipient: ReturnType<typeof resolveRecipient>;
  purpose: ClausePurpose;
  phase: ReturnType<typeof classifyProcurementPhase>;
  templateStatus: ReturnType<typeof detectTemplateStatus>["status"];
  boundaryComplete: boolean;
  unattributedDocumentaryEvidence?: boolean;
  unattributedEligibilityEvidence?: boolean;
  unattributedCommercialEvidence?: boolean;
  unattributedImpersonalObligation?: boolean;
}): boolean {
  if (isTemplateBlocked(input.templateStatus)) return false;
  if (!input.boundaryComplete) return false;
  if (
    input.purpose === "BUYER_OBLIGATION" ||
    input.purpose === "POST_AWARD_OBLIGATION" ||
    input.purpose === "PROCEDURAL_RULE" ||
    input.purpose === "FORM_INSTRUCTION" ||
    input.purpose === "TEMPLATE" ||
    input.purpose === "INFORMATIONAL_FACT" ||
    input.purpose === "METADATA_FACT" ||
    input.purpose === "EVALUATION" ||
    input.purpose === "Q_AND_A" ||
    input.purpose === "CLARIFICATION" ||
    input.purpose === "AMENDMENT" ||
    input.purpose === "LEGAL_RESERVATION" ||
    input.purpose === "DEFINITION" ||
    input.purpose === "HEADING" ||
    input.purpose === "EXAMPLE"
  ) {
    return false;
  }

  // Manufacturer / subcontractor alone are not bidder requirements.
  if (input.actor === "MANUFACTURER" || input.actor === "SUBCONTRACTOR") {
    return false;
  }
  if (input.actor === "CONTRACTOR") return false;
  if (input.actor === "IMPERSONAL" && !input.unattributedImpersonalObligation) {
    return false;
  }

  // Successful bidder is relevant only for award-stage duties.
  if (input.actor === "SUCCESSFUL_BIDDER") {
    return input.purpose === "AWARD_STAGE_OBLIGATION";
  }

  const actorOk =
    isBidderRelevantActor(input.actor) ||
    (input.actor === "UNKNOWN" &&
      input.unattributedDocumentaryEvidence === true &&
      input.purpose === "REQUIRED_DOCUMENT") ||
    (input.actor === "UNKNOWN" &&
      input.unattributedEligibilityEvidence === true &&
      (input.purpose === "ELIGIBILITY" || input.purpose === "QUALIFICATION")) ||
    ((input.actor === "UNKNOWN" || input.actor === "IMPERSONAL") &&
      input.unattributedCommercialEvidence === true &&
      (input.purpose === "COMMERCIAL" || input.purpose === "FINANCIAL")) ||
    (input.actor === "UNKNOWN" &&
      recipientIsBidderSide(input.recipient) &&
      (input.purpose === "ELIGIBILITY" ||
        input.purpose === "REQUIRED_DOCUMENT" ||
        input.purpose === "TECHNICAL" ||
        input.purpose === "COMMERCIAL" ||
        input.purpose === "BIDDER_OBLIGATION" ||
        input.purpose === "QUALIFICATION" ||
        input.purpose === "AWARD_STAGE_OBLIGATION")) ||
    (input.actor === "IMPERSONAL" && input.unattributedImpersonalObligation === true);

  const recipientOk =
    recipientIsBidderSide(input.recipient) ||
    (input.recipient === "UNKNOWN" && actorOk);

  return Boolean(actorOk && recipientOk);
}

function categoryForKind(kind: SemanticClauseRole): string {
  switch (kind) {
    case "ELIGIBILITY_CONDITION":
    case "QUALIFICATION_REQUIREMENT":
      return "MANDATORY_ELIGIBILITY";
    case "TECHNICAL_REQUIREMENT":
      return "MANDATORY_TECHNICAL";
    case "REQUIRED_SUBMISSION_DOCUMENT":
      return "MANDATORY_ADMINISTRATIVE";
    case "COMMERCIAL_REQUIREMENT":
    case "FINANCIAL_REQUIREMENT":
    case "DELIVERY_REQUIREMENT":
    case "PERFORMANCE_REQUIREMENT":
    case "AWARD_STAGE_OBLIGATION":
    case "BIDDER_REQUIREMENT":
    case "BIDDER_PROCEDURAL_REQUIREMENT":
    case "SUBMISSION_INSTRUCTION":
      return "CONTRACTUAL";
    default:
      return "CONTRACTUAL";
  }
}

/**
 * Interpret one statement — full semantic order before any canonical decision.
 */
export function interpretSemanticStatement(input: {
  text: string;
  categoryHint?: string | null;
  provenance?: Partial<SemanticProvenance>;
  context?: SemanticInterpretationContext | null;
}): InterpretedSemanticStatement {
  const provenance: SemanticProvenance = {
    sourceDocument: input.provenance?.sourceDocument ?? null,
    sourcePage: input.provenance?.sourcePage ?? null,
    sourceSection: input.provenance?.sourceSection ?? null,
    sourceCell: input.provenance?.sourceCell ?? null,
    versionLabel: input.provenance?.versionLabel ?? null,
    locator: input.provenance?.locator ?? null,
    completeness: input.provenance?.completeness ?? null,
  };

  // 1–2. DOCUMENT → DOCUMENT ROLE
  const documentRole: SemanticDocumentRole =
    input.context?.documentRole ??
    mapPackageDocumentRole(input.context?.packageDocumentRole) ??
    "UNKNOWN";

  // 3. SECTION ROLE
  const sectionRole: SemanticSectionRole =
    input.context?.sectionRole ??
    inferSectionRole(
      input.context?.sectionLabel ?? provenance.sourceSection,
      documentRole,
    );

  const initialText = input.text.replace(/\s+/g, " ").trim();
  if (!initialText) {
    return emptyInterpretation(initialText, provenance, documentRole, sectionRole, {
      exclusionCode: "EMPTY_TEXT",
      exclusionReason: "empty_text",
    });
  }

  // Multi-paragraph / page-span reunification BEFORE classification
  const reunified = reunifyClauseFromContext({
    text: initialText,
    precedingText: input.context?.precedingText,
    followingText: input.context?.followingText,
  });
  const rawClauseText = reunified.reunifiedText;
  let workingText = stripTableResponseChrome(rawClauseText);

  // Table context — detect headers on the pre-strip surface (pipes/tabs intact).
  const tableContext: TableSemanticContext =
    input.context?.table ??
    buildTableSemanticContext({
      text: rawClauseText,
      sourceCell: provenance.sourceCell,
      isHeader:
        isTableHeaderText(rawClauseText) ||
        isTableHeaderText(workingText) ||
        isTableResponseChrome(rawClauseText),
    });
  if (!tableContext.isTableHeader && !isTableResponseChrome(workingText)) {
    workingText = enrichRequirementWithTableContext(workingText, tableContext);
  }

  // Version / amendment context
  const versionContext: VersionSemanticContext =
    input.context?.version ??
    analyzeVersionApplicability({
      text: workingText,
      documentRole,
      versionLabel: provenance.versionLabel,
    });

  // 4. CLAUSE BOUNDARY (after reunification)
  const boundaryComplete = isObligationBoundaryComplete(workingText);

  // Metadata detection (never a requirement)
  const metadata = detectMetadataFact(workingText);

  // 5. ACTOR (grammar — one independent signal, not the whole truth)
  const actorResolved = resolveSemanticActor(workingText);
  const actorDraft = actorResolved.actor;

  // 6. RECIPIENT / TARGET
  const recipientDraft = resolveRecipient({ text: workingText, actor: actorDraft });

  // 7. PROCUREMENT PHASE (candidate — fused below with temporal/action)
  let candidatePhase = classifyProcurementPhase({
    text: workingText,
    actor: actorDraft,
    documentRole,
    sectionRole,
  });

  if (hasMixedLifecycleFrames(workingText)) {
    candidatePhase = "MIXED_OR_AMBIGUOUS";
  }

  const template = detectTemplateStatus(workingText);

  // 8. CLAUSE PURPOSE (candidate — section/document are supporting only)
  const candidatePurpose = classifyClausePurpose({
    text: workingText,
    documentRole,
    sectionRole,
    actor: actorDraft,
    recipient: recipientDraft,
    phase: candidatePhase,
    templateStatus: template.status,
    isMetadata: metadata.isMetadata,
    boundaryComplete,
  });

  // Independent signals cooperate; conflicts preserve uncertainty.
  const situation = fuseSemanticSituation({
    text: workingText,
    actor: actorDraft,
    recipient: recipientDraft,
    candidatePhase,
    candidatePurpose,
    documentRole,
    sectionRole,
    templateStatus: template.status,
    isMetadata: metadata.isMetadata,
    boundaryComplete,
    isBidderRequirementHint: actorResolved.isBidderRequirementHint,
  });

  const actor = situation.actor;
  const recipient = situation.recipient;
  const procurementPhase = situation.phase;
  const purpose = situation.purpose;

  // 9. CONDITIONALITY — preserve IF/WHEN/UNLESS/PROVIDED THAT → action
  const conditionality = analyzeConditionality(workingText);
  const requirementText = preserveConditionalRequirementText(
    workingText,
    conditionality,
  );

  const clauseRole = purposeToClauseRole(purpose, template.status);

  const unattributedDocumentaryEvidence =
    situation.snapshot.unattributedDocumentaryEvidence === true;
  const unattributedEligibilityEvidence =
    situation.snapshot.unattributedEligibilityEvidence === true;
  const unattributedCommercialEvidence =
    situation.snapshot.unattributedCommercialEvidence === true;
  const unattributedImpersonalObligation =
    situation.snapshot.unattributedImpersonalObligation === true;

  const documentPurpose = classifyDocumentPurpose({
    text: requirementText,
    documentRole,
    sectionRole,
  });

  const bidderRelevant = computeBidderRelevance({
    actor,
    recipient,
    purpose,
    phase: procurementPhase,
    templateStatus: template.status,
    boundaryComplete,
    unattributedDocumentaryEvidence,
    unattributedEligibilityEvidence,
    unattributedCommercialEvidence,
    unattributedImpersonalObligation,
  });

  const semanticKind = purposeToSemanticKind(
    purpose,
    requirementText,
    input.categoryHint,
  );

  const strength = deriveStrength({
    text: requirementText,
    purpose,
    conditionality,
    semanticKind,
    bidderRelevant,
  });

  let lotApplicability = extractLotApplicability(
    requirementText,
    provenance.sourceSection,
  );
  if (tableContext.lotNumber && lotApplicability.kind === "UNSPECIFIED") {
    lotApplicability = { kind: "LOTS", lots: [tableContext.lotNumber] };
  }
  const lotLabel = formatLotApplicability(lotApplicability);

  const semanticIdentity = buildSemanticIdentity({
    text: requirementText,
    actor,
    contentKind: clauseRole,
    lotLabel,
    conditionText: conditionality.conditionText,
    procurementPhase,
  });

  let confidence = 0.4;
  if (isBidderRelevantActor(actor)) confidence += 0.2;
  if (recipientIsBidderSide(recipient)) confidence += 0.1;
  if (boundaryComplete) confidence += 0.1;
  if (provenance.sourceDocument) confidence += 0.05;
  if (conditionality.conditionText && conditionality.actionText) confidence += 0.1;
  if (reunified.reconstructedFromContext) confidence += 0.05;
  if (!boundaryComplete) confidence -= 0.25;
  if (actor === "UNKNOWN") confidence -= 0.1;
  if (template.status !== "NOT_TEMPLATE") confidence += 0.05;
  if (situation.snapshot.uncertaintyPreserved) confidence -= 0.2;
  if (situation.snapshot.agreeingSignals >= 3) confidence += 0.05;
  confidence = Math.max(0.05, Math.min(0.98, confidence));

  const gate = evaluateCanonicalEntryGate({
    clauseRole,
    actor,
    procurementPhase,
    applicability: conditionality.applicability,
    templateStatus: template.status,
    boundaryComplete,
    bidderRelevant,
    hasProvenance: Boolean(provenance.sourceDocument),
    conditionalUnresolved: conditionality.unresolved,
    isTableHeader: tableContext.isTableHeader,
    orphanConditionUnresolved: reunified.orphanConditionUnresolved,
    versionContext,
    situationUncertainty: situation.snapshot.admissionBlockedByUncertainty,
    unattributedDocumentaryEvidence,
    unattributedEligibilityEvidence,
    unattributedCommercialEvidence,
    unattributedImpersonalObligation,
    documentPurpose,
  });

  return {
    version: "semantic-tender-intelligence/v3",
    requirementText,
    documentRole,
    documentPurpose,
    sectionRole,
    clauseRole,
    contentKind: clauseRole,
    clausePurpose: purpose,
    actor,
    recipient,
    obligationActorKind: actorResolved.obligationActorKind,
    procurementPhase,
    applicability: conditionality.applicability,
    templateStatus: template.status,
    bidderRelevant,
    semanticKind,
    obligationStrength: strength,
    conditionText: conditionality.conditionText,
    conditional:
      conditionality.applicability === "CONDITIONAL" ||
      conditionality.applicability === "NEEDS_VERIFICATION",
    conditionality,
    lotApplicability,
    lotLabel,
    boundaryComplete,
    reconstructedFromContext: reunified.reconstructedFromContext,
    tableContext,
    versionContext,
    provenance,
    provenanceLinks: [provenance],
    semanticIdentity,
    confidence,
    situation: situation.snapshot,
    admitToCanonical: gate.admit,
    exclusionReason: gate.exclusionReason,
    exclusionCode: gate.exclusionCode,
  };
}

function emptyInterpretation(
  text: string,
  provenance: SemanticProvenance,
  documentRole: SemanticDocumentRole,
  sectionRole: SemanticSectionRole,
  exclusion: {
    exclusionCode: InterpretedSemanticStatement["exclusionCode"];
    exclusionReason: string;
  },
): InterpretedSemanticStatement {
  const emptyCond: StructuredConditionality = {
    applicability: "UNKNOWN",
    conditionText: null,
    actionText: null,
    thresholdText: null,
    exceptionText: null,
    timeframeText: null,
    scopeText: null,
    unresolved: false,
  };
  return {
    version: "semantic-tender-intelligence/v3",
    requirementText: text,
    documentRole,
    documentPurpose: "UNKNOWN",
    sectionRole,
    clauseRole: "UNKNOWN",
    contentKind: "UNKNOWN",
    clausePurpose: "UNKNOWN",
    actor: "UNKNOWN",
    recipient: "UNKNOWN",
    obligationActorKind: "UNATTRIBUTED",
    procurementPhase: "UNKNOWN",
    applicability: "UNKNOWN",
    templateStatus: "NOT_TEMPLATE",
    bidderRelevant: false,
    semanticKind: "UNKNOWN",
    obligationStrength: "UNKNOWN",
    conditionText: null,
    conditional: false,
    conditionality: emptyCond,
    lotApplicability: { kind: "UNSPECIFIED" },
    lotLabel: null,
    boundaryComplete: false,
    reconstructedFromContext: false,
    tableContext: null,
    versionContext: null,
    provenance,
    provenanceLinks: [provenance],
    semanticIdentity: "empty",
    confidence: 0,
    situation: null,
    admitToCanonical: false,
    exclusionReason: exclusion.exclusionReason,
    exclusionCode: exclusion.exclusionCode,
  };
}

export { categoryForKind };
