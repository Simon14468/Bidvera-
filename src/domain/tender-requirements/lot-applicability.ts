/**
 * Lot applicability — extract and preserve which lot(s) an obligation applies to.
 * Encoded into sourceSection for persistence without a schema migration.
 */

const LOT_TOKEN =
  /\b(?:lot|package|allotissement)\s*(?:no\.?|number|n[°o])?\s*([0-9IVXLC]+)\b/gi;

const ALL_LOTS =
  /\b(?:all\s+lots?|each\s+lot|every\s+lot|tous\s+les\s+lots?|applicable\s+to\s+all\s+lots?)\b/i;

export type LotApplicability =
  | { kind: "ALL" }
  | { kind: "LOTS"; lots: string[] }
  | { kind: "UNSPECIFIED" };

/** Parse lot applicability from obligation text and/or section heading. */
export function extractLotApplicability(
  text: string,
  section?: string | null,
): LotApplicability {
  const combined = `${section ?? ""} ${text}`.trim();
  if (!combined) return { kind: "UNSPECIFIED" };
  if (ALL_LOTS.test(combined)) return { kind: "ALL" };

  const lots = new Set<string>();
  for (const m of combined.matchAll(LOT_TOKEN)) {
    const raw = (m[1] ?? "").toUpperCase();
    if (raw) lots.add(raw.replace(/^0+/, "") || "0");
  }
  if (lots.size === 0) return { kind: "UNSPECIFIED" };
  return { kind: "LOTS", lots: [...lots].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
}

/** Stable string form for fingerprints / display. */
export function formatLotApplicability(lot: LotApplicability): string | null {
  if (lot.kind === "ALL") return "ALL_LOTS";
  if (lot.kind === "LOTS") return lot.lots.map((l) => `LOT_${l}`).join(",");
  return null;
}

/** Parse previously encoded lot applicability. */
export function parseLotApplicabilityLabel(label: string | null | undefined): LotApplicability {
  if (!label?.trim()) return { kind: "UNSPECIFIED" };
  if (/\bALL_LOTS\b/i.test(label)) return { kind: "ALL" };
  const lots = [...label.matchAll(/\bLOT_([0-9IVXLC]+)\b/gi)].map((m) =>
    (m[1] ?? "").toUpperCase(),
  );
  if (lots.length === 0) return extractLotApplicability(label);
  return {
    kind: "LOTS",
    lots: [...new Set(lots)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
}

/**
 * Combine lot applicability when merging proven duplicates.
 * Never expand a lot-specific duty into ALL_LOTS — that would make a
 * conditional/lot obligation global.
 */
export function mergeLotApplicability(
  a: LotApplicability,
  b: LotApplicability,
): LotApplicability {
  if (a.kind === "UNSPECIFIED") return b;
  if (b.kind === "UNSPECIFIED") return a;
  if (a.kind === "ALL" && b.kind === "ALL") return { kind: "ALL" };
  if (a.kind === "LOTS" && b.kind === "LOTS") {
    const lots = [...new Set([...a.lots, ...b.lots])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return { kind: "LOTS", lots };
  }
  // ALL + LOTS: keep the specific lots. Expanding to ALL is a semantic invention.
  if (a.kind === "LOTS") return a;
  return b;
}

/**
 * Encode lot into sourceSection for DB persistence.
 * Existing section text is preserved; lot label is prefixed when present.
 */
export function encodeLotIntoSourceSection(
  section: string | null | undefined,
  lot: LotApplicability,
): string | null {
  const lotLabel = formatLotApplicability(lot);
  const base = (section ?? "").replace(/^\s*\[(?:ALL_LOTS|LOT_[^\]]+)\]\s*/i, "").trim();
  if (!lotLabel) return base || null;
  if (!base) return `[${lotLabel}]`;
  if (base.includes(`[${lotLabel}]`) || /\[(?:ALL_LOTS|LOT_)/i.test(base)) {
    // Re-merge encoded lots in base with new lot
    const existing = parseLotApplicabilityLabel(base);
    const merged = mergeLotApplicability(existing, lot);
    const mergedLabel = formatLotApplicability(merged);
    const stripped = base.replace(/^\s*\[[^\]]+\]\s*/i, "").trim();
    return mergedLabel ? `[${mergedLabel}]${stripped ? ` ${stripped}` : ""}` : stripped || null;
  }
  return `[${lotLabel}] ${base}`;
}

/** Decode lot applicability from a persisted sourceSection. */
export function decodeLotFromSourceSection(
  section: string | null | undefined,
): LotApplicability {
  if (!section?.trim()) return { kind: "UNSPECIFIED" };
  const bracket = section.match(/^\s*\[([^\]]+)\]/);
  if (bracket?.[1]) return parseLotApplicabilityLabel(bracket[1]);
  return extractLotApplicability("", section);
}
