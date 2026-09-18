/**
 * Deterministic coverage chunking for operations that have a real context budget.
 * Chunks are derived from the full corpus; they never replace it.
 */

import {
  AI_CONTEXT_OVERLAP_CHARS,
  AI_CONTEXT_WINDOW_CHARS,
  type CorpusChunk,
} from "./types";

export function chunkAuthoritativeCorpus(
  text: string,
  windowChars: number = AI_CONTEXT_WINDOW_CHARS,
  overlapChars: number = AI_CONTEXT_OVERLAP_CHARS,
): CorpusChunk[] {
  const raw = text ?? "";
  const window = Math.max(1, windowChars);
  const overlap = Math.max(0, Math.min(overlapChars, window - 1));
  if (raw.length === 0) {
    return [
      {
        index: 0,
        total: 1,
        start: 0,
        end: 0,
        text: "",
        completeness: "CONTEXT_WINDOW_ONLY",
      },
    ];
  }
  if (raw.length <= window) {
    return [
      {
        index: 0,
        total: 1,
        start: 0,
        end: raw.length,
        text: raw,
        completeness: "CONTEXT_WINDOW_ONLY",
      },
    ];
  }

  const step = window - overlap;
  const chunks: CorpusChunk[] = [];
  for (let start = 0; start < raw.length; start += step) {
    const end = Math.min(raw.length, start + window);
    chunks.push({
      index: chunks.length,
      total: 0,
      start,
      end,
      text: raw.slice(start, end),
      completeness: "CONTEXT_WINDOW_ONLY",
    });
    if (end >= raw.length) break;
  }
  return chunks.map((c) => ({ ...c, total: chunks.length }));
}

/** Every character of the corpus appears in at least one chunk (overlap may duplicate). */
export function assertCompleteChunkCoverage(text: string, chunks: CorpusChunk[]): void {
  if (text.length === 0) return;
  const covered = new Uint8Array(text.length);
  for (const chunk of chunks) {
    for (let i = chunk.start; i < chunk.end && i < text.length; i++) {
      covered[i] = 1;
    }
  }
  const missing = covered.findIndex((v) => v === 0);
  if (missing !== -1) {
    throw new Error(`Corpus chunk coverage gap at character ${missing}`);
  }
}
