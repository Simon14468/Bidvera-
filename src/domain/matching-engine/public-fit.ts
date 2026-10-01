/**
 * Public-safe fit summaries for Matching UI.
 * Never exposes AI prompts, boost internals, or raw model fields.
 */

export type StoredMatchDimension = {
  key?: string;
  label?: string;
  score?: number | null;
  status?: string;
  note?: string;
};

export type PublicMatchFitSummary = {
  /** Human labels for dimensions that support the match. */
  matchedLabels: string[];
  /** Human-readable gap / missing requirement notes. */
  gapNotes: string[];
  /** Capability/service chips safe for display. */
  capabilityChips: string[];
};

function asDimensions(raw: unknown): StoredMatchDimension[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is StoredMatchDimension =>
      Boolean(d) && typeof d === "object" && !Array.isArray(d),
  );
}

/**
 * Derive user-facing matched / gap copy from stored MatchRecommendation.matchedDimensions.
 */
export function publicFitFromMatchedDimensions(
  matchedDimensions: unknown,
  options?: {
    opportunityServices?: string[] | null;
    reasons?: string[] | null;
  },
): PublicMatchFitSummary {
  const dims = asDimensions(matchedDimensions);
  const matchedLabels: string[] = [];
  const gapNotes: string[] = [];

  for (const d of dims) {
    const label = typeof d.label === "string" ? d.label.trim() : "";
    const note = typeof d.note === "string" ? d.note.trim() : "";
    const score = typeof d.score === "number" ? d.score : null;
    const status = d.status ?? "";

    if (status === "scored" && score != null && score >= 50) {
      if (label) matchedLabels.push(label);
    } else if (
      status === "unknown" ||
      (status === "scored" && score != null && score < 50)
    ) {
      if (note) gapNotes.push(note);
      else if (label) gapNotes.push(`${label} needs attention`);
    }
  }

  const capabilityChips: string[] = [];
  const services = options?.opportunityServices ?? [];
  for (const s of services) {
    const v = String(s ?? "").trim();
    if (!v) continue;
    if (capabilityChips.length >= 4) break;
    capabilityChips.push(v);
  }
  if (capabilityChips.length === 0) {
    for (const r of options?.reasons ?? []) {
      const v = String(r ?? "").trim();
      if (!v) continue;
      // Prefer short chips from reasons only when no services exist
      if (v.length <= 48) capabilityChips.push(v);
      if (capabilityChips.length >= 3) break;
    }
  }

  return {
    matchedLabels: matchedLabels.slice(0, 6),
    gapNotes: gapNotes.slice(0, 4),
    capabilityChips: capabilityChips.slice(0, 4),
  };
}
