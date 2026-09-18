/**
 * Structural template / placeholder detection for STI.
 * Not a final regex cleanup — runs before canonical entry.
 */

import type { TemplateStatus } from "./types";

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[\s*insert[\s\S]*?\]/i,
  /<\s*insert[\s\S]*?>/i,
  /\{\s*insert[\s\S]*?\}/i,
  /\[\s*to\s+be\s+completed\s*\]/i,
  /\[\s*to\s+be\s+deleted\s*\]/i,
  /\[\s*choose\s+one\s*\]/i,
  /\[\s*select\s+as\s+appropriate\s*\]/i,
  /\[\s*(?:dd|mm|yyyy|date|name|amount|currency|personnel|milestone|number|title|address)[\s./_-]*\]/i,
  // Bracketed drafting fields / channel placeholders (e.g. [MAIL, COURIER AND/OR FAX]).
  /^\[[A-Z0-9][A-Z0-9\s,/_&+.-]{1,120}\]$/,
  /\bxx+\/xx+\/xxxx\b/i,
  /\b\[?\s*currency\s*\]?\b.{0,20}\b\[?\s*amount\s*\]?/i,
];

const TEMPLATE_INSTRUCTION_PATTERNS: RegExp[] = [
  /\bnote\s+to\s+(?:be\s+)?deleted\b/i,
  /\bnote\s+to\s+(?:the\s+)?bidder\b/i,
  /\bnote\s+to\s+(?:the\s+)?drafter\b/i,
  /\bdelete\s+(?:this\s+)?(?:note|clause|paragraph)\s+(?:before|prior\s+to)\b/i,
  /\bto\s+be\s+(?:completed|filled|inserted|deleted)\s+by\s+(?:the\s+)?(?:bidder|purchaser|procuring|employer)\b/i,
  /\bselect\s+(?:one|as\s+appropriate|whichever\s+applies)\b/i,
  /\bcomplete\s+as\s+appropriate\b/i,
  /\bchoose\s+(?:either|one\s+of|whichever)\b/i,
  /\binsert\s+(?:bidder|tenderer|offeror|company|name|address|date|amount)\b/i,
  /\b(?:bidder|tenderer|offeror|company)\s+name\s+here\b/i,
];

const SURROUNDING_TEMPLATE_DEPENDENT =
  /\b(?:not\s+later\s+than|no\s+later\s+than|commence|within|insert|to\s+be\s+(?:completed|filled|inserted|deleted)|choose\s+one|select\s+as\s+appropriate)\b/i;

export type TemplateDetection = {
  status: TemplateStatus;
  matched: string | null;
};

export function detectTemplateStatus(text: string): TemplateDetection {
  const t = text?.trim() ?? "";
  if (!t) return { status: "NOT_TEMPLATE", matched: null };

  for (const re of TEMPLATE_INSTRUCTION_PATTERNS) {
    const m = t.match(re);
    if (m) return { status: "TEMPLATE_INSTRUCTION", matched: m[0] };
  }

  for (const re of PLACEHOLDER_PATTERNS) {
    const m = t.match(re);
    if (m) return { status: "PLACEHOLDER", matched: m[0] };
  }

  // Surrounding sentence whose meaning depends on an unresolved insert slot,
  // or a clause that wraps a template note / choose-one instruction.
  if (
    (/\b(?:not\s+later\s+than|no\s+later\s+than|commence|within)\b/i.test(t) &&
      /(?:insert|to\s+be\s+(?:completed|filled|inserted))/i.test(t)) ||
    (SURROUNDING_TEMPLATE_DEPENDENT.test(t) &&
      /\[|note\s+to\s+be\s+deleted|choose\s+(?:either|one)/i.test(t))
  ) {
    return { status: "TEMPLATE_DEPENDENT", matched: "template-dependent-clause" };
  }

  return { status: "NOT_TEMPLATE", matched: null };
}

export function isTemplateBlocked(status: TemplateStatus): boolean {
  return (
    status === "PLACEHOLDER" ||
    status === "TEMPLATE_INSTRUCTION" ||
    status === "TEMPLATE_DEPENDENT"
  );
}
