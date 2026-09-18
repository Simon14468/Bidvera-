/**
 * Lightweight document structure understanding — deterministic, no AI.
 * Tags sections so extraction filters headings, examples, and facts correctly.
 */

export type DocumentSectionKind =
  | "IDENTITY"
  | "SCOPE"
  | "ADMINISTRATIVE"
  | "TECHNICAL"
  | "ELIGIBILITY"
  | "SUBMISSION_DOCS"
  | "EVALUATION"
  | "DEADLINE"
  | "COMMERCIAL"
  | "DELIVERY"
  | "GUARANTEE"
  | "CLARIFICATION"
  | "CONTRACTUAL"
  | "INFORMATIONAL"
  | "EXAMPLE"
  | "HEADING"
  | "DISCLAIMER"
  | "UNKNOWN";

export type DocumentStructureHint = {
  dominantSections: DocumentSectionKind[];
  containsExamples: boolean;
  containsEvaluationCriteria: boolean;
  containsSubmissionRequirements: boolean;
};

const SECTION_PATTERNS: Array<{ kind: DocumentSectionKind; pattern: RegExp }> = [
  { kind: "EXAMPLE", pattern: /\b(example|sample\s+(?:scenario|question|response|tender)|test\s+case|verification\s+scenario|illustrative\s+only|for\s+illustration\s+purposes)\b/i },
  { kind: "EVALUATION", pattern: /\b(evaluation\s+criteria|award\s+criteria|scoring\s+method|ponderation|weighting|technical\s+score|financial\s+offer)\b/i },
  { kind: "ELIGIBILITY", pattern: /\b(eligibility|qualification|pre-?qualification|soumissionnaires?\s+admissibles)\b/i },
  { kind: "SUBMISSION_DOCS", pattern: /\b(documents?\s+to\s+submit|dossier\s+de\s+candidature|required\s+submissions?|bid\s+bond|provisional\s+bond|caution)\b/i },
  { kind: "TECHNICAL", pattern: /\b(technical\s+specification|cahier\s+des\s+prescriptions|scope\s+of\s+(?:work|services|supply)|sp[eé]cifications?\s+techniques?)\b/i },
  { kind: "ADMINISTRATIVE", pattern: /\b(administrative\s+requirements|instructions\s+to\s+(?:tenderers|bidders)|general\s+conditions)\b/i },
  { kind: "DEADLINE", pattern: /\b(submission\s+deadline|closing\s+date|date\s+limite|tarikh\s+tutup)\b/i },
  { kind: "COMMERCIAL", pattern: /\b(commercial\s+conditions|pricing|contract\s+value|payment\s+terms|financial\s+proposal)\b/i },
  { kind: "GUARANTEE", pattern: /\b(bank\s+guarantee|performance\s+bond|warranty\s+period|garantie\s+bancaire)\b/i },
  { kind: "DISCLAIMER", pattern: /\b(disclaimer|without\s+warranty|informational\s+purposes\s+only|avertissement)\b/i },
  { kind: "HEADING", pattern: /^(?:section|article|chapter|partie|annexe|appendix)\s+[\dIVXLC.]+/i },
];

/** Scan the full authoritative corpus for structural section signals. */
export function analyzeDocumentStructure(text: string): DocumentStructureHint {
  const sample = text;
  const lines = sample.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const kinds = new Set<DocumentSectionKind>();

  for (const line of lines) {
    for (const { kind, pattern } of SECTION_PATTERNS) {
      if (pattern.test(line)) kinds.add(kind);
    }
  }

  const dominantSections = [...kinds];
  return {
    dominantSections,
    containsExamples: kinds.has("EXAMPLE"),
    containsEvaluationCriteria: kinds.has("EVALUATION"),
    containsSubmissionRequirements: kinds.has("SUBMISSION_DOCS") || kinds.has("ELIGIBILITY"),
  };
}

/** True when line sits in an example / test / sample block (not a real obligation). */
export function isExampleOrScenarioLine(line: string, structure?: DocumentStructureHint): boolean {
  const folded = line.replace(/\s+/g, " ").trim();
  if (folded.length < 8) return false;

  if (
    /^(?:example|sample|test\s+case|scenario|verification\s+scenario|illustrative|note\s*:|exemple\s*:|cas\s+de\s+test)\b/i.test(
      folded,
    )
  ) {
    return true;
  }

  if (/^[A-Z]\.\s+(?:a\s+bidder|an\s+uploaded|the\s+deadline|if\s+document|a\s+bid\s+security)/i.test(folded)) {
    return true;
  }

  if (/\b(for\s+(?:example|illustration)\s+only|sample\s+tender\s+response|mock\s+bid)\b/i.test(folded)) {
    return true;
  }

  if (structure?.containsExamples && /^\d+\.\s*(?:example|sample|test)/i.test(folded)) {
    return true;
  }

  return false;
}
