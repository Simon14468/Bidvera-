/**
 * High-risk fact token extraction — deterministic, cached over structured strings.
 * Used to verify canonical requirements preserve dates, amounts, thresholds, etc.
 */

export type HighRiskFactKind =
  | "DATE"
  | "TIME"
  | "TIMEZONE"
  | "CURRENCY_AMOUNT"
  | "PERCENTAGE"
  | "QUANTITY"
  | "DURATION"
  | "TECHNICAL_THRESHOLD"
  | "CERTIFICATION"
  | "LICENSE"
  | "EXPERIENCE"
  | "GUARANTEE"
  | "PAYMENT_TERM"
  | "PENALTY"
  | "CONDITIONAL"
  | "REQUIREMENT_REF"
  | "SECTION";

export type HighRiskFactToken = {
  kind: HighRiskFactKind;
  raw: string;
  normalized: string;
};

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract decision-critical tokens from tender/requirement text. */
export function extractHighRiskFactTokens(text: string): HighRiskFactToken[] {
  const t = text ?? "";
  const out: HighRiskFactToken[] = [];
  const push = (kind: HighRiskFactKind, raw: string) => {
    const normalized = fold(raw).replace(/,/g, "");
    if (!normalized || out.some((x) => x.kind === kind && x.normalized === normalized)) {
      return;
    }
    out.push({ kind, raw: raw.trim(), normalized });
  };

  for (const m of t.matchAll(/\b([TR]-\d{2})\b/gi)) push("REQUIREMENT_REF", m[1]!);

  for (const m of t.matchAll(
    /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})\b/gi,
  )) {
    push("DATE", m[1]!);
  }

  for (const m of t.matchAll(/\b(\d{1,2}:\d{2})\b/g)) push("TIME", m[1]!);
  for (const m of t.matchAll(/\b(Africa\/Casablanca|Asia\/Kuala_Lumpur|UTC[+\-]\d{1,2}|GMT[+\-]\d{1,2})\b/gi)) {
    push("TIMEZONE", m[1]!);
  }

  for (const m of t.matchAll(
    /\b((?:MAD|DH|DHS|EUR|USD|RM)\s*[\d]{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?|[\d]{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?\s*(?:MAD|DH|DHS|EUR|USD|RM))\b/gi,
  )) {
    push("CURRENCY_AMOUNT", m[1]!);
  }

  for (const m of t.matchAll(/\b(\d+(?:[.,]\d+)?\s*%)/g)) push("PERCENTAGE", m[1]!);

  for (const m of t.matchAll(
    /\b(\d+(?:\.\d+)?\s*(?:Gbps|Mbps|kbps|doors?|clients?|links?|units?|copies?))\b/gi,
  )) {
    push("TECHNICAL_THRESHOLD", m[1]!);
  }

  for (const m of t.matchAll(
    /\b(\d+\s*(?:\+\s*)?(?:years?|months?|weeks?|days?|hours?|ann[eé]es?))\b/gi,
  )) {
    push("DURATION", m[1]!);
  }

  if (/\bexperience\b/i.test(t)) {
    for (const m of t.matchAll(/\b(\d+)\s*(?:\+\s*)?(?:years?|ann)/gi)) {
      push("EXPERIENCE", `${m[1]} years`);
    }
  }

  for (const m of t.matchAll(/\b(ISO\s?\d+(?::\d+)?|SOC\s?2|PCI[\s-]?DSS|CNSS|CIDB|PKK)\b/gi)) {
    push("CERTIFICATION", m[1]!);
  }

  if (/\b(license|licence|autorisation|authorization)\b/i.test(t)) {
    push("LICENSE", "license/authorization");
  }

  if (/\b(performance\s+guarantee|bid\s+security|provisional\s+(?:bond|guarantee)|caution|garantie)\b/i.test(t)) {
    push("GUARANTEE", "guarantee/bond");
  }

  if (/\b(payment\s+(?:shall|within|terms)|within\s+\d+\s+days\s+of\s+invoice)\b/i.test(t)) {
    push("PAYMENT_TERM", "payment terms");
  }

  if (/\b(penalt|liquidated\s+damages|late\s+delivery\s+shall\s+incur)\b/i.test(t)) {
    push("PENALTY", "penalty");
  }

  // CONDITIONAL: preserve the matched cue — never invent literal "conditional".
  // PE liability disclaimers ("shall be responsible if the bidder fails…") are not
  // bidder conditional obligations.
  for (const cue of extractConditionalObligationCues(t)) {
    push("CONDITIONAL", cue);
  }

  return out;
}

/**
 * PE disclaimer / exclusion of liability — not a bidder conditional obligation.
 * Example: "IGL in no way shall be responsible if the bidder fails to apply…"
 */
function isProcuringEntityLiabilityDisclaimer(window: string): boolean {
  return /(?:in\s+no\s+way\s+)?(?:shall|will)\s+(?:not\s+)?be\s+responsible\s+if\s+the\s+bidder\s+fails/i.test(
    window,
  ) || /not\s+(?:be\s+)?responsible\s+if\s+the\s+bidder\s+fails/i.test(window);
}

/**
 * Genuine conditional-obligation cues with the actual matched phrase retained.
 */
export function extractConditionalObligationCues(text: string): string[] {
  const t = text ?? "";
  const cues: string[] = [];
  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = fold(trimmed);
    if (cues.some((c) => fold(c) === key)) return;
    cues.push(trimmed);
  };

  for (const m of t.matchAll(/\(conditional\)/gi)) {
    add(m[0]!);
  }
  for (const m of t.matchAll(/\bif\s+applicable\b/gi)) {
    add(m[0]!);
  }
  for (const m of t.matchAll(/\bwhen\s+applicable\b/gi)) {
    add(m[0]!);
  }
  for (const m of t.matchAll(/\bwhere\s+applicable\b/gi)) {
    add(m[0]!);
  }
  for (const m of t.matchAll(/\bif\s+the\s+bidder\b/gi)) {
    const idx = m.index ?? 0;
    const window = t.slice(Math.max(0, idx - 80), idx + m[0]!.length + 48);
    if (isProcuringEntityLiabilityDisclaimer(window)) continue;
    add(m[0]!);
  }

  return cues;
}

/** True when every evidence token of listed kinds appears in the target text. */
export function missingHighRiskTokens(
  sourceText: string,
  targetText: string,
  kinds?: HighRiskFactKind[],
): HighRiskFactToken[] {
  const sourceTokens = extractHighRiskFactTokens(sourceText);
  const target = fold(targetText).replace(/,/g, "");
  const filtered = kinds
    ? sourceTokens.filter((t) => kinds.includes(t.kind))
    : sourceTokens;
  return filtered.filter((token) => {
    if (token.kind === "SECTION") return false;
    return !target.includes(token.normalized);
  });
}

/** Simple cache for repeated parses in one Guardian run. */
export function createFactTokenCache() {
  const map = new Map<string, HighRiskFactToken[]>();
  return {
    get(text: string): HighRiskFactToken[] {
      const key = text.slice(0, 2000);
      const hit = map.get(key);
      if (hit) return hit;
      const tokens = extractHighRiskFactTokens(text);
      map.set(key, tokens);
      return tokens;
    },
  };
}
