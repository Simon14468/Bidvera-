/**
 * Authoritative semantic compatibility model.
 *
 * Three orthogonal dimensions — never collapse into one:
 * - semanticKind  → WHAT the bidder must do / submit / satisfy
 * - category      → BUSINESS DOMAIN of that requirement
 * - obligationStrength → HOW binding (MANDATORY / CONDITIONAL / OPTIONAL / INFORMATIONAL)
 *
 * All normalize / merge / final-consistency / certification checks MUST use this module.
 */

import type { RequirementCategory } from "./types";
import type { ObligationStrength, RequirementSemanticKind } from "./semantic-kind";

/** Domain categories that may host a scoring / bidder obligation. */
const SCORING_DOMAINS = [
  "MANDATORY_ELIGIBILITY",
  "MANDATORY_TECHNICAL",
  "MANDATORY_ADMINISTRATIVE",
  "CONTRACTUAL",
  "EVALUATION",
  "PREFERRED",
] as const satisfies readonly RequirementCategory[];

/**
 * Compatible business-domain categories per semantic kind.
 * REQUIRED_DOCUMENT describes submission shape — domain may be technical, admin, etc.
 */
export const SEMANTIC_KIND_COMPATIBLE_CATEGORIES: Record<
  RequirementSemanticKind,
  readonly RequirementCategory[]
> = {
  REQUIRED_DOCUMENT: [
    "MANDATORY_ADMINISTRATIVE",
    "MANDATORY_TECHNICAL",
    "MANDATORY_ELIGIBILITY",
    "CONTRACTUAL",
    "PREFERRED",
  ],
  TECHNICAL_REQUIREMENT: ["MANDATORY_TECHNICAL", "PREFERRED", "CONTRACTUAL"],
  PERFORMANCE_OBLIGATION: ["MANDATORY_TECHNICAL", "CONTRACTUAL", "PREFERRED"],
  ADMINISTRATIVE_REQUIREMENT: ["MANDATORY_ADMINISTRATIVE", "PREFERRED", "CONTRACTUAL"],
  ELIGIBILITY_REQUIREMENT: ["MANDATORY_ELIGIBILITY", "PREFERRED"],
  FINANCIAL_COMMERCIAL_CONDITION: [
    "MANDATORY_ELIGIBILITY",
    "CONTRACTUAL",
    "MANDATORY_ADMINISTRATIVE",
    "PREFERRED",
  ],
  GUARANTEE_SECURITY_REQUIREMENT: [
    "MANDATORY_ADMINISTRATIVE",
    "MANDATORY_ELIGIBILITY",
    "CONTRACTUAL",
    "PREFERRED",
  ],
  CONTRACTUAL_OBLIGATION: ["CONTRACTUAL", "MANDATORY_TECHNICAL", "PREFERRED"],
  EVALUATION_CRITERION: ["EVALUATION", "INFORMATIONAL"],
  DEADLINE: ["INFORMATIONAL"],
  CLARIFICATION_PROCEDURAL: ["INFORMATIONAL"],
  INFORMATIONAL_FACT: ["INFORMATIONAL"],
  REVIEWER_INSTRUCTION: ["INFORMATIONAL"],
  TEST_SCENARIO: ["INFORMATIONAL"],
  QA_META: ["INFORMATIONAL"],
  UNKNOWN: [...SCORING_DOMAINS, "INFORMATIONAL", "CONTRACTUAL"],
};

/**
 * Compatible obligation strengths per semantic kind.
 * Non-scoring kinds are informational only.
 */
export const SEMANTIC_KIND_COMPATIBLE_STRENGTHS: Record<
  RequirementSemanticKind,
  readonly ObligationStrength[]
> = {
  // INFORMATIONAL allowed on scoring kinds for fail-safe NEEDS_VERIFICATION
  // (e.g. lost conditional trigger) — never promotes to confirmed mandatory.
  REQUIRED_DOCUMENT: ["MANDATORY", "CONDITIONAL", "OPTIONAL", "INFORMATIONAL"],
  TECHNICAL_REQUIREMENT: ["MANDATORY", "CONDITIONAL", "OPTIONAL", "INFORMATIONAL"],
  PERFORMANCE_OBLIGATION: ["MANDATORY", "CONDITIONAL", "OPTIONAL", "INFORMATIONAL"],
  ADMINISTRATIVE_REQUIREMENT: ["MANDATORY", "CONDITIONAL", "OPTIONAL", "INFORMATIONAL"],
  ELIGIBILITY_REQUIREMENT: ["MANDATORY", "CONDITIONAL", "OPTIONAL", "INFORMATIONAL"],
  FINANCIAL_COMMERCIAL_CONDITION: [
    "MANDATORY",
    "CONDITIONAL",
    "OPTIONAL",
    "INFORMATIONAL",
  ],
  GUARANTEE_SECURITY_REQUIREMENT: [
    "MANDATORY",
    "CONDITIONAL",
    "OPTIONAL",
    "INFORMATIONAL",
  ],
  CONTRACTUAL_OBLIGATION: ["MANDATORY", "CONDITIONAL", "OPTIONAL", "INFORMATIONAL"],
  EVALUATION_CRITERION: ["INFORMATIONAL"],
  DEADLINE: ["INFORMATIONAL"],
  CLARIFICATION_PROCEDURAL: ["INFORMATIONAL"],
  INFORMATIONAL_FACT: ["INFORMATIONAL"],
  REVIEWER_INSTRUCTION: ["INFORMATIONAL"],
  TEST_SCENARIO: ["INFORMATIONAL"],
  QA_META: ["INFORMATIONAL"],
  UNKNOWN: ["INFORMATIONAL", "OPTIONAL", "CONDITIONAL"],
};

/** Default domain category when none is provided (fallback only — not the sole valid value). */
export function defaultCategoryForSemanticKind(
  kind: RequirementSemanticKind,
): RequirementCategory {
  const allowed = SEMANTIC_KIND_COMPATIBLE_CATEGORIES[kind];
  return allowed[0] ?? "CONTRACTUAL";
}

/** Use sealed STI category when compatible; never infer a new domain from keywords. */
export function categoryFromSealedSemantics(input: {
  semanticKind: RequirementSemanticKind;
  preferredCategory?: string | null;
}): RequirementCategory {
  const allowed = SEMANTIC_KIND_COMPATIBLE_CATEGORIES[input.semanticKind];
  const mapped = input.preferredCategory
    ? mapLooseCategoryHint(input.preferredCategory)
    : null;
  if (mapped && allowed.includes(mapped)) return mapped;
  return defaultCategoryForSemanticKind(input.semanticKind);
}

export function compatibleCategoriesForSemanticKind(
  kind: RequirementSemanticKind,
): readonly RequirementCategory[] {
  return SEMANTIC_KIND_COMPATIBLE_CATEGORIES[kind];
}

export function isCategoryCompatibleWithSemanticKind(
  kind: RequirementSemanticKind,
  category: RequirementCategory,
): boolean {
  return SEMANTIC_KIND_COMPATIBLE_CATEGORIES[kind].includes(category);
}

export function isStrengthCompatibleWithSemanticKind(
  kind: RequirementSemanticKind,
  strength: ObligationStrength,
): boolean {
  return SEMANTIC_KIND_COMPATIBLE_STRENGTHS[kind].includes(strength);
}

export type SemanticTriple = {
  semanticKind: RequirementSemanticKind;
  category: RequirementCategory;
  obligationStrength: ObligationStrength;
};

/**
 * Authoritative triple check used by normalize, merge, final-consistency, and certification.
 */
export function isSemanticTripleCompatible(triple: SemanticTriple): boolean {
  return (
    isCategoryCompatibleWithSemanticKind(triple.semanticKind, triple.category) &&
    isStrengthCompatibleWithSemanticKind(triple.semanticKind, triple.obligationStrength)
  );
}

/**
 * Prefer an explicit domain category when compatible; otherwise fall back to default.
 * Optional PREFERRED demotion for optional strength on mandatory-shaped domains.
 */
export function resolveCompatibleCategory(input: {
  semanticKind: RequirementSemanticKind;
  preferredCategory?: RequirementCategory | string | null;
  obligationStrength: ObligationStrength;
  description?: string | null;
}): RequirementCategory {
  const kind = input.semanticKind;
  const preferred = input.preferredCategory;
  const allowed = SEMANTIC_KIND_COMPATIBLE_CATEGORIES[kind];

  let category: RequirementCategory = defaultCategoryForSemanticKind(kind);

  if (preferred && typeof preferred === "string") {
    const mapped = mapLooseCategoryHint(preferred);
    if (mapped && allowed.includes(mapped)) {
      category = mapped;
    }
  }

  // When draft category is weak/generic, infer domain from text (esp. REQUIRED_DOCUMENT).
  if (
    (!preferred ||
      /^(technical|administrative|eligibility|documentation|requirement|x|info|submission)$/i.test(
        String(preferred).trim(),
      )) &&
    input.description
  ) {
    const inferred = inferDomainCategoryFromText(input.description);
    if (inferred && allowed.includes(inferred)) {
      category = inferred;
    }
  } else if (input.description && kind === "REQUIRED_DOCUMENT") {
    const inferred = inferDomainCategoryFromText(input.description);
    if (inferred && allowed.includes(inferred)) {
      // Prefer text-inferred domain over default ADMIN when draft was also default-ish
      if (
        !preferred ||
        mapLooseCategoryHint(String(preferred)) === defaultCategoryForSemanticKind(kind)
      ) {
        category = inferred;
      }
    }
  }

  if (
    input.obligationStrength === "OPTIONAL" &&
    (category === "MANDATORY_ELIGIBILITY" ||
      category === "MANDATORY_TECHNICAL" ||
      category === "MANDATORY_ADMINISTRATIVE") &&
    allowed.includes("PREFERRED")
  ) {
    return "PREFERRED";
  }

  if (!allowed.includes(category)) {
    return defaultCategoryForSemanticKind(kind);
  }
  return category;
}

/**
 * After independent preferCategory / preferSemanticKind merges, re-canonicalize
 * so the surviving triple remains compatible.
 */
export function reconcileMergedSemanticTriple(input: {
  semanticKind: RequirementSemanticKind;
  category: RequirementCategory;
  obligationStrength: ObligationStrength;
}): SemanticTriple {
  let strength = input.obligationStrength;
  if (!isStrengthCompatibleWithSemanticKind(input.semanticKind, strength)) {
    strength = SEMANTIC_KIND_COMPATIBLE_STRENGTHS[input.semanticKind][0] ?? "INFORMATIONAL";
  }
  const category = resolveCompatibleCategory({
    semanticKind: input.semanticKind,
    preferredCategory: input.category,
    obligationStrength: strength,
  });
  return {
    semanticKind: input.semanticKind,
    category,
    obligationStrength: strength,
  };
}

function mapLooseCategoryHint(raw: string): RequirementCategory | null {
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (
    upper === "MANDATORY_TECHNICAL" ||
    upper === "TECHNICAL" ||
    /\btechnical\b/i.test(raw)
  ) {
    return "MANDATORY_TECHNICAL";
  }
  if (
    upper === "MANDATORY_ADMINISTRATIVE" ||
    upper === "ADMINISTRATIVE" ||
    /\badmin/i.test(raw)
  ) {
    return "MANDATORY_ADMINISTRATIVE";
  }
  if (
    upper === "MANDATORY_ELIGIBILITY" ||
    upper === "ELIGIBILITY" ||
    upper === "FINANCIAL" ||
    /\b(eligib|financial|experience)\b/i.test(raw)
  ) {
    return "MANDATORY_ELIGIBILITY";
  }
  if (upper === "CONTRACTUAL" || /\bcontract/i.test(raw)) {
    return "CONTRACTUAL";
  }
  if (upper === "EVALUATION" || /\bevaluat/i.test(raw)) {
    return "EVALUATION";
  }
  if (upper === "PREFERRED" || /\bpreferred|optional\b/i.test(raw)) {
    return "PREFERRED";
  }
  if (upper === "INFORMATIONAL") return "INFORMATIONAL";
  const exact = [
    "MANDATORY_ELIGIBILITY",
    "MANDATORY_TECHNICAL",
    "MANDATORY_ADMINISTRATIVE",
    "CONTRACTUAL",
    "EVALUATION",
    "PREFERRED",
    "INFORMATIONAL",
  ] as const;
  if ((exact as readonly string[]).includes(upper)) {
    return upper as RequirementCategory;
  }
  return null;
}

/** Infer domain category cues from requirement text when draft category is weak. */
export function inferDomainCategoryFromText(description: string): RequirementCategory | null {
  const t = description.toLowerCase();
  if (
    /\b(technical\s+spec|specification|equipment|install|software|hardware|performance\s+spec|datasheet|brochure|manual)\b/i.test(
      t,
    )
  ) {
    return "MANDATORY_TECHNICAL";
  }
  if (
    /\b(eligib|qualification|turnover|experience|years?\s+of|financial\s+capacity|registered\s+capital)\b/i.test(
      t,
    )
  ) {
    return "MANDATORY_ELIGIBILITY";
  }
  if (
    /\b(payment\s+terms|price\s+schedule|financial\s+offer|turnover\s+threshold|minimum\s+turnover)\b/i.test(
      t,
    )
  ) {
    return "MANDATORY_ELIGIBILITY";
  }
  if (
    /\b(bid\s+security|performance\s+(?:bond|guarantee)|caution(?:nement)?|provisional\s+bond|bank\s+guarantee)\b/i.test(
      t,
    )
  ) {
    return "MANDATORY_ADMINISTRATIVE";
  }
  if (
    /\b(contract\s+clause|warranty\s+period|liability|penalt|termination|insurance)\b/i.test(t)
  ) {
    return "CONTRACTUAL";
  }
  if (/\b(evaluation\s+criteria|scoring|weighting|marks?\s+allocated)\b/i.test(t)) {
    return "EVALUATION";
  }
  if (
    /\b(submit|certificate|attestation|registration|clearance|forms?|dossier|administrative)\b/i.test(
      t,
    )
  ) {
    return "MANDATORY_ADMINISTRATIVE";
  }
  return null;
}
