/**
 * Semantic deduplication — merge paraphrased obligations from AI, regex, and harvest paths.
 */

import type { NormalizedRequirement, RequirementCategory } from "./types";
import { isMandatoryCategory } from "./classify";
import type { RequirementSemanticKind } from "./semantic-kind";
import {
  hasConditionalTriggerContext,
  preferObligationStrengthPreservingConditionality,
  reconcileConditionalObligation,
} from "./conditional-context";
import { reconcileMergedSemanticTriple } from "./semantic-compatibility";
import {
  decodeLotFromSourceSection,
  encodeLotIntoSourceSection,
  formatLotApplicability,
  mergeLotApplicability,
  parseLotApplicabilityLabel,
  type LotApplicability,
} from "./lot-applicability";
import { lifecycleIdentityFamily } from "@/domain/semantic-tender-intelligence/phase";
import {
  normalizeSemanticSurface,
  semanticIdentityFacets,
} from "@/domain/semantic-tender-intelligence/identity";

function resolveLot(item: NormalizedRequirement): LotApplicability {
  if (item.lotApplicability) return parseLotApplicabilityLabel(item.lotApplicability);
  return decodeLotFromSourceSection(item.sourceSection);
}

function categoryRank(category: RequirementCategory | string): number {
  if (typeof category === "string" && category.startsWith("MANDATORY")) return 3;
  if (category === "CONTRACTUAL") return 2;
  if (category === "PREFERRED" || category === "EVALUATION") return 1;
  return 0;
}

function preferCategory(
  a: RequirementCategory,
  b: RequirementCategory,
): RequirementCategory {
  return categoryRank(a) >= categoryRank(b) ? a : b;
}

function preferSemanticKind(
  a: RequirementSemanticKind,
  b: RequirementSemanticKind,
): RequirementSemanticKind {
  if (a === "UNKNOWN") return b;
  if (b === "UNKNOWN") return a;
  if (a === b) return a;
  const specificity: Record<RequirementSemanticKind, number> = {
    REQUIRED_DOCUMENT: 5,
    GUARANTEE_SECURITY_REQUIREMENT: 5,
    ELIGIBILITY_REQUIREMENT: 4,
    TECHNICAL_REQUIREMENT: 4,
    PERFORMANCE_OBLIGATION: 4,
    FINANCIAL_COMMERCIAL_CONDITION: 4,
    ADMINISTRATIVE_REQUIREMENT: 3,
    CONTRACTUAL_OBLIGATION: 3,
    EVALUATION_CRITERION: 1,
    DEADLINE: 1,
    CLARIFICATION_PROCEDURAL: 1,
    INFORMATIONAL_FACT: 0,
    REVIEWER_INSTRUCTION: 0,
    TEST_SCENARIO: 0,
    QA_META: 0,
    UNKNOWN: 0,
  };
  return specificity[a] >= specificity[b] ? a : b;
}

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "that",
  "this",
  "with",
  "from",
  "shall",
  "must",
  "will",
  "have",
  "been",
  "their",
  "they",
  "which",
  "including",
  "together",
  "tender",
  "bidder",
  "bidders",
  "supplier",
  "required",
  "mandatory",
  "obligatoire",
]);

export type ObligationFingerprintContext = {
  lotLabel?: string | null;
  conditionText?: string | null;
  procurementPhase?: string | null;
  actor?: string | null;
  versionLabel?: string | null;
};

/**
 * Bidder-stage phases share one obligation family so STI labels
 * (EVALUATION vs BID_SUBMISSION vs missing) cannot fork the same duty.
 * Post-award, award, and mixed stay distinct. Does not change STI admission.
 */
export function canonicalLifecycleFamily(phase: string | null | undefined): string {
  const p = (phase ?? "").trim();
  if (!p || p === "UNKNOWN" || p === "EVALUATION") return "pre";
  return lifecycleIdentityFamily(p);
}

function canonicalActorFamily(actor: string | null | undefined): string {
  const a = fold(actor ?? "");
  if (
    /^(authority|buyer|purchaser|employer|client|procuring_entity|contracting_authority)$/.test(
      a,
    )
  ) {
    return "authority";
  }
  return "bidder";
}

function obligationPolarity(text: string): "neg" | "pos" {
  return /\b(?:shall\s+not|must\s+not|may\s+not|is\s+not\s+required|are\s+not\s+required|not\s+required|no\s+longer\s+required)\b/i.test(
    text,
  )
    ? "neg"
    : "pos";
}

function leftoverMaterialClaims(text: string): string {
  const facets = fold(semanticIdentityFacets(text));
  const claims = [
    ...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g),
    ...text.matchAll(/\b(?:usd|eur|gbp|mad|dh)\s*[\d,.]+|[\d,.]+\s*(?:usd|eur|gbp|mad|dh)\b/gi),
  ]
    .map((m) => fold(m[1] ? `${m[1]}pct` : m[0]).replace(/[.,]+$/g, ""))
    .filter((c) => c && !facets.includes(c));
  return [...new Set(claims)].sort().join("/");
}

/** One typed class so sparse paraphrases still collide; lot/condition remain in scope. */
function primaryFingerprintKey(keys: string[]): string {
  const score = (k: string): number => {
    if (k.startsWith("cert-")) return 100;
    if (k.startsWith("provisional-bond-") && k !== "provisional-bond") return 90;
    if (k.startsWith("experience-") && /-\d+y/.test(k)) return 80;
    if (k.startsWith("warranty-") && k !== "warranty") return 70;
    if (k.startsWith("performance-guarantee-")) return 70;
    if (k === "provisional-bond") return 60;
    if (k.startsWith("scope-of-supply")) return 40;
    return 20;
  };
  return [...keys].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0]!;
}

/**
 * Stable obligation fingerprint — same real obligation → same key even when paraphrased.
 * Lot labels are merged after identity (union), never expanded to ALL_LOTS.
 * Decorative prefixes / numbering are stripped via the STI surface normalizer.
 */
export function obligationFingerprint(
  description: string,
  category: RequirementCategory | string,
  context?: ObligationFingerprintContext,
): string {
  const text = normalizeSemanticSurface(description);
  const keys: string[] = [];
  const condSuffix = context?.conditionText?.trim()
    ? `|cond:${fold(context.conditionText).slice(0, 80)}`
    : "";
  const lifeSuffix = `|life:${canonicalLifecycleFamily(context?.procurementPhase)}`;
  const actorSuffix = `|actor:${canonicalActorFamily(context?.actor)}`;
  const polaritySuffix = `|pol:${obligationPolarity(description)}`;
  const facets = semanticIdentityFacets(description);
  const facetSuffix = facets === "facet:none" ? "" : `|${facets}`;
  const leftover = leftoverMaterialClaims(description);
  const claimsSuffix = leftover ? `|claims:${leftover}` : "";
  const identitySuffix =
    condSuffix + lifeSuffix + actorSuffix + polaritySuffix + facetSuffix + claimsSuffix;

  // Scope-of-supply family — paraphrases of the same goods/works duty share one class.
  // Object noun (system/equipment) keeps unrelated supply duties apart.
  if (
    /\b(?:supply|fournir)\b/.test(text) &&
    /\b(?:system|equipment|goods|works|items|installation)\b/.test(text) &&
    !/warranty|garantie|bid\s+security|caution|iso\s*\d+/.test(text)
  ) {
    const object = text.match(
      /\b([a-z]{4,})\s+(?:system|equipment|goods|works|items)\b/i,
    );
    const objectKey =
      object?.[1] && !STOP.has(fold(object[1])) ? fold(object[1]) : "generic";
    keys.push(`scope-of-supply-${objectKey}`);
  }
  if (/warranty|garantie/.test(text)) {
    const months = text.match(/(\d+)\s*[-–]?\s*(?:months?|mois|month)/);
    keys.push(months ? `warranty-${months[1]}m` : "warranty");
  }
  if (
    /caution\s+provisoire|provisional\s+(?:bond|guarantee|bid\s+security)|provisional\s+bid\s+security|bid\s+security|bid\s+bond/.test(
      text,
    )
  ) {
    const amount = text.match(/mad\s*[\d,.]+|[\d,.]+\s*(?:mad|dh)\b/i);
    const pctDigit = text.match(/(\d+)\s*%/);
    const pctWord = text.match(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+percent\b/,
    );
    const normalizedAmount = amount
      ? amount[0].replace(/\s+/g, "").replace(/[.,]+$/g, "").toLowerCase()
      : null;
    const pct = pctDigit?.[1] ?? pctWord?.[1] ?? null;
    keys.push(
      normalizedAmount
        ? `provisional-bond-${normalizedAmount}`
        : pct
          ? `provisional-bond-${pct}pct`
          : "provisional-bond",
    );
  }
  if (/caution\s+definitive|performance\s+bond|performance\s+guarantee/.test(text)) {
    const pct = text.match(/(\d+)\s*%/);
    keys.push(pct ? `performance-guarantee-${pct[1]}pct` : "performance-guarantee");
  }
  if (/implementation\s+schedule|commissioning\s+plan/.test(text)) {
    keys.push("implementation-schedule-commissioning");
  }
  if (/social\s+security|securite\s+sociale|s[eé]curit[eé]\s+sociale/.test(text)) {
    keys.push("social-security-registration");
  }
  if (/tax\s+clearance|regularit[eé]\s+fiscale|situation\s+fiscale/.test(text)) {
    keys.push("tax-clearance");
  }

  // Distinguish required-document evidence from underlying capability.
  // "submit reference letters proving experience" ≠ "must have 5 years experience".
  const isEvidenceDocument =
    /\b(submit|soumettre|fournir|provide|attach|enclose|certificate|attestation|letters?|dossier|documents?)\b/i.test(
      text,
    ) &&
    /\b(proving|evidence|proof|demonstrat|attest|supporting|as\s+evidence)\b/i.test(text);

  // Experience evidence dedupe:
  // "reference" can appear in non-experience contexts (e.g. "equipment reference"),
  // so only treat "reference" as experience when framed as comparable/previous works.
  const hasExperienceWord = /\b(experience|exp[eé]rience)\b/i.test(text);
  const hasReferenceAsExperienceContext =
    /\b(r[eé]f[eé]rence|reference)\b/i.test(text) &&
    /\b(comparable|contract|contracts|project|projects|works?|completed|previous|similar|minimum|minim(?:um|ale)|years?|ann)\b/i.test(
      text,
    );

  if (hasExperienceWord || hasReferenceAsExperienceContext) {
    const parenYears = text.match(/\(\s*(\d+)\s*\)\s*(?:years?|ann)/);
    const years = text.match(/(\d+)\s*(?:years?|ann[eé]es?)/);
    const resolved = parenYears?.[1] ?? years?.[1];

    const scopeMatch = text.match(
      /(?:experience|exp[eé]rience)(?:\s+(?:in|of|with|dans|en))?\s+(.{0,48})/i,
    );
    const scopeTokens = (scopeMatch?.[1] ?? "")
      .replace(/[^a-z0-9\u0600-\u06ff\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
      .slice(0, 4)
      .join("-");
    const scopeKey = scopeTokens || "generic";
    if (isEvidenceDocument) {
      keys.push(
        resolved
          ? `experience-evidence-doc-${resolved}y-${scopeKey}`
          : `experience-evidence-doc-${scopeKey}`,
      );
    } else {
      keys.push(resolved ? `experience-${resolved}y-${scopeKey}` : `experience-${scopeKey}`);
    }
  }
  if (/iso\s*\d+/.test(text)) {
    const iso = text.match(/iso\s*\d+(?::\d+)?/);
    keys.push(`cert-${iso?.[0]?.replace(/\s+/g, "") ?? "iso"}`);
  }
  if (/24\s*\/\s*7/.test(text)) keys.push("support-247");
  if (/chiffre\s+d['']affaires|turnover|annual\s+revenue/.test(text)) keys.push("turnover");
  if (/registre\s+de\s+commerce|certificate\s+of\s+incorporation|\bssm\b/.test(text)) {
    keys.push("company-registration");
  }
  if (/registered\s+office|legal\s+domicile|siege\s+social|si[eè]ge\s+social/.test(text)) {
    keys.push("registered-office");
  }

  if (keys.length > 0) {
    return primaryFingerprintKey(keys) + identitySuffix;
  }

  const words = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length > 3 || /^\d/.test(w)) && !STOP.has(w))
    .sort()
    .slice(0, 10)
    .join(" ");
  // Category is a classifier, not identity — same text under diverging
  // categories is still one obligation.
  void category;
  return (words || text.slice(0, 80)) + identitySuffix;
}

export type CanonicalObligationIdentityInput = {
  requirement: string;
  category: string;
  lotApplicability?: string | null;
  sourceSection?: string | null;
  stiConditionText?: string | null;
  stiConditionality?: { conditionText?: string | null } | null;
  stiProcurementPhase?: string | null;
  stiActor?: string | null;
  versionLabel?: string | null;
};

/** Same identity used by merge, last-mile collapse, and the duplicate-fingerprint invariant. */
export function canonicalObligationFingerprint(
  req: CanonicalObligationIdentityInput,
): string {
  return obligationFingerprint(req.requirement, req.category, {
    lotLabel: req.lotApplicability ?? null,
    conditionText:
      req.stiConditionText ?? req.stiConditionality?.conditionText ?? null,
    procurementPhase: req.stiProcurementPhase ?? null,
    actor: req.stiActor ?? null,
    versionLabel: req.versionLabel ?? null,
  });
}

function descriptionQualityScore(description: string): number {
  let score = 0;
  // Prefer explicit tender IDs over paraphrased / scope narrative clones
  if (/^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(description.trim())) score += 40;
  if (!/\breferenced\b/i.test(description)) score += 12;
  if (/\b(must|shall|required|obligatoire|mandatory|devra|doit|est\s+tenu|provide|supply)\b/i.test(description)) {
    score += 8;
  }
  // Prefer texts that still carry conditional trigger context
  if (hasConditionalTriggerContext(description)) score += 30;
  score += Math.min(description.length, 240) / 24;
  return score;
}

function pickPreferredDescription(a: string, b: string): string {
  const aHas = hasConditionalTriggerContext(a);
  const bHas = hasConditionalTriggerContext(b);
  if (aHas && !bHas) return a;
  if (bHas && !aHas) return b;
  return descriptionQualityScore(a) >= descriptionQualityScore(b) ? a : b;
}

function preferRequirementId(
  a: string | null | undefined,
  b: string | null | undefined,
  aText: string,
  bText: string,
): string | null {
  const aLabeled = /^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(aText.trim());
  const bLabeled = /^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(bText.trim());
  if (aLabeled && !bLabeled) return a ?? null;
  if (bLabeled && !aLabeled) return b ?? null;
  return a ?? b ?? null;
}

function mergeSourceDocuments(a?: string | null, b?: string | null): string | null {
  const parts = [...new Set(
    [a, b]
      .flatMap((s) => (s ?? "").split(";"))
      .map((x) => x.trim())
      .filter(Boolean),
  )];
  return parts.length ? parts.join("; ") : null;
}

function allPages(item: NormalizedRequirement): number[] {
  const pages = new Set<number>();
  if (item.page != null && item.page >= 1) pages.add(item.page);
  for (const p of item.sourcePages ?? []) {
    if (p >= 1) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

function survivorRank(item: NormalizedRequirement): number {
  let score = descriptionQualityScore(item.requirement);
  if (item.confidence === "HIGH") score += 20;
  else if (item.confidence === "MEDIUM") score += 8;
  score += (item.stiConfidence ?? 0) * 10;
  score += item.stiProvenance?.length ?? 0;
  score += item.sourceDocuments?.length ?? 0;
  score += item.sourcePages?.length ?? 0;
  if (item.versionLabel?.trim()) score += 15;
  if (item.stiSituation?.uncertaintyPreserved) score -= 5;
  return score;
}

function markSubstantiveReview(item: NormalizedRequirement): NormalizedRequirement {
  const explanation =
    "REVIEW: conflicting substantive records share an obligation class but disagree on meaning.";
  return {
    ...item,
    confidence: "UNCERTAIN",
    verificationReason: explanation,
    stiSituation: {
      uncertaintyPreserved: true,
      admissionBlockedByUncertainty: false,
      unattributedDocumentaryEvidence: item.stiSituation?.unattributedDocumentaryEvidence ?? false,
      unattributedEligibilityEvidence: item.stiSituation?.unattributedEligibilityEvidence ?? false,
      unattributedCommercialEvidence: item.stiSituation?.unattributedCommercialEvidence ?? false,
      unattributedImpersonalObligation: item.stiSituation?.unattributedImpersonalObligation ?? false,
      explanation: item.stiSituation?.explanation
        ? `${item.stiSituation.explanation} ${explanation}`
        : explanation,
    },
  };
}

function conflictingSubstantiveMeaning(
  a: NormalizedRequirement,
  b: NormalizedRequirement,
): boolean {
  if (obligationPolarity(a.requirement) !== obligationPolarity(b.requirement)) return true;
  const fa = semanticIdentityFacets(a.requirement);
  const fb = semanticIdentityFacets(b.requirement);
  if (fa !== fb) return true;
  const extrasA = leftoverMaterialClaims(a.requirement);
  const extrasB = leftoverMaterialClaims(b.requirement);
  if (extrasA && extrasB && extrasA !== extrasB) return true;
  return false;
}

function conflictDiscriminator(item: NormalizedRequirement): string {
  const extras = leftoverMaterialClaims(item.requirement);
  return [
    obligationPolarity(item.requirement),
    extras,
    item.versionLabel?.trim() ? fold(item.versionLabel).slice(0, 40) : "",
    normalizeSemanticSurface(item.requirement).slice(0, 48),
  ]
    .filter(Boolean)
    .join("/");
}

function identityCoreFingerprint(fp: string): string {
  return fp
    .replace(/\|claims:[^|]+/g, "")
    .replace(/\|pol:[^|]+/g, "")
    .replace(/\|conflict:[^|]+/g, "");
}

export function mergeNormalizedRequirements(
  items: NormalizedRequirement[],
): NormalizedRequirement[] {
  const ordered = [...items].sort((a, b) => {
    const fa = canonicalObligationFingerprint(a);
    const fb = canonicalObligationFingerprint(b);
    if (fa !== fb) return fa.localeCompare(fb);
    const rank = survivorRank(b) - survivorRank(a);
    if (rank !== 0) return rank;
    return a.requirement.localeCompare(b.requirement);
  });

  const byFp = new Map<string, NormalizedRequirement>();

  for (const raw of ordered) {
    let item = raw;
    let fp = canonicalObligationFingerprint(item);
    const occupant = byFp.get(fp);
    if (occupant && conflictingSubstantiveMeaning(occupant, item)) {
      byFp.set(fp, markSubstantiveReview(occupant));
      fp = `${fp}|conflict:${conflictDiscriminator(item)}`;
      item = markSubstantiveReview(item);
    }
    const existing = byFp.get(fp);
    if (!existing) {
      const lot = resolveLot(item);
      const lotLabel = formatLotApplicability(lot);
      byFp.set(fp, {
        ...item,
        sourcePages: allPages(item),
        sourceDocuments: item.sourceDocument
          ? [...new Set([...(item.sourceDocuments ?? []), item.sourceDocument])]
          : item.sourceDocuments,
        lotApplicability: lotLabel ?? item.lotApplicability ?? null,
        sourceSection: encodeLotIntoSourceSection(item.sourceSection, lot),
      });
      continue;
    }

    const requirement = pickPreferredDescription(existing.requirement, item.requirement);
    const evidenceCandidates = [
      existing.evidenceText,
      item.evidenceText,
      existing.evidence,
      item.evidence,
    ].filter((e): e is string => Boolean(e?.trim()));
    const evidenceWithTrigger = evidenceCandidates.find((e) =>
      hasConditionalTriggerContext(e),
    );
    const evidenceText =
      evidenceWithTrigger ??
      evidenceCandidates.sort((a, b) => b.length - a.length)[0] ??
      null;
    const uniquePages = [...new Set([...allPages(existing), ...allPages(item)])].sort(
      (a, b) => a - b,
    );

    const obligationStrength = preferObligationStrengthPreservingConditionality(
      existing.obligationStrength,
      item.obligationStrength,
      existing.requirement,
      item.requirement,
    );
    const preferredCategory = preferCategory(existing.category, item.category);
    const preferredKind = preferSemanticKind(existing.semanticKind, item.semanticKind);
    // Independent prefer* can diverge kind vs category — reconcile via SoT matrix.
    const reconciled = reconcileMergedSemanticTriple({
      semanticKind: preferredKind,
      category: preferredCategory,
      obligationStrength,
    });
    const category = reconciled.category;
    const semanticKind = reconciled.semanticKind;
    const mergedStrength = reconciled.obligationStrength;
    const mandatory =
      semanticKind === "UNKNOWN" ||
      mergedStrength === "CONDITIONAL" ||
      mergedStrength === "OPTIONAL" ||
      mergedStrength === "INFORMATIONAL"
        ? false
        : existing.mandatory ||
          item.mandatory ||
          isMandatoryCategory(category);

    const mergedLot = mergeLotApplicability(resolveLot(existing), resolveLot(item));
    const lotLabel = formatLotApplicability(mergedLot);
    const sourceSection = encodeLotIntoSourceSection(
      existing.sourceSection ?? item.sourceSection ?? null,
      mergedLot,
    );

    byFp.set(
      fp,
      reconcileConditionalObligation({
        ...existing,
        category,
        semanticKind,
        obligationStrength: mergedStrength,
        requirement,
        title: sourceSection ?? existing.title ?? item.title,
        id:
          preferRequirementId(existing.id, item.id, existing.requirement, item.requirement) ??
          undefined,
        sourceSection,
        lotApplicability: lotLabel,
        mandatory,
        page: uniquePages[0] ?? existing.page ?? item.page ?? null,
        sourcePages: uniquePages,
        sourceCell: existing.sourceCell ?? item.sourceCell ?? null,
        columnHeader: existing.columnHeader ?? item.columnHeader ?? null,
        rowLabel: existing.rowLabel ?? item.rowLabel ?? null,
        versionLabel: existing.versionLabel ?? item.versionLabel ?? null,
        locator: existing.locator ?? item.locator ?? null,
        sourceCompleteness:
          existing.sourceCompleteness === "TRUNCATED" || item.sourceCompleteness === "TRUNCATED"
            ? "TRUNCATED"
            : existing.sourceCompleteness ?? item.sourceCompleteness ?? null,
        sourceDocument: mergeSourceDocuments(existing.sourceDocument, item.sourceDocument),
        sourceDocuments: [
          ...new Set(
            [
              ...(existing.sourceDocuments ?? []),
              ...(item.sourceDocuments ?? []),
              existing.sourceDocument,
              item.sourceDocument,
            ]
              .flatMap((s) => (s ?? "").split(";"))
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ],
        evidenceText: evidenceText ?? existing.evidence ?? item.evidence ?? null,
        evidence: evidenceText ?? existing.evidence ?? item.evidence ?? null,
        confidence:
          semanticKind === "UNKNOWN"
            ? "UNCERTAIN"
            : existing.confidence === "HIGH" || item.confidence === "HIGH"
              ? "HIGH"
              : existing.confidence === "MEDIUM" || item.confidence === "MEDIUM"
                ? "MEDIUM"
                : existing.confidence,
        // Preserve STI contract fields — merge must not drop or re-decide them.
        stiActor: existing.stiActor ?? item.stiActor ?? null,
        stiRecipient: existing.stiRecipient ?? item.stiRecipient ?? null,
        stiClauseRole: existing.stiClauseRole ?? item.stiClauseRole ?? null,
        stiClausePurpose: existing.stiClausePurpose ?? item.stiClausePurpose ?? null,
        stiDocumentRole: existing.stiDocumentRole ?? item.stiDocumentRole ?? null,
        stiSectionRole: existing.stiSectionRole ?? item.stiSectionRole ?? null,
        stiProcurementPhase:
          existing.stiProcurementPhase ?? item.stiProcurementPhase ?? null,
        stiApplicability: existing.stiApplicability ?? item.stiApplicability ?? null,
        stiTemplateStatus: existing.stiTemplateStatus ?? item.stiTemplateStatus ?? null,
        stiConditionText: existing.stiConditionText ?? item.stiConditionText ?? null,
        stiConditionality: existing.stiConditionality ?? item.stiConditionality ?? null,
        stiConfidence:
          existing.stiConfidence != null || item.stiConfidence != null
            ? Math.max(existing.stiConfidence ?? 0, item.stiConfidence ?? 0)
            : null,
        stiProvenance:
          existing.stiProvenance?.length || item.stiProvenance?.length
            ? [
                ...(existing.stiProvenance ?? []),
                ...(item.stiProvenance ?? []).filter(
                  (p) =>
                    !(existing.stiProvenance ?? []).some(
                      (e) =>
                        e.sourceDocument === p.sourceDocument &&
                        e.sourcePage === p.sourcePage &&
                        e.sourceSection === p.sourceSection &&
                        (e.sourceCell ?? null) === (p.sourceCell ?? null) &&
                        (e.versionLabel ?? null) === (p.versionLabel ?? null),
                    ),
                ),
              ]
            : null,
        stiSituation: existing.stiSituation ?? item.stiSituation ?? null,
      }),
    );
  }

  const merged = [...byFp.values()].map(reconcileConditionalObligation);
  const byCore = new Map<string, NormalizedRequirement[]>();
  for (const row of merged) {
    const core = identityCoreFingerprint(canonicalObligationFingerprint(row));
    const group = byCore.get(core) ?? [];
    group.push(row);
    byCore.set(core, group);
  }
  return merged.map((row) => {
    const core = identityCoreFingerprint(canonicalObligationFingerprint(row));
    const group = byCore.get(core) ?? [];
    if (group.length < 2) return row;
    if (!group.some((other) => other !== row && conflictingSubstantiveMeaning(row, other))) {
      return row;
    }
    return markSubstantiveReview(row);
  });
}
