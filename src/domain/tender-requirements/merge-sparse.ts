/**
 * Merge requirements from all extraction sources.
 * Always converges AI + heuristic into one draft list — semantic dedupe happens in normalizeRequirements.
 */

import type { RequirementDraftLike } from "./normalize";

function draftKey(d: RequirementDraftLike): string {
  return `${d.description.toLowerCase().trim()}|${d.value ?? ""}`;
}

export function mergeSparseExtractionRequirements(input: {
  aiRequirements: RequirementDraftLike[];
  heuristicRequirements: RequirementDraftLike[];
  /** Ignored — all sources are always merged at the canonical layer. */
  minAiCount?: number;
}): RequirementDraftLike[] {
  const merged = [...input.aiRequirements];
  const seen = new Set(merged.map(draftKey));
  for (const h of input.heuristicRequirements) {
    const key = draftKey(h);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(h);
  }
  return merged;
}
