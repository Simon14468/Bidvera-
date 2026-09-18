/**
 * Derive validity from actual dates found in evidence text — never invent expiry.
 */

import type { EvidenceValidityState } from "./types";

const MONTH_NAMES =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

const EXPIRY_LINE =
  /\b(?:valid\s+until|expires?\s+(?:on|at)?|expiry\s*(?:date)?[:\s]+|expiration[:\s]+)\s*([^\n.;]{4,40})/i;

const EXPIRY_PATTERNS: Array<{
  re: RegExp;
  group: number;
  monthYear?: boolean;
}> = [
  {
    re: EXPIRY_LINE,
    group: 1,
    monthYear: true,
  },
  {
    re: new RegExp(
      `\\b(?:valid\\s+until|expires?\\s+(?:on|at)?|expiry\\s*(?:date)?[:\\s]+|expiration[:\\s]+)\\s*(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{4}[\\/-]\\d{1,2}[\\/-]\\d{1,2})`,
      "i",
    ),
    group: 1,
  },
  {
    re: new RegExp(
      `\\b(?:valid\\s+until|expires?|expiry)[:\\s]+(\\d{1,2}\\s+${MONTH_NAMES}[a-z]*\\s+\\d{4})`,
      "i",
    ),
    group: 1,
  },
];

const ISSUE_PATTERNS: Array<{ re: RegExp; group: number }> = [
  {
    re: new RegExp(
      `\\b(?:issued\\s+(?:on|at)?|issue\\s+date[:\\s]+|dated[:\\s]+)\\s*(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|${MONTH_NAMES}[a-z]*\\s+\\d{1,2},?\\s+\\d{4})`,
      "i",
    ),
    group: 1,
  },
];

const EXPIRING_SOON_DAYS = 90;

function parseLooseDate(raw: string, monthYear = false): Date | null {
  const trimmed = raw.trim();
  const monthYearMatch = trimmed.match(
    new RegExp(`^(${MONTH_NAMES})[a-z]*\\s+(\\d{4})$`, "i"),
  );
  if (monthYearMatch) {
    const parsed = new Date(`${monthYearMatch[1]!} 1, ${monthYearMatch[2]!}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (monthYear) {
    return null;
  }
  const iso = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    const d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractFirstDate(
  text: string,
  patterns: Array<{ re: RegExp; group: number; monthYear?: boolean }>,
): string | null {
  for (const { re, group, monthYear } of patterns) {
    const m = text.match(re);
    if (m?.[group]) {
      const d = parseLooseDate(m[group]!, monthYear);
      if (d) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function deriveEvidenceValidity(input: {
  excerpt: string | null;
  referenceDate?: Date;
}): {
  issueDate: string | null;
  expiryDate: string | null;
  validityState: EvidenceValidityState;
} {
  const text = input.excerpt?.trim() ?? "";
  if (!text) {
    return { issueDate: null, expiryDate: null, validityState: "UNKNOWN" };
  }

  const issueDate = extractFirstDate(text, ISSUE_PATTERNS);
  const expiryDate = extractFirstDate(text, EXPIRY_PATTERNS);

  if (!expiryDate) {
    return { issueDate, expiryDate: null, validityState: "UNKNOWN" };
  }

  const ref = input.referenceDate ?? new Date();
  const expiry = new Date(expiryDate);
  const msPerDay = 86_400_000;
  const daysUntil = Math.ceil((expiry.getTime() - ref.getTime()) / msPerDay);

  if (daysUntil < 0) {
    return { issueDate, expiryDate, validityState: "EXPIRED" };
  }
  if (daysUntil <= EXPIRING_SOON_DAYS) {
    return { issueDate, expiryDate, validityState: "EXPIRING_SOON" };
  }
  return { issueDate, expiryDate, validityState: "VALID" };
}
