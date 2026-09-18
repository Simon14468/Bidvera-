/**
 * Smart pagination helpers for Bidvera PDF reports.
 * Presentation only — no report data changes.
 */

import type PDFDocument from "pdfkit";
import { PDF_LAYOUT } from "@/services/reports/premium-pdf-theme";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type PdfPaginationCtx = {
  doc: PdfDoc;
  contentBottom: number;
  pageCount: number;
};

export const PDF_PAGINATION = {
  /** Minimum body lines kept with a section heading (orphan guard). */
  sectionTitleMinFollowing: 24,
  subSectionTitleMinFollowing: 18,
  /** Minimum meaningful characters on content pages (excludes chrome). */
  minMeaningfulCharsContent: 60,
  /** Cover page may be sparser but must include report meta. */
  minMeaningfulCharsCover: 40,
  sectionTitleBlockHeight: 36,
  subSectionTitleBlockHeight: 22,
} as const;

export function remainingSpace(ctx: PdfPaginationCtx): number {
  return ctx.contentBottom - ctx.doc.y;
}

export function startContentPageY(): number {
  return PDF_LAYOUT.marginTop;
}

export function addContentPage(ctx: PdfPaginationCtx): void {
  ctx.doc.addPage();
  ctx.pageCount += 1;
  ctx.doc.y = startContentPageY();
}

/**
 * Ensure vertical space; breaks to a new page when the block would clip.
 * Optionally reserves space for content that must stay with this block (orphan guard).
 */
export function ensureSpaceForBlock(
  ctx: PdfPaginationCtx,
  blockHeight: number,
  options?: { keepWithPrevious?: number },
): void {
  const reserve = options?.keepWithPrevious ?? 0;
  const needed = blockHeight + reserve;
  if (needed <= 0) return;

  const usableOnFreshPage = ctx.contentBottom - startContentPageY();
  const minLine = 14;
  // Blocks taller than one page paginate internally — only require one line of room.
  const breakAt =
    needed <= usableOnFreshPage
      ? needed
      : Math.min(minLine, usableOnFreshPage);

  if (ctx.doc.y + breakAt <= ctx.contentBottom) return;
  addContentPage(ctx);
}

/** @deprecated alias — prefer ensureSpaceForBlock */
export function ensureSpace(ctx: PdfPaginationCtx, needed: number): void {
  ensureSpaceForBlock(ctx, needed);
}

/**
 * Break before a section heading when it would orphan at the bottom of a page.
 * Returns true when a new page was started.
 */
export function ensureSectionHeadingSpace(
  ctx: PdfPaginationCtx,
  minFollowing: number = PDF_PAGINATION.sectionTitleMinFollowing,
): boolean {
  const needed =
    PDF_PAGINATION.sectionTitleBlockHeight + minFollowing;
  if (ctx.doc.y + needed <= ctx.contentBottom) return false;
  addContentPage(ctx);
  return true;
}

export function ensureSubSectionHeadingSpace(
  ctx: PdfPaginationCtx,
  minFollowing: number = PDF_PAGINATION.subSectionTitleMinFollowing,
): boolean {
  const needed =
    PDF_PAGINATION.subSectionTitleBlockHeight + minFollowing;
  if (ctx.doc.y + needed <= ctx.contentBottom) return false;
  addContentPage(ctx);
  return true;
}

/** True when at least one table row fits below a repeated header on the current page. */
export function tableFitsWithHeader(
  ctx: PdfPaginationCtx,
  headerHeight: number,
  rowHeight: number,
): boolean {
  return ctx.doc.y + headerHeight + rowHeight <= ctx.contentBottom;
}
