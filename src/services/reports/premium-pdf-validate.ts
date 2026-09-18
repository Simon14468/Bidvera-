/**
 * Post-render validation for Bidvera premium PDFs.
 * Ensures no blank/nearly-empty pages and consistent page numbering.
 */

import { PDF_PAGINATION } from "@/services/reports/premium-pdf-pagination";

export type PremiumPdfValidationOptions = {
  /** Skip cover page density check (page 1). Default false. */
  skipCoverCheck?: boolean;
  minMeaningfulCharsContent?: number;
  minMeaningfulCharsCover?: number;
  /** Repeating header phrases (e.g. tender title) excluded from body density. */
  headerPhrases?: string[];
};

export type PremiumPdfValidationResult = {
  pageCount: number;
  meaningfulCharsPerPage: number[];
};

const CHROME_LINE =
  /^(confidential|page\s+\d+\s+of\s+\d+|verify before you bid\.?|decision report)$/i;

function normalizePhrase(phrase: string): string {
  return phrase.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Strip header/footer chrome so density reflects report body. */
export function extractMeaningfulPageText(
  rawPageText: string,
  options?: { headerPhrases?: string[] },
): string {
  const headerNorm = new Set(
    (options?.headerPhrases ?? [])
      .map(normalizePhrase)
      .filter((p) => p.length >= 3),
  );

  return rawPageText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !CHROME_LINE.test(line))
    .filter((line) => !/^report by\s+/i.test(line))
    .filter((line) => !headerNorm.has(normalizePhrase(line)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function validatePremiumPdfBuffer(
  pdf: Buffer,
  options: PremiumPdfValidationOptions = {},
): Promise<PremiumPdfValidationResult> {
  const minContent =
    options.minMeaningfulCharsContent ??
    PDF_PAGINATION.minMeaningfulCharsContent;
  const minCover =
    options.minMeaningfulCharsCover ?? PDF_PAGINATION.minMeaningfulCharsCover;

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: pdf });
  try {
    const parsed = await parser.getText();
    const pages = parsed.pages ?? [];
    const pageCount = parsed.total ?? pages.length;

    if (pageCount < 1) {
      throw new Error("PDF validation failed: document has no pages");
    }

    const meaningfulCharsPerPage: number[] = [];
    for (const page of pages) {
      const num = page.num ?? meaningfulCharsPerPage.length + 1;
      const raw = page.text ?? "";
      const meaningful = extractMeaningfulPageText(raw, {
        headerPhrases: options.headerPhrases,
      });
      meaningfulCharsPerPage.push(meaningful.length);

      const isCover = num === 1;
      const minRequired =
        isCover && !options.skipCoverCheck ? minCover : minContent;

      if (meaningful.length < minRequired) {
        throw new Error(
          `PDF validation failed: page ${num} has insufficient meaningful content (${meaningful.length} chars, minimum ${minRequired})`,
        );
      }
    }

    // Page numbering consistency — every content page footer should reference same total
    const footerTotals = new Set<number>();
    const fullText = parsed.text ?? "";
    for (const match of fullText.matchAll(/page\s+(\d+)\s+of\s+(\d+)/gi)) {
      footerTotals.add(Number.parseInt(match[2]!, 10));
    }
    if (footerTotals.size > 1) {
      throw new Error(
        `PDF validation failed: inconsistent page totals (${[...footerTotals].join(", ")})`,
      );
    }
    if (footerTotals.size === 1) {
      const expectedTotal = [...footerTotals][0]!;
      if (expectedTotal !== pageCount) {
        throw new Error(
          `PDF validation failed: footer total ${expectedTotal} ≠ parsed page count ${pageCount}`,
        );
      }
    }

    return { pageCount, meaningfulCharsPerPage };
  } finally {
    await parser.destroy();
  }
}
