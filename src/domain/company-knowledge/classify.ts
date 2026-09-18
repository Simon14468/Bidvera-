import type { DocumentKind } from "./types";

export type ClassificationResult = {
  kind: DocumentKind;
  confidence: number;
  signals: string[];
};

/** Optional multi-file package context — never filename-specific to one tender. */
export type ClassifyPackageContext = {
  /** Total members in the same upload/package (including this file). */
  packageMemberCount?: number;
  /** Sibling file names in the package. */
  siblingFileNames?: string[];
};

/**
 * Generic tender-pack section cues (ITB volumes, forms, contracts, annexes, Q&A).
 * Applied when the upload is a multi-member package — not a single company profile.
 */
function tenderPackSectionBoost(fileName: string, text: string): {
  score: number;
  signals: string[];
} {
  const file = fileName.toLowerCase();
  const t = text.toLowerCase();
  const signals: string[] = [];
  let score = 0;

  const sectionCue =
    /\bsection\s*[ivx0-9]+\b|\bvolume\s*[ivx0-9]+\b|\bschedule\s+of\s+requirements\b|\binstructions?\s+to\s+(bidders|tenderers)\b|\breturnable\b|\bbidding\s+forms?\b|\bform\s+of\s+tender\b|\bsample\s+contract\b|\bcontract\s+forms?\b|\btechnical\s+(volume|specification|schedule)\b|\bcommercial\s+(volume|schedule)\b|\bpricing\s+schedule\b|\bannex\b|\bappendix\b|\bcorrigendum\b|\baddendum\b|\bclarification\b|\bpre-?bid\b|\bitb[-_\s]?\d*\b|\beligibility\b|\bterms\s+and\s+conditions\b/i;

  if (sectionCue.test(file) || sectionCue.test(t)) {
    score += 45;
    signals.push("tender_pack_section_cue");
  }
  if (
    /\b(goods\s+and\s+related\s+services|special\s+conditions\s+of\s+contract|general\s+conditions\s+of\s+contract)\b/i.test(
      t,
    )
  ) {
    score += 20;
    signals.push("contract_volume_language");
  }
  return { score, signals };
}

function looksLikeMultiFileTenderPack(ctx?: ClassifyPackageContext): boolean {
  if (!ctx) return false;
  if ((ctx.packageMemberCount ?? 0) >= 2) return true;
  const siblings = ctx.siblingFileNames ?? [];
  if (siblings.length >= 2) return true;
  return siblings.some((n) =>
    /section|volume|schedule|returnable|itt|rfp|itb|annex|corrigendum|addendum|clarification|contract\s*form/i.test(
      n,
    ),
  );
}

/**
 * Distinguishes Company Profile / Tender / Supporting / Historical docs.
 * A Company Profile must NEVER be treated as a Tender when it is a true profile.
 * In multi-file tender packages, section volumes must not collapse to COMPANY_PROFILE.
 */
export function classifyDocument(input: {
  text: string;
  fileName: string;
  packageContext?: ClassifyPackageContext;
}): ClassificationResult {
  const text = input.text;
  const lower = text.toLowerCase();
  const file = input.fileName.toLowerCase();
  const signals: string[] = [];

  let profileScore = 0;
  let tenderScore = 0;
  let historicalScore = 0;
  let supportingScore = 0;

  if (/company\s+profile|capability\s+statement|company\s+overview/i.test(text)) {
    profileScore += 35;
    signals.push("company_profile_heading");
  }
  if (/main\s+services|known\s+limitations|tender\s+preferences/i.test(text)) {
    profileScore += 25;
    signals.push("profile_sections");
  }
  if (/synthetic\s+.*test\s+profile|fictional\s+test|bidvera\s+test\s+profile/i.test(text)) {
    profileScore += 20;
    signals.push("test_profile_marker");
  }
  if (/company\s+experience|project\s+references|certifications\s*&\s*compliance/i.test(text)) {
    profileScore += 15;
    signals.push("experience_or_compliance_section");
  }
  if (/profile|capability|company.?knowledge/i.test(file)) {
    profileScore += 15;
    signals.push("filename_profile");
  }

  if (
    /\b(invitation\s+to\s+tender|request\s+for\s+(proposal|quotation)|itt\b|rfp\b|rfq\b)\b/i.test(
      text,
    )
  ) {
    tenderScore += 40;
    signals.push("rfp_itt_marker");
  }
  // Moroccan / Francophone public procurement wording
  if (
    /appel\s+d['’]offres|cahier\s+des\s+charges|avis\s+d['’]appel|soumissionnaires?/i.test(
      text,
    )
  ) {
    tenderScore += 40;
    signals.push("fr_ao_marker");
  }
  // Malay / ePerolehan public procurement notices
  if (
    /kenyataan\s+tender|\biklan\b|papan\s+notis|e-?perolehan|tarikh\s+tutup|syarikat\s+pembekal|kementerian\s+kewangan/i.test(
      text,
    )
  ) {
    tenderScore += 40;
    signals.push("my_tender_notice_marker");
  }
  if (/\b(iklan|kenyataan|eperolehan|notis|tender)\b/i.test(file) && !/profile/i.test(file)) {
    tenderScore += 15;
    signals.push("filename_my_or_tender");
  }
  if (
    /\b(shall\s+provide|must\s+provide|mandatory\s+requirement|submission\s+deadline|tenderers?\s+shall)\b/i.test(
      text,
    )
  ) {
    tenderScore += 25;
    signals.push("tender_obligation_language");
  }
  if (
    /\b(scope\s+of\s+(work|services)|evaluation\s+criteria|award\s+criteria|pricing\s+schedule)\b/i.test(
      text,
    )
  ) {
    tenderScore += 20;
    signals.push("tender_structure");
  }
  if (/\b(tender|rfp|itt|rfq)\b/i.test(file) && !/profile/i.test(file)) {
    tenderScore += 15;
    signals.push("filename_tender");
  }

  if (looksLikeMultiFileTenderPack(input.packageContext)) {
    const boost = tenderPackSectionBoost(input.fileName, text);
    if (boost.score > 0) {
      tenderScore += boost.score;
      signals.push(...boost.signals, "package_context_multi_member");
    }
  }

  if (/historical\s+tender\s+outcomes|similar-company\s+learning/i.test(text)) {
    historicalScore += 20;
    signals.push("historical_section");
  }
  // Historical outcomes inside a profile still classify as COMPANY_PROFILE overall.
  if (
    historicalScore > 0 &&
    profileScore < 20 &&
    !/company\s+profile|main\s+services/i.test(text)
  ) {
    historicalScore += 30;
  }

  if (
    /\b(insurance\s+certificate|policy\s+document|certificate\s+of|evidence\s+pack)\b/i.test(
      text,
    ) &&
    profileScore < 30 &&
    tenderScore < 30
  ) {
    supportingScore += 25;
    signals.push("supporting_evidence_language");
  }

  // Hard rule: strong profile signals win over weak tender keyword noise
  // (e.g. "ISO 27001" appearing in a profile must not create a tender).
  // Exception: multi-file tender pack section cues already boosted tenderScore.
  if (profileScore >= 40 && tenderScore < 35) {
    return {
      kind: "COMPANY_PROFILE",
      confidence: Math.min(98, 55 + profileScore),
      signals,
    };
  }
  if (tenderScore >= 35 && tenderScore > profileScore) {
    return {
      kind: "TENDER",
      confidence: Math.min(98, 50 + tenderScore),
      signals,
    };
  }
  if (historicalScore >= 40 && historicalScore > profileScore && historicalScore > tenderScore) {
    return {
      kind: "HISTORICAL_OUTCOME",
      confidence: Math.min(90, 45 + historicalScore),
      signals,
    };
  }
  if (supportingScore >= 25 && supportingScore > profileScore && supportingScore > tenderScore) {
    return {
      kind: "SUPPORTING_EVIDENCE",
      confidence: Math.min(85, 40 + supportingScore),
      signals,
    };
  }
  if (profileScore >= 25) {
    return {
      kind: "COMPANY_PROFILE",
      confidence: Math.min(90, 40 + profileScore),
      signals,
    };
  }
  if (tenderScore >= 20) {
    return { kind: "TENDER", confidence: Math.min(85, 35 + tenderScore), signals };
  }

  // Filename fallback
  if (/profile|capability/i.test(file)) {
    return { kind: "COMPANY_PROFILE", confidence: 55, signals: [...signals, "filename_fallback"] };
  }
  if (/tender|rfp|itt/i.test(file)) {
    return { kind: "TENDER", confidence: 55, signals: [...signals, "filename_fallback"] };
  }

  // Default: treat as tender pack (existing upload UX) but low confidence
  return {
    kind: lower.includes("company") && lower.includes("profile") ? "COMPANY_PROFILE" : "UNKNOWN",
    confidence: 30,
    signals: [...signals, "low_confidence"],
  };
}

export function isCompanyEvidenceKind(kind: DocumentKind): boolean {
  return (
    kind === "COMPANY_PROFILE" ||
    kind === "SUPPORTING_EVIDENCE" ||
    kind === "HISTORICAL_OUTCOME"
  );
}

export function isTenderRequirementSource(kind: DocumentKind): boolean {
  return kind === "TENDER";
}
