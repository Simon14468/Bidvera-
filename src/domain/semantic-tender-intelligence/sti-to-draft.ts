/**
 * Map STI-approved candidates into drafts for normalize (formatting / dedupe only).
 * Carries sealed semantic fields so normalize must not re-interpret actor/phase/role.
 */

import type { RequirementDraftLike } from "@/domain/tender-requirements/normalize";
import type { ObligationStrength } from "@/domain/tender-requirements/semantic-kind";
import type {
  CanonicalSemanticCandidate,
  ClausePurpose,
  SemanticRecipient,
  StructuredConditionality,
  SemanticProvenance,
} from "./types";
import type { StiApprovedRequirementBatch } from "./sti-seal";

export type StiSemanticDraftFields = {
  actor: string;
  recipient: SemanticRecipient;
  clauseRole: string;
  clausePurpose: ClausePurpose;
  contentKind: string;
  documentRole?: string | null;
  sectionRole?: string | null;
  procurementPhase: string;
  semanticKind: CanonicalSemanticCandidate["semanticKind"];
  obligationStrength: ObligationStrength | "UNKNOWN";
  conditionText: string | null;
  conditionality: StructuredConditionality;
  applicability: string;
  templateStatus: string;
  confidence: number;
  lotApplicability: string | null;
  provenance: SemanticProvenance[];
  bidderRelevant: true;
  situation: {
    uncertaintyPreserved: boolean;
    admissionBlockedByUncertainty: boolean;
    unattributedDocumentaryEvidence: boolean;
    unattributedEligibilityEvidence: boolean;
    unattributedCommercialEvidence: boolean;
    unattributedImpersonalObligation: boolean;
    explanation: string;
  } | null;
};

export type StiEnrichedRequirementDraft = RequirementDraftLike & {
  sti: StiSemanticDraftFields;
};

export function stiApprovedBatchToDrafts(
  batch: StiApprovedRequirementBatch,
): StiEnrichedRequirementDraft[] {
  return batch.items.map((c) => {
    const strength =
      c.obligationStrength === "UNKNOWN"
        ? c.draft.mandatory
          ? ("MANDATORY" as const)
          : ("CONDITIONAL" as const)
        : c.obligationStrength;
    return {
      category: c.draft.category,
      description: c.draft.description,
      mandatory: c.draft.mandatory,
      sourcePage: c.draft.sourcePage,
      sourceSection: c.draft.sourceSection,
      sourceCell: c.draft.sourceCell ?? c.provenance[0]?.sourceCell ?? null,
      columnHeader: c.draft.columnHeader ?? c.tableContext?.columnHeader ?? null,
      rowLabel: c.draft.rowLabel ?? c.tableContext?.rowLabel ?? null,
      versionLabel: c.draft.versionLabel ?? c.provenance[0]?.versionLabel ?? null,
      locator: c.draft.locator ?? c.provenance[0]?.locator ?? null,
      sourceCompleteness: c.draft.sourceCompleteness ?? null,
      evidenceText: c.draft.evidenceText,
      sourceDocument: c.draft.sourceDocument ?? c.provenance[0]?.sourceDocument ?? null,
      verificationStatus: "UNKNOWN" as const,
      sti: {
        actor: c.actor,
        recipient: c.recipient,
        clauseRole: c.clauseRole,
        clausePurpose: c.clausePurpose,
        contentKind: c.contentKind,
        documentRole: c.documentRole,
        sectionRole: c.sectionRole,
        procurementPhase: c.procurementPhase,
        semanticKind: c.semanticKind,
        obligationStrength: strength,
        conditionText: c.condition,
        conditionality: c.conditionality,
        applicability: c.applicability,
        templateStatus: c.templateStatus,
        confidence: c.confidence,
        lotApplicability: c.lotApplicability,
        provenance: c.provenance,
        bidderRelevant: true as const,
        situation: c.situation
          ? {
              uncertaintyPreserved: c.situation.uncertaintyPreserved,
              admissionBlockedByUncertainty: c.situation.admissionBlockedByUncertainty,
              unattributedDocumentaryEvidence:
                c.situation.unattributedDocumentaryEvidence,
              unattributedEligibilityEvidence:
                c.situation.unattributedEligibilityEvidence,
              unattributedCommercialEvidence:
                c.situation.unattributedCommercialEvidence,
              unattributedImpersonalObligation:
                c.situation.unattributedImpersonalObligation === true,
              explanation: c.situation.explanation,
            }
          : null,
      },
    };
  });
}
