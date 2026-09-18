/**
 * Normalize STI-approved (or legacy test) drafts into the canonical requirement shape.
 *
 * When `trustStiSemantics` / draft.sti is present:
 *   — does NOT re-decide actor, phase, clause role, template, or applicability
 *   — formats, stabilizes IDs, dedupes, validates fields only
 *
 * Legacy drafts without STI (unit tests of filters) keep safety drops.
 */

import {
  isMandatoryCategory,
  titleFromRequirement,
} from "./classify";
import { isNonRequirementText } from "./filter-non-requirements";
import { isRealBidderObligation } from "./obligation";
import { attributeObligationActor } from "./obligation-actor";
import {
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  isScoringSemanticKind,
  obligationStrengthToMandatory,
  type ObligationStrength,
  type RequirementSemanticKind,
} from "./semantic-kind";
import {
  categoryFromSealedSemantics,
  inferDomainCategoryFromText,
  resolveCompatibleCategory,
} from "./semantic-compatibility";
import {
  mergeNormalizedRequirements,
  obligationFingerprint,
} from "./semantic-dedupe";
import { extractRequirementRef } from "./requirement-ref";
import {
  encodeLotIntoSourceSection,
  extractLotApplicability,
  formatLotApplicability,
} from "./lot-applicability";
import type {
  NormalizedRequirement,
  RequirementCategory,
  RequirementConfidence,
} from "./types";
import { isScoringCategory } from "./types";

export type StiDraftSemantics = {
  actor: string;
  recipient?: string | null;
  clauseRole: string;
  clausePurpose?: string | null;
  contentKind?: string;
  documentRole?: string | null;
  sectionRole?: string | null;
  procurementPhase: string;
  semanticKind: RequirementSemanticKind;
  obligationStrength: ObligationStrength | "UNKNOWN";
  conditionText: string | null;
  conditionality?: {
    applicability: string;
    conditionText: string | null;
    actionText: string | null;
    thresholdText: string | null;
    exceptionText: string | null;
    timeframeText: string | null;
    scopeText: string | null;
    unresolved: boolean;
  } | null;
  applicability: string;
  templateStatus: string;
  confidence: number;
  lotApplicability?: string | null;
  provenance?: Array<{
    sourceDocument: string | null;
    sourcePage: number | null;
    sourceSection: string | null;
    sourceCell: string | null;
    versionLabel: string | null;
    locator?: string | null;
  }> | null;
  bidderRelevant?: boolean;
  situation?: {
    uncertaintyPreserved: boolean;
    admissionBlockedByUncertainty: boolean;
    unattributedDocumentaryEvidence: boolean;
    unattributedEligibilityEvidence: boolean;
    unattributedCommercialEvidence: boolean;
    unattributedImpersonalObligation?: boolean;
    explanation: string;
  } | null;
};

export type RequirementDraftLike = {
  category: string;
  description: string;
  mandatory: boolean;
  value?: string | null;
  sourcePage?: number | null;
  sourceSection?: string | null;
  sourceCell?: string | null;
  columnHeader?: string | null;
  rowLabel?: string | null;
  versionLabel?: string | null;
  locator?: string | null;
  sourceCompleteness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
  evidenceText?: string | null;
  verificationStatus?: "UNKNOWN" | "VERIFIED" | "INFERRED";
  sourceDocument?: string | null;
  /** STI sealed semantics — when present, normalize must not reinterpret meaning. */
  sti?: StiDraftSemantics;
};

function deriveConfidence(input: {
  requirement: string;
  category: RequirementCategory;
  evidenceText: string | null;
  page: number | null;
  mandatory: boolean;
  stiConfidence?: number | null;
}): RequirementConfidence {
  if (input.stiConfidence != null) {
    if (input.stiConfidence >= 0.85) return "HIGH";
    if (input.stiConfidence >= 0.65) return "MEDIUM";
    if (input.stiConfidence >= 0.45) return "LOW";
    return "UNCERTAIN";
  }
  const hasEvidence = Boolean(input.evidenceText?.trim());
  const hasPage = input.page != null && input.page >= 1;
  const clearObligation = isRealBidderObligation(input.requirement);

  if (!clearObligation) return "UNCERTAIN";
  if (hasEvidence && hasPage && input.mandatory) return "HIGH";
  if (hasEvidence && clearObligation) return "MEDIUM";
  if (clearObligation && input.mandatory) return "MEDIUM";
  return "LOW";
}

/**
 * Normalize drafts into the canonical requirement shape.
 * Never invents requirements; merges semantically duplicate obligations.
 */
export function normalizeRequirements(
  drafts: RequirementDraftLike[],
  opts?: {
    includeInformational?: boolean;
    sourceDocument?: string | null;
    /** When true, drafts without sti are rejected (production STI path). */
    trustStiSemantics?: boolean;
  },
): NormalizedRequirement[] {
  const includeInformational = opts?.includeInformational ?? false;
  const trustSti = opts?.trustStiSemantics === true;
  const candidates: NormalizedRequirement[] = [];
  const seenExact = new Set<string>();

  for (const draft of drafts) {
    const requirement = draft.description.replace(/\s+/g, " ").trim();
    if (requirement.length < 12) continue;

    const sti = draft.sti;
    if (trustSti && !sti) continue;

    let semanticKind: RequirementSemanticKind;
    let obligationStrength: ObligationStrength;

    if (sti) {
      // STI already decided meaning — formatting / ID / dedupe only.
      // Never drop STI-admitted rows via scoring/informational reinterpretation.
      semanticKind = sti.semanticKind;
      obligationStrength =
        sti.obligationStrength === "UNKNOWN"
          ? "INFORMATIONAL"
          : sti.obligationStrength;
    } else {
      // Legacy safety path for normalize unit tests only.
      if (isNonRequirementText(requirement)) continue;
      const actor = attributeObligationActor(requirement);
      if (
        actor.actor === "AUTHORITY_SIDE" ||
        actor.actor === "DOCUMENT_PROCEDURE" ||
        actor.actor === "CLARIFICATION_CONTEXT"
      ) {
        continue;
      }
      if (!isRealBidderObligation(requirement)) continue;

      semanticKind = classifyRequirementSemanticKind({
        description: requirement,
        existingCategory: draft.category,
        mandatoryHint: draft.mandatory,
      });
      obligationStrength = deriveObligationStrength(requirement, semanticKind);

      if (!includeInformational && !isScoringSemanticKind(semanticKind)) {
        continue;
      }

      if (
        !includeInformational &&
        obligationStrength === "INFORMATIONAL" &&
        semanticKind !== "UNKNOWN"
      ) {
        continue;
      }
    }

    const resolvedCategory = sti
      ? categoryFromSealedSemantics({
          semanticKind,
          preferredCategory: draft.category,
        })
      : resolveCompatibleCategory({
          semanticKind,
          preferredCategory: draft.category || inferDomainCategoryFromText(requirement),
          obligationStrength,
          description: requirement,
        });

    const exactKey = `${semanticKind}|${requirement.toLowerCase()}|${draft.value ?? ""}`;
    if (seenExact.has(exactKey)) continue;
    seenExact.add(exactKey);

    const mandatory = sti
      ? draft.mandatory
      : semanticKind === "UNKNOWN"
        ? false
        : resolvedCategory === "PREFERRED" || resolvedCategory === "EVALUATION"
          ? false
          : obligationStrength === "CONDITIONAL" ||
              obligationStrength === "OPTIONAL" ||
              obligationStrength === "INFORMATIONAL"
            ? false
            : obligationStrengthToMandatory(obligationStrength) ||
              (isMandatoryCategory(resolvedCategory) &&
                obligationStrength === "MANDATORY");

    const evidenceText = draft.evidenceText ?? null;
    const page = draft.sourcePage ?? null;
    const requirementRef = extractRequirementRef(requirement);

    const lot = sti?.lotApplicability
      ? extractLotApplicability(requirement, draft.sourceSection)
      : extractLotApplicability(requirement, draft.sourceSection);
    const lotLabel =
      sti?.lotApplicability ?? formatLotApplicability(lot);

    const sectionLabel = encodeLotIntoSourceSection(
      draft.sourceSection?.trim() ||
        (requirementRef ? `Requirement ${requirementRef}` : null),
      // Prefer STI lot label encoding; re-parse only for section token shape.
      lot,
    );

    const title =
      sectionLabel && sectionLabel.length < 120
        ? sectionLabel
        : titleFromRequirement(requirement, resolvedCategory);

    const confidence =
      semanticKind === "UNKNOWN"
        ? ("UNCERTAIN" as const)
        : deriveConfidence({
            requirement,
            category: resolvedCategory,
            evidenceText,
            page,
            mandatory,
            stiConfidence: sti?.confidence ?? null,
          });

    candidates.push({
      id: requirementRef ?? undefined,
      category: resolvedCategory,
      semanticKind,
      obligationStrength,
      title,
      requirement,
      mandatory,
      confidence,
      value: draft.value ?? null,
      page,
      sourcePages: page != null ? [page] : [],
      sourceSection: sectionLabel,
      sourceCell: draft.sourceCell ?? sti?.provenance?.[0]?.sourceCell ?? null,
      columnHeader: draft.columnHeader ?? null,
      rowLabel: draft.rowLabel ?? null,
      versionLabel: draft.versionLabel ?? sti?.provenance?.[0]?.versionLabel ?? null,
      locator: draft.locator ?? sti?.provenance?.[0]?.locator ?? null,
      sourceCompleteness: draft.sourceCompleteness ?? null,
      lotApplicability: lotLabel,
      evidenceText,
      sourceDocument: draft.sourceDocument ?? opts?.sourceDocument ?? null,
      verificationStatus: draft.verificationStatus ?? "UNKNOWN",
      verificationReason: null,
      evidence: evidenceText,
      stiActor: sti?.actor ?? null,
      stiRecipient: sti?.recipient ?? null,
      stiClauseRole: sti?.clauseRole ?? null,
      stiClausePurpose: sti?.clausePurpose ?? null,
      stiDocumentRole: sti?.documentRole ?? null,
      stiSectionRole: sti?.sectionRole ?? null,
      stiProcurementPhase: sti?.procurementPhase ?? null,
      stiApplicability: sti?.applicability ?? null,
      stiTemplateStatus: sti?.templateStatus ?? null,
      stiConditionText: sti?.conditionText ?? null,
      stiConditionality: sti?.conditionality
        ? {
            applicability: sti.conditionality.applicability,
            conditionText: sti.conditionality.conditionText,
            actionText: sti.conditionality.actionText,
            thresholdText: sti.conditionality.thresholdText,
            exceptionText: sti.conditionality.exceptionText,
            timeframeText: sti.conditionality.timeframeText,
            scopeText: sti.conditionality.scopeText,
            unresolved: sti.conditionality.unresolved,
          }
        : null,
      stiConfidence: sti?.confidence ?? null,
      stiProvenance: sti?.provenance ?? null,
      stiSituation: sti?.situation ?? null,
    });
  }

  return mergeNormalizedRequirements(candidates);
}

/** Requirements that influence Fit / Bid Score. */
export function scoringRequirements<T extends { category: string }>(items: T[]): T[] {
  return items.filter((r) => isScoringCategory(r.category));
}

export function toHeuristicDraft(n: NormalizedRequirement): RequirementDraftLike & {
  category: RequirementCategory;
  description: string;
} {
  return {
    category: n.category,
    description: n.requirement,
    mandatory: n.mandatory,
    value: n.value ?? null,
    sourcePage: n.page ?? null,
    sourceSection: n.sourceSection ?? null,
    sourceCell: n.sourceCell ?? null,
    columnHeader: n.columnHeader ?? null,
    rowLabel: n.rowLabel ?? null,
    versionLabel: n.versionLabel ?? null,
    locator: n.locator ?? null,
    sourceCompleteness: n.sourceCompleteness ?? null,
    evidenceText: n.evidenceText ?? null,
    verificationStatus: n.verificationStatus ?? "UNKNOWN",
    sourceDocument: n.sourceDocument ?? null,
    ...(n.stiActor && n.stiProcurementPhase && n.stiClauseRole && n.stiClausePurpose
      ? {
          sti: {
            actor: n.stiActor,
            recipient: n.stiRecipient ?? "BIDDER",
            clauseRole: n.stiClauseRole,
            clausePurpose: n.stiClausePurpose,
            procurementPhase: n.stiProcurementPhase,
            semanticKind: n.semanticKind,
            obligationStrength: n.obligationStrength,
            conditionText: n.stiConditionText ?? null,
            conditionality: n.stiConditionality ?? null,
            applicability: n.stiApplicability ?? "UNCONDITIONAL",
            templateStatus: n.stiTemplateStatus ?? "NOT_TEMPLATE",
            confidence: n.stiConfidence ?? 0.7,
            documentRole: n.stiDocumentRole,
            sectionRole: n.stiSectionRole,
            lotApplicability: n.lotApplicability ?? null,
            provenance: n.stiProvenance ?? null,
            bidderRelevant: true,
          },
        }
      : {}),
  };
}

export { obligationFingerprint, mergeNormalizedRequirements };
