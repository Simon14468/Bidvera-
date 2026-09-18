/**
 * Prompt-injection detection — tender obligations remain usable as DATA.
 */

import type {
  InstructionLikeClassification,
  InstructionLikeSegment,
  TrustScanResult,
} from "./types";

/** Attempts to hijack the AI / application — never execute. */
export const SYSTEM_OVERRIDE_PATTERNS: ReadonlyArray<{
  id: string;
  re: RegExp;
}> = [
  { id: "IGNORE_PREVIOUS_INSTRUCTIONS", re: /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b/i },
  { id: "IGNORE_SYSTEM_RULES", re: /\bignore\s+(system|security|all\s+rules?)\b/i },
  { id: "YOU_ARE_NOW", re: /\byou\s+are\s+now\b/i },
  { id: "OVERRIDE_DECISION", re: /\boverride\s+(decision|engine|rules?|policy|security)\b/i },
  { id: "SYSTEM_PREFIX", re: /\bsystem\s*:\s*/i },
  { id: "EXECUTE_CODE", re: /\bexecute\s+(code|command|sql|script)\b/i },
  { id: "SCRIPT_TAG", re: /\b<\/?script\b/i },
  { id: "REVEAL_SECRETS", re: /\b(reveal|print|dump|expose)\s+(api\s*key|secret|password|token|env|prompt)\b/i },
  { id: "REVEAL_PROMPT", re: /\breveal\s+your\s+prompt\b/i },
  { id: "APPROVE_TENDER", re: /\bignore\s+.+?\s+and\s+(approve|accept|bid|go)\b/i },
  { id: "ALWAYS_RETURN_GO", re: /\balways\s+return\s+(go|bid|approve)\b/i },
  { id: "CHANGE_SCORE", re: /\b(set|change|force)\s+(fit\s*score|decision|readiness)\s*(to|=)\s*\d+/i },
];

/** Legitimate tender language — obligations, eligibility, deadlines (DATA). */
export const LEGITIMATE_TENDER_OBLIGATION_PATTERNS: ReadonlyArray<{
  id: string;
  re: RegExp;
}> = [
  { id: "MUST_SUBMIT", re: /\b(must|shall|should)\s+(submit|provide|furnish|deliver|include)\b/i },
  { id: "BIDDER_OBLIGATION", re: /\b(bidders?|tenderers?|candidates?)\s+(must|shall|are\s+required\s+to)\b/i },
  { id: "DEADLINE", re: /\b(deadline|closing\s+date|due\s+date|before\s+\d)/i },
  { id: "ELIGIBILITY", re: /\b(eligibility|eligible|qualification|mandatory\s+requirement)\b/i },
  { id: "DISQUALIFICATION", re: /\b(disqualif|rejection|non[- ]compliance)\b/i },
  { id: "EVALUATION", re: /\b(evaluation\s+criteria|award\s+criteria|scoring)\b/i },
];

export function isLegitimateTenderObligation(text: string): boolean {
  const sample = text.slice(0, 500);
  return LEGITIMATE_TENDER_OBLIGATION_PATTERNS.some(({ re }) => re.test(sample));
}

export function classifyInstructionLikeSegment(
  text: string,
  patternId?: string,
): InstructionLikeClassification {
  const criticalOverride = new Set([
    "IGNORE_PREVIOUS_INSTRUCTIONS",
    "IGNORE_SYSTEM_RULES",
    "REVEAL_SECRETS",
    "REVEAL_PROMPT",
    "CHANGE_SCORE",
    "APPROVE_TENDER",
    "ALWAYS_RETURN_GO",
    "EXECUTE_CODE",
    "SCRIPT_TAG",
  ]);
  if (patternId && criticalOverride.has(patternId)) {
    return "SYSTEM_OVERRIDE_ATTEMPT";
  }

  const sample = text.slice(0, 600);
  for (const { re } of SYSTEM_OVERRIDE_PATTERNS) {
    if (re.test(sample)) {
      if (
        isLegitimateTenderObligation(sample) &&
        !/\bignore\s+(all\s+)?(previous|prior)/i.test(sample)
      ) {
        continue;
      }
      return "SYSTEM_OVERRIDE_ATTEMPT";
    }
  }
  if (isLegitimateTenderObligation(sample)) {
    return "LEGITIMATE_TENDER_OBLIGATION";
  }
  return "NONE";
}

function extractMatchSnippet(text: string, match: RegExpExecArray, maxLen = 120): string {
  const start = Math.max(0, match.index - 20);
  const end = Math.min(text.length, match.index + match[0].length + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/**
 * Scan tender content for instruction-like segments.
 * Does NOT remove or block content — flags only. Legitimate obligations remain DATA.
 */
export function scanTenderContentForInjection(text: string): TrustScanResult {
  const segments: InstructionLikeSegment[] = [];
  const seen = new Set<string>();
  const sample = text;

  for (const { id, re } of SYSTEM_OVERRIDE_PATTERNS) {
    const match = re.exec(sample);
    if (!match) continue;

    const snippet = extractMatchSnippet(sample, match);
    const key = `${id}:${snippet.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);

      const classification = classifyInstructionLikeSegment(snippet, id);
    if (classification === "NONE") continue;

    segments.push({
      text: snippet,
      classification,
      patternId: id,
      startIndex: match.index,
    });

    if (segments.length >= 24) break;
  }

  const legitimateObligationCount = segments.filter(
    (s) => s.classification === "LEGITIMATE_TENDER_OBLIGATION",
  ).length;

  return {
    scannedCharCount: sample.length,
    segments,
    hasSystemOverrideAttempt: segments.some(
      (s) => s.classification === "SYSTEM_OVERRIDE_ATTEMPT",
    ),
    legitimateObligationCount,
  };
}

/** Shared patterns for structured user input (simulator, workflow notes). */
export function assertNoSystemOverrideInStructuredText(
  text: string,
  context: string,
): void {
  for (const { re } of SYSTEM_OVERRIDE_PATTERNS) {
    if (re.test(text)) {
      throw new Error(`${context}: disallowed instruction-like content.`);
    }
  }
}

export function getSystemOverridePatternsForTests(): RegExp[] {
  return SYSTEM_OVERRIDE_PATTERNS.map((p) => p.re);
}
