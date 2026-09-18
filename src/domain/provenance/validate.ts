/**
 * Provenance validation — reject invented page numbers and inconsistent references.
 */

import type { SourceReference } from "@/domain/provenance/types";
import { PLACEHOLDER_TENDER_EVIDENCE } from "@/domain/provenance/messages";

export type PageValidationContext = {
  maxPage?: number | null;
  knownPages?: Set<number> | null;
};

export type PageValidationResult =
  | { ok: true; page: number }
  | { ok: false; reason: string };

export function validatePageNumber(
  page: number | null | undefined,
  ctx: PageValidationContext = {},
): PageValidationResult {
  if (page == null) {
    return { ok: false, reason: "Page number is missing." };
  }
  if (!Number.isInteger(page) || page < 1) {
    return { ok: false, reason: `Invalid page number: ${page}` };
  }
  if (ctx.maxPage != null && page > ctx.maxPage) {
    return {
      ok: false,
      reason: `Page ${page} exceeds document page count (${ctx.maxPage}).`,
    };
  }
  if (ctx.knownPages && ctx.knownPages.size > 0 && !ctx.knownPages.has(page)) {
    return {
      ok: false,
      reason: `Page ${page} was not found in extraction page markers.`,
    };
  }
  return { ok: true, page };
}

export function sanitizePageNumber(
  page: number | null | undefined,
  ctx: PageValidationContext = {},
): number | null {
  if (page == null) return null;
  const result = validatePageNumber(page, ctx);
  return result.ok ? result.page : null;
}

export function isRealExcerpt(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return text.trim() !== PLACEHOLDER_TENDER_EVIDENCE;
}

export function computeLocated(input: {
  excerpt: string | null | undefined;
  page: number | null | undefined;
  section: string | null | undefined;
  cell?: string | null | undefined;
  locator?: string | null | undefined;
  pageContext?: PageValidationContext;
}): boolean {
  if (!isRealExcerpt(input.excerpt)) return false;
  const page = sanitizePageNumber(input.page, input.pageContext);
  const section = input.section?.trim() || null;
  const cell = input.cell?.trim() || null;
  const locator = input.locator?.trim() || null;
  return page != null || section != null || cell != null || locator != null;
}

export function assertProvenanceConsistency(ref: SourceReference): void {
  if (ref.located && !isRealExcerpt(ref.excerpt)) {
    throw new Error("Provenance inconsistency: located=true without excerpt");
  }
  if (ref.kind === "COMPANY_EVIDENCE" && ref.basis === "TENDER_DOCUMENT") {
    throw new Error(
      "Provenance inconsistency: company evidence cannot use TENDER_DOCUMENT basis",
    );
  }
  if (ref.kind === "TENDER_SOURCE" && ref.basis === "TEAM_VERIFIED") {
    throw new Error(
      "Provenance inconsistency: tender source cannot use TEAM_VERIFIED basis",
    );
  }
  if (ref.page != null && (!Number.isInteger(ref.page) || ref.page < 1)) {
    throw new Error(`Provenance inconsistency: invalid page ${ref.page}`);
  }
}
