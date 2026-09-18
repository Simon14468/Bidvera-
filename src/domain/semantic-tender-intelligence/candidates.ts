/**
 * Build canonical semantic candidates — only after semantic validation.
 * Cross-document duplicates collapse by semantic identity with provenance links.
 * Metadata facts are returned separately and never mixed into candidates.
 */

import { createHash } from "node:crypto";
import {
  encodeLotIntoSourceSection,
  mergeLotApplicability,
} from "@/domain/tender-requirements/lot-applicability";
import { isStructuralHeading } from "@/domain/tender-requirements/filter-non-requirements";
import { isObligationBoundaryComplete } from "./boundary";
import { categoryForKind, interpretSemanticStatement } from "./interpret";
import { buildTableSemanticContext } from "./table-context";
import { detectMetadataFact } from "./metadata";
import type {
  CanonicalSemanticCandidate,
  InterpretedSemanticStatement,
  SemanticInterpretationContext,
  SemanticMetadataFact,
  SemanticProvenance,
} from "./types";

export type SemanticDraftInput = {
  requirement?: string | null;
  description?: string | null;
  category?: string | null;
  mandatory?: boolean;
  sourceDocument?: string | null;
  pageNumber?: number | null;
  sourcePage?: number | null;
  section?: string | null;
  sourceSection?: string | null;
  evidence?: string | null;
  evidenceText?: string | null;
  sourceCell?: string | null;
  versionLabel?: string | null;
  locator?: string | null;
  /** Package / UTI document role when known. */
  documentRole?: string | null;
  packageDocumentRole?: string | null;
  precedingText?: string | null;
  followingText?: string | null;
  columnHeader?: string | null;
  rowLabel?: string | null;
  isTableHeader?: boolean;
  sourceCompleteness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
};

/**
 * Interpret drafts, admit only after full semantic entry gate,
 * merge same semantic identity across documents (provenance links preserved).
 * Metadata remains a separate semantic output.
 */
export function buildCanonicalSemanticCandidates(
  drafts: SemanticDraftInput[],
  opts?: {
    packageLabel?: string | null;
    context?: SemanticInterpretationContext | null;
  },
): {
  candidates: CanonicalSemanticCandidate[];
  rejected: InterpretedSemanticStatement[];
  interpreted: InterpretedSemanticStatement[];
  metadata: SemanticMetadataFact[];
} {
  const interpreted: InterpretedSemanticStatement[] = [];
  const rejected: InterpretedSemanticStatement[] = [];
  const metadata: SemanticMetadataFact[] = [];
  const byIdentity = new Map<string, InterpretedSemanticStatement>();

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]!;
    const text = (d.requirement ?? d.description ?? "").replace(/\s+/g, " ").trim();
    const provenance: SemanticProvenance = {
      sourceDocument: d.sourceDocument ?? opts?.packageLabel ?? null,
      sourcePage: d.pageNumber ?? d.sourcePage ?? null,
      sourceSection: d.section ?? d.sourceSection ?? null,
      sourceCell: d.sourceCell ?? null,
      versionLabel: d.versionLabel ?? null,
      locator: d.locator ?? null,
      completeness: d.sourceCompleteness ?? null,
    };

    const table =
      d.columnHeader || d.rowLabel || d.isTableHeader || d.sourceCell
        ? buildTableSemanticContext({
            text,
            columnHeader: d.columnHeader,
            rowLabel: d.rowLabel,
            sourceCell: d.sourceCell,
            isHeader: d.isTableHeader,
          })
        : opts?.context?.table ?? null;

    const neighbor = neighborContext(drafts, i);

    const context: SemanticInterpretationContext = {
      ...opts?.context,
      packageDocumentRole:
        d.packageDocumentRole ??
        d.documentRole ??
        opts?.context?.packageDocumentRole ??
        null,
      sectionLabel:
        opts?.context?.sectionLabel ??
        d.section ??
        d.sourceSection ??
        neighbor.sectionLabel ??
        null,
      precedingText:
        d.precedingText ?? opts?.context?.precedingText ?? neighbor.precedingText,
      followingText:
        d.followingText ?? opts?.context?.followingText ?? neighbor.followingText,
      table: table ?? opts?.context?.table ?? null,
    };

    let stmt: InterpretedSemanticStatement;
    try {
      stmt = interpretSemanticStatement({
        text,
        categoryHint: d.category ?? null,
        provenance,
        context,
      });
    } catch {
      stmt = failedInterpretation(text, provenance);
    }
    interpreted.push(stmt);

    // Metadata side-channel — never admit as requirement.
    const metaDetect = detectMetadataFact(text);
    if (
      metaDetect.isMetadata ||
      stmt.clausePurpose === "METADATA_FACT" ||
      stmt.clauseRole === "METADATA_FACT" ||
      stmt.exclusionCode === "EXCLUDED_METADATA_FACT"
    ) {
      metadata.push({
        field: metaDetect.field ?? "other",
        text: stmt.requirementText,
        documentRole: stmt.documentRole,
        provenance: stmt.provenance,
        exclusionCode: "EXCLUDED_METADATA_FACT",
      });
    }

    // No silent drops — rejected always retain exclusionCode.
    if (!stmt.admitToCanonical) {
      rejected.push(
        stmt.exclusionCode
          ? stmt
          : {
              ...stmt,
              exclusionCode: "NOT_ADMITTED",
              exclusionReason: stmt.exclusionReason ?? "not_admitted",
            },
      );
      continue;
    }

    if (!stmt.provenance.sourceDocument) {
      rejected.push({
        ...stmt,
        admitToCanonical: false,
        exclusionReason: "missing_provenance",
        exclusionCode: "EXCLUDED_MISSING_PROVENANCE",
      });
      continue;
    }

    const existing = byIdentity.get(stmt.semanticIdentity);
    if (!existing) {
      byIdentity.set(stmt.semanticIdentity, {
        ...stmt,
        provenanceLinks: [stmt.provenance],
      });
      continue;
    }

    const links = [...existing.provenanceLinks];
    const provenanceKey = (p: SemanticProvenance) =>
      [
        p.sourceDocument,
        p.sourcePage,
        p.sourceSection,
        p.sourceCell ?? "",
        p.versionLabel ?? "",
      ].join(":");
    if (!links.some((p) => provenanceKey(p) === provenanceKey(stmt.provenance))) {
      links.push(stmt.provenance);
    }
    const preferLonger =
      stmt.requirementText.length > existing.requirementText.length
        ? stmt.requirementText
        : existing.requirementText;
    const lot = mergeLotApplicability(existing.lotApplicability, stmt.lotApplicability);
    byIdentity.set(stmt.semanticIdentity, {
      ...existing,
      requirementText: preferLonger,
      lotApplicability: lot,
      provenanceLinks: links,
      confidence: Math.max(existing.confidence, stmt.confidence),
      conditionText: existing.conditionText ?? stmt.conditionText,
      conditional: existing.conditional || stmt.conditional,
      conditionality: existing.conditionality.conditionText
        ? existing.conditionality
        : stmt.conditionality,
    });
  }

  const candidates: CanonicalSemanticCandidate[] = [];
  let i = 0;
  for (const stmt of byIdentity.values()) {
    i += 1;
    const hash = createHash("sha256")
      .update(stmt.semanticIdentity)
      .digest("hex")
      .slice(0, 12);
    const sourceSection = encodeLotIntoSourceSection(
      stmt.provenance.sourceSection,
      stmt.lotApplicability,
    );
    const mandatory =
      stmt.obligationStrength === "MANDATORY" && !stmt.conditional
        ? true
        : stmt.obligationStrength === "OPTIONAL" ||
            stmt.obligationStrength === "CONDITIONAL" ||
            stmt.obligationStrength === "INFORMATIONAL" ||
            stmt.obligationStrength === "UNKNOWN"
          ? false
          : true;

    candidates.push({
      canonicalId: `sem-${hash}-${i}`,
      fullRequirementText: stmt.requirementText,
      actor: stmt.actor,
      recipient: stmt.recipient,
      clauseRole: stmt.clauseRole,
      clausePurpose: stmt.clausePurpose,
      documentRole: stmt.documentRole,
      documentPurpose: stmt.documentPurpose,
      sectionRole: stmt.sectionRole,
      semanticKind: stmt.semanticKind,
      contentKind: stmt.contentKind,
      obligationStrength: stmt.obligationStrength,
      procurementPhase: stmt.procurementPhase,
      applicability: stmt.applicability,
      templateStatus: stmt.templateStatus,
      condition: stmt.conditionText,
      conditionality: stmt.conditionality,
      bidderRelevant: stmt.bidderRelevant,
      boundaryComplete: stmt.boundaryComplete,
      lotApplicability: stmt.lotLabel,
      tableContext: stmt.tableContext,
      versionContext: stmt.versionContext,
      sourceDocument: stmt.provenance.sourceDocument,
      sourcePage: stmt.provenance.sourcePage,
      sourceSection,
      sourceCell: stmt.provenance.sourceCell,
      version: stmt.provenance.versionLabel,
      provenance: stmt.provenanceLinks,
      confidence: stmt.confidence,
      situation: stmt.situation,
      draft: {
        category: categoryForKind(stmt.clauseRole),
        description: stmt.requirementText,
        mandatory,
        sourcePage: stmt.provenance.sourcePage,
        sourceSection,
        sourceCell: stmt.provenance.sourceCell,
        columnHeader: stmt.tableContext?.columnHeader ?? null,
        rowLabel: stmt.tableContext?.rowLabel ?? null,
        versionLabel: stmt.provenance.versionLabel,
        locator: stmt.provenance.locator ?? null,
        sourceCompleteness:
          stmt.provenance.completeness === "TRUNCATED" ||
          stmt.provenanceLinks.some((p) => p.completeness === "TRUNCATED")
            ? "TRUNCATED"
            : stmt.provenance.completeness ?? null,
        evidenceText: stmt.requirementText,
        sourceDocument: stmt.provenance.sourceDocument,
      },
    });
  }

  return { candidates, rejected, interpreted, metadata };
}

function draftText(d: SemanticDraftInput): string {
  return (d.requirement ?? d.description ?? "").replace(/\s+/g, " ").trim();
}

function sameSource(a: SemanticDraftInput, b: SemanticDraftInput): boolean {
  const left = a.sourceDocument ?? "";
  const right = b.sourceDocument ?? "";
  return Boolean(left) && left === right;
}

/**
 * Preserve document order: nearest heading becomes section context;
 * adjacent same-document paragraphs become neighbor text.
 * Reunification still refuses to invent a clause from unrelated neighbors.
 */
function looksOrphanOrIncomplete(text: string): boolean {
  if (!text) return false;
  if (!isObligationBoundaryComplete(text)) return true;
  return /^(?:if|unless|when|where(?:\s+applicable)?|only\s+if|provided\s+that|subject\s+to)\b/i.test(
    text,
  ) && !/\b(?:shall|must|is\s+required|are\s+required)\b/i.test(text);
}

function neighborContext(
  drafts: SemanticDraftInput[],
  index: number,
): {
  precedingText: string | null;
  followingText: string | null;
  sectionLabel: string | null;
} {
  const current = drafts[index]!;
  const currentText = draftText(current);
  const needsNeighbors = looksOrphanOrIncomplete(currentText);
  let precedingText: string | null = null;
  let followingText: string | null = null;
  let sectionLabel: string | null = null;

  for (let j = index - 1; j >= 0; j--) {
    const prev = drafts[j]!;
    if (!sameSource(current, prev) && (current.sourceDocument || prev.sourceDocument)) {
      break;
    }
    const t = draftText(prev);
    if (!t) continue;
    if (isStructuralHeading(t) && !sectionLabel) {
      sectionLabel = t.slice(0, 160);
    }
    if (needsNeighbors && !precedingText && !isStructuralHeading(t)) {
      precedingText = t;
    }
    if (sectionLabel && (!needsNeighbors || precedingText)) break;
  }

  if (needsNeighbors) {
    for (let j = index + 1; j < drafts.length; j++) {
      const next = drafts[j]!;
      if (!sameSource(current, next) && (current.sourceDocument || next.sourceDocument)) {
        break;
      }
      const t = draftText(next);
      if (!t || isStructuralHeading(t)) continue;
      followingText = t;
      break;
    }
  }

  return { precedingText, followingText, sectionLabel };
}

/** One invalid candidate must never abort package interpretation. */
function failedInterpretation(
  text: string,
  provenance: SemanticProvenance,
): InterpretedSemanticStatement {
  return {
    version: "semantic-tender-intelligence/v3",
    requirementText: text,
    documentRole: "UNKNOWN",
    documentPurpose: "UNKNOWN",
    sectionRole: "UNKNOWN",
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
    conditionality: {
      applicability: "UNKNOWN",
      conditionText: null,
      actionText: null,
      thresholdText: null,
      exceptionText: null,
      timeframeText: null,
      scopeText: null,
      unresolved: false,
    },
    lotApplicability: { kind: "UNSPECIFIED" },
    lotLabel: null,
    boundaryComplete: false,
    reconstructedFromContext: false,
    tableContext: null,
    versionContext: null,
    provenance,
    provenanceLinks: [provenance],
    semanticIdentity: `failed:${text.slice(0, 40)}`,
    confidence: 0,
    situation: null,
    admitToCanonical: false,
    exclusionReason: "interpretation_failure",
    exclusionCode: "EXCLUDED_INTERPRETATION_FAILURE",
  };
}
