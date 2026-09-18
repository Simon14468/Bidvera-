import type { QuestionnaireQuestionType } from "./types";

const YES_NO =
  /\b(?:yes\s*\/\s*no|y\s*\/\s*n|tick\s+(?:yes|no)|check\s+(?:yes|no)|☐\s*yes|☑\s*no)\b/i;

const NUMERIC =
  /\b(?:how\s+many|number\s+of|quantity|amount|count|total\s+(?:staff|employees|fte)|%\s*|percentage)\b/i;

const DATE =
  /\b(?:date|deadline|when\s+(?:was|did|will)|dd\s*\/\s*mm|yyyy|calendar\s+year)\b/i;

const ATTACHMENT =
  /\b(?:attach|upload|enclose|provide\s+(?:a\s+)?(?:copy|certificate|document|evidence|proof)|supporting\s+document|schedule\s+of)\b/i;

const MULTI =
  /\b(?:select\s+all\s+that\s+apply|all\s+that\s+apply|multiple\s+(?:choice|answers?)|tick\s+all)\b/i;

const SINGLE =
  /\b(?:select\s+one|choose\s+one|single\s+choice|tick\s+one|circle\s+one)\b/i;

/** Extract a)/b)/1)/2) style options from surrounding lines. */
export function extractAnswerOptions(block: string): string[] {
  const options: string[] = [];
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const m = line.trim().match(/^(?:[\(\[]?[a-dA-D0-9][\)\].:]|\-|•)\s+(.{1,120})$/);
    if (m?.[1] && !/[?]/.test(m[1])) {
      options.push(m[1].trim());
    }
  }
  return [...new Set(options)].slice(0, 12);
}

export function inferQuestionType(
  text: string,
  options: string[],
): QuestionnaireQuestionType {
  if (YES_NO.test(text) || (options.length === 2 && /^(yes|no)$/i.test(options[0]!) && /^(yes|no)$/i.test(options[1]!))) {
    return "YES_NO";
  }
  if (ATTACHMENT.test(text)) return "ATTACHMENT";
  if (DATE.test(text) && !NUMERIC.test(text)) return "DATE";
  if (NUMERIC.test(text)) return "NUMERIC";
  if (MULTI.test(text) || (options.length >= 2 && MULTI.test(text))) {
    return "MULTIPLE_CHOICE";
  }
  if (SINGLE.test(text) || options.length >= 2) {
    return options.length >= 2 ? "SINGLE_CHOICE" : "SINGLE_CHOICE";
  }
  if (options.length >= 2) return "SINGLE_CHOICE";
  if (/\?/.test(text) || /^(?:please\s+)?(?:provide|describe|state|confirm|indicate)\b/i.test(text)) {
    return "TEXT";
  }
  return "UNKNOWN";
}
