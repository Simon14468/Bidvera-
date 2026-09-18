/**
 * Authoritative extraction corpus vs bounded processing contexts.
 * A context window is never the source of truth and never implies TEXT_TRUNCATED.
 */

export const CORPUS_COMPLETENESS_STATES = [
  "FULL",
  "PARTIAL",
  "FAILED",
  "TRUNCATED_BY_SOURCE",
  "CONTEXT_WINDOW_ONLY",
] as const;

export type CorpusCompleteness = (typeof CORPUS_COMPLETENESS_STATES)[number];

export type AuthoritativeCorpus = {
  text: string;
  charCount: number;
  completeness: CorpusCompleteness;
  pageCount: number | null;
  coveredPages: number[];
};

export type CorpusChunk = {
  index: number;
  total: number;
  start: number;
  end: number;
  text: string;
  /** Bounded window — must not be stored as the document corpus. */
  completeness: "CONTEXT_WINDOW_ONLY";
};

/** Provider/AI window size. Never applied to the canonical corpus. */
export const AI_CONTEXT_WINDOW_CHARS = 80_000;
export const AI_CONTEXT_OVERLAP_CHARS = 2_000;
