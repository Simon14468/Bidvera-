/**
 * Pagination helper unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import PDFDocument from "pdfkit";
import {
  addContentPage,
  ensureSectionHeadingSpace,
  ensureSpaceForBlock,
  remainingSpace,
  tableFitsWithHeader,
} from "@/services/reports/premium-pdf-pagination";
import { PDF_LAYOUT } from "@/services/reports/premium-pdf-theme";

function mockCtx(startY: number) {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  doc.y = startY;
  return {
    doc,
    contentBottom: PDF_LAYOUT.contentBottom,
    pageCount: 1,
  };
}

describe("premium-pdf-pagination", () => {
  it("addContentPage resets Y to margin top", () => {
    const ctx = mockCtx(PDF_LAYOUT.contentBottom - 10);
    addContentPage(ctx);
    assert.equal(ctx.pageCount, 2);
    assert.equal(ctx.doc.y, PDF_LAYOUT.marginTop);
  });

  it("ensureSpaceForBlock breaks when block would clip", () => {
    const ctx = mockCtx(PDF_LAYOUT.contentBottom - 20);
    ensureSpaceForBlock(ctx, 40);
    assert.equal(ctx.pageCount, 2);
    assert.equal(ctx.doc.y, PDF_LAYOUT.marginTop);
  });

  it("ensureSpaceForBlock allows tall blocks to start on a fresh page without cascading breaks", () => {
    const ctx = mockCtx(PDF_LAYOUT.contentBottom - 10);
    const usable = PDF_LAYOUT.contentBottom - PDF_LAYOUT.marginTop;
    ensureSpaceForBlock(ctx, usable + 200);
    assert.equal(ctx.pageCount, 2);
    assert.equal(ctx.doc.y, PDF_LAYOUT.marginTop);
  });

  it("ensureSectionHeadingSpace prevents orphan headings", () => {
    const ctx = mockCtx(PDF_LAYOUT.contentBottom - 30);
    const broke = ensureSectionHeadingSpace(ctx, 24);
    assert.equal(broke, true);
    assert.equal(ctx.pageCount, 2);
  });

  it("tableFitsWithHeader requires header plus one row", () => {
    const ctx = mockCtx(PDF_LAYOUT.contentBottom - 30);
    assert.equal(tableFitsWithHeader(ctx, 24, 22), false);
    const ctx2 = mockCtx(PDF_LAYOUT.contentBottom - 50);
    assert.equal(tableFitsWithHeader(ctx2, 24, 22), true);
  });

  it("remainingSpace reflects content bottom", () => {
    const ctx = mockCtx(100);
    assert.equal(remainingSpace(ctx), PDF_LAYOUT.contentBottom - 100);
  });
});
