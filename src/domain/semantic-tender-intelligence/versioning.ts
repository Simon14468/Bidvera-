/**
 * Amendment / corrigendum / clarification versioning.
 * Preserve original + modification + applicability.
 * Never invent a replacement clause; unproven replacement → REVIEW/CONFLICT.
 *
 * Substantive bidder obligations stated inside an amendment remain interpretable
 * as ORIGINAL wording of that amendment (not auto-blocked).
 */

import type { VersionSemanticContext } from "./types";

const VERSION_META_ONLY =
  /^(?:addendum|corrigendum|rectificatif|amendment|modification\s+notice)\s*(?:no\.?|number|n[°o])?\s*[\dIVXLC]+(?:\s*[:\-–].{0,80})?$/i;

const REPLACES_CLAIM =
  /\b(?:this\s+(?:addendum|corrigendum|amendment|clarification)\s+)?(?:supersedes|replaces|amends|modifies|deletes)\b/i;

const CONFLICT_CUE =
  /\b(?:in\s+the\s+event\s+of\s+(?:any\s+)?conflict|where\s+(?:this|the)\s+(?:addendum|corrigendum).{0,40}conflicts?|conflicting\s+(?:provisions?|versions?))\b/i;

/**
 * Classify version applicability for a statement in amendment/corrigendum packs.
 */
export function analyzeVersionApplicability(input: {
  text: string;
  documentRole?: string | null;
  versionLabel?: string | null;
  priorVersionText?: string | null;
}): VersionSemanticContext {
  const text = (input.text ?? "").replace(/\s+/g, " ").trim();
  const role = (input.documentRole ?? "").toUpperCase();
  const isVersionDoc =
    role === "AMENDMENT" ||
    role === "CORRIGENDUM" ||
    /\b(?:addendum|corrigendum|amendment)\b/i.test(input.versionLabel ?? "");

  if (VERSION_META_ONLY.test(text)) {
    return {
      status: "NOT_APPLICABLE",
      originalRef: input.versionLabel ?? text.slice(0, 80),
      modificationSummary: text,
      replacesProven: false,
    };
  }

  if (CONFLICT_CUE.test(text)) {
    return {
      status: "CONFLICT",
      originalRef: input.versionLabel ?? null,
      modificationSummary: "conflicting_version_language",
      replacesProven: false,
    };
  }

  if (REPLACES_CLAIM.test(text)) {
    // Proven only when a clear substitute body is present.
    const hasSubstitute =
      /\bwith\s+the\s+following\b|\bread\s+as\s+follows\b|:\s*.{20,}/i.test(text) ||
      Boolean(input.priorVersionText && text.length > 80);
    if (!hasSubstitute) {
      return {
        status: "REVIEW",
        originalRef: input.versionLabel ?? null,
        modificationSummary: "replacement_not_proven",
        replacesProven: false,
      };
    }
    return {
      status: "MODIFIED",
      originalRef: input.versionLabel ?? null,
      modificationSummary: text.slice(0, 160),
      replacesProven: true,
    };
  }

  // Clarification/Q&A packaging alone does not invent replacements.
  if (
    (role === "CLARIFICATION" || role === "Q_AND_A") &&
    /\b(?:addendum|corrigendum|this\s+clarification\s+supersedes)\b/i.test(text)
  ) {
    return {
      status: "REVIEW",
      originalRef: input.versionLabel ?? null,
      modificationSummary: "clarification_version_language",
      replacesProven: false,
    };
  }

  // Substantive text inside an amendment remains ORIGINAL wording of that
  // document. Replacement is never inferred from document role alone.
  return {
    status: "ORIGINAL",
    originalRef: isVersionDoc ? input.versionLabel ?? null : null,
    modificationSummary: isVersionDoc ? "version_document_without_proven_replacement" : null,
    replacesProven: false,
  };
}

export function versionBlocksCanonicalAdmission(
  version: VersionSemanticContext | null | undefined,
): boolean {
  if (!version) return false;
  return (
    version.status === "CONFLICT" ||
    version.status === "REVIEW" ||
    version.status === "NOT_APPLICABLE" ||
    version.status === "SUPERSEDED"
  );
}
