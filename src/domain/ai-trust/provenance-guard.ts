/**
 * Provenance guards — no fabricated pages, excerpts, or cross-kind confusion.
 */

import {
  assertProvenanceConsistency,
  computeLocated,
  sanitizePageNumber,
  validatePageNumber,
  type PageValidationContext,
} from "@/domain/provenance/validate";
import type { SourceReference } from "@/domain/provenance/types";

export type { PageValidationContext };

export function assertNoFabricatedProvenance(ref: SourceReference): void {
  assertProvenanceConsistency(ref);
  if (ref.located && ref.page == null && !ref.section?.trim()) {
    throw new Error("Fabricated provenance: located without page or section.");
  }
}

export function sanitizeExtractedPage(
  page: number | null | undefined,
  ctx: PageValidationContext = {},
): number | null {
  return sanitizePageNumber(page, ctx);
}

export function validateExtractedPage(
  page: number | null | undefined,
  ctx: PageValidationContext = {},
) {
  return validatePageNumber(page, ctx);
}

export function buildPageContextFromExtractMeta(
  pages: Array<{ page: number }> | null | undefined,
): PageValidationContext {
  if (!pages?.length) return {};
  const knownPages = new Set<number>();
  let maxPage = 0;
  for (const p of pages) {
    if (Number.isInteger(p.page) && p.page >= 1) {
      knownPages.add(p.page);
      maxPage = Math.max(maxPage, p.page);
    }
  }
  return { knownPages, maxPage: maxPage || null };
}

export function sanitizeRequirementProvenance<T extends {
  sourcePage?: number | null;
  sourceSection?: string | null;
  evidenceText?: string | null;
}>(row: T, ctx: PageValidationContext): T {
  const page = sanitizePageNumber(row.sourcePage, ctx);
  const located = computeLocated({
    excerpt: row.evidenceText,
    page,
    section: row.sourceSection,
    pageContext: ctx,
  });
  return {
    ...row,
    sourcePage: located ? page : sanitizePageNumber(row.sourcePage, ctx),
  };
}

export function sanitizeAiExtractionDrafts<
  T extends { sourcePage?: number | null; evidence?: string | null; section?: string | null },
>(drafts: T[], ctx: PageValidationContext): T[] {
  return drafts.map((d) => {
    const page = sanitizePageNumber(d.sourcePage, ctx);
    const located = computeLocated({
      excerpt: d.evidence ?? null,
      page,
      section: d.section ?? null,
      pageContext: ctx,
    });
    return {
      ...d,
      sourcePage: located ? page : null,
    };
  });
}
