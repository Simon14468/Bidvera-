/**
 * Source completeness — only parser/OCR/unreadable loss is TEXT_TRUNCATED.
 * Application context windows must never set TRUNCATED_BY_SOURCE.
 */

import type { AuthoritativeCorpus, CorpusCompleteness } from "./types";

export function corpusCompletenessFromExtract(input: {
  text: string;
  pageCount?: number | null;
  pages?: Array<{ page: number | null | undefined; charCount?: number | null }>;
  failed?: boolean;
}): CorpusCompleteness {
  const text = input.text?.trim() ?? "";
  if (input.failed || text.length === 0) return "FAILED";

  const declared = input.pageCount ?? null;
  const covered = (input.pages ?? [])
    .map((p) => p.page)
    .filter((p): p is number => typeof p === "number" && p >= 1);

  if (declared != null && declared > 0 && covered.length > 0 && covered.length < declared) {
    return "TRUNCATED_BY_SOURCE";
  }
  return "FULL";
}

export function buildAuthoritativeCorpus(input: {
  text: string;
  pageCount?: number | null;
  pages?: Array<{ page: number | null | undefined; charCount?: number | null }>;
  failed?: boolean;
}): AuthoritativeCorpus {
  const completeness = corpusCompletenessFromExtract(input);
  const coveredPages = (input.pages ?? [])
    .map((p) => p.page)
    .filter((p): p is number => typeof p === "number" && p >= 1);
  return {
    text: input.text ?? "",
    charCount: (input.text ?? "").length,
    completeness,
    pageCount: input.pageCount ?? null,
    coveredPages,
  };
}

export function isSourceTruncated(completeness: CorpusCompleteness): boolean {
  return completeness === "TRUNCATED_BY_SOURCE";
}
