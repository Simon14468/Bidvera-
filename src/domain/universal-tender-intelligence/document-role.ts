/**
 * Content-first document role classification.
 * Filename is a weak signal only — never sole authority.
 */

import type { TenderDocumentRole } from "@/domain/tender-package/types";
import { classifyTenderDocumentRole } from "@/domain/tender-package/classify-role";
import type { UniversalDocumentRole } from "./types";

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function mapUniversalRoleToLegacy(role: UniversalDocumentRole): TenderDocumentRole {
  switch (role) {
    case "TENDER_NOTICE":
      return "AVIS";
    case "INVITATION":
    case "INSTRUCTIONS_TO_TENDERERS":
      return "RFP";
    case "TECHNICAL_SPECIFICATION":
      return "TECHNICAL_SPECIFICATION";
    case "COMMERCIAL_DOCUMENT":
    case "PRICING_SCHEDULE":
      return "FINANCIAL";
    case "FORM_OF_TENDER":
    case "ELIGIBILITY_DOCUMENT":
    case "DECLARATION":
      return "ADMINISTRATIVE";
    case "CONTRACT":
    case "TERMS_AND_CONDITIONS":
      return "CPS";
    case "ANNEX":
      return "ANNEX";
    case "CORRIGENDUM":
    case "ADDENDUM":
    case "CLARIFICATION":
    case "Q_AND_A":
    case "BIDDER_RESPONSE":
    case "OTHER":
    case "UNKNOWN":
    default:
      return "OTHER";
  }
}

export function classifyUniversalDocumentRole(input: {
  text: string;
  fileName: string;
}): {
  role: UniversalDocumentRole;
  confidence: number;
  signals: string[];
  legacyRole: TenderDocumentRole;
} {
  const text = input.text;
  const f = fold(input.fileName);
  const t = fold(text);
  const signals: string[] = [];

  const score = (role: UniversalDocumentRole, n: number, signal: string) => {
    scores.set(role, (scores.get(role) ?? 0) + n);
    signals.push(signal);
  };
  const scores = new Map<UniversalDocumentRole, number>();

  // Content-first. Filename tokens are lexical_weak and cannot win alone.
  if (/\bcorrigendum\b|\brectificatif\b|\berrata\b/.test(t)) {
    score("CORRIGENDUM", 55, "content_corrigendum");
  } else if (/\bcorrigendum\b|\brectificatif\b/.test(f)) {
    score("CORRIGENDUM", 12, "filename_corrigendum");
  }
  if (/\baddendum\b|\bamendment\b|\bmodification\s+notice\b/.test(t)) {
    score("ADDENDUM", 50, "content_addendum");
  } else if (/\baddendum\b/.test(f)) {
    score("ADDENDUM", 12, "filename_addendum");
  }
  if (
    /\bclarification\b|\bdemande\s+de\s+clarification\b|\bresponse\s+to\s+(?:clarification|question)/.test(
      t,
    )
  ) {
    const clarDominant =
      text.length < 15_000 ||
      (/\bquestion\b/.test(t) && /\banswer\b|\br[eé]ponse\b/.test(t));
    if (clarDominant) score("CLARIFICATION", 45, "content_clarification");
    else score("CLARIFICATION", 10, "mention_clarification");
  } else if (/\bclarif/.test(f)) {
    score("CLARIFICATION", 10, "filename_clarification");
  }
  if (/\bquestion\b/.test(t) && /\banswer\b|\br[eé]ponse\b/.test(t)) {
    score("Q_AND_A", 48, "content_qa");
  } else if (/\bq\s*&\s*a\b|\bqa\b|\bquestions?\b/.test(f)) {
    score("Q_AND_A", 12, "filename_qa");
  }
  if (
    /\bform\s+of\s+tender\b|\bacte\s+d['']engagement\b|\bdeclaration\s+of\s+tender/.test(t)
  ) {
    // Filename or short form pack — not a long ITT that merely references the form
    const formDominant =
      /\bform\s+of\s+tender\b/.test(f) ||
      text.length < 12_000 ||
      /^appendix\s+b\b/i.test(text.slice(0, 400));
    if (formDominant) score("FORM_OF_TENDER", 50, "content_form_of_tender");
    else score("FORM_OF_TENDER", 12, "mention_form_of_tender");
  }
  if (
    /\bpricing\s+schedule\b|\bbill\s+of\s+quantities\b|\bbordereau\s+des\s+prix\b|\bcommercial\s+schedule\b/.test(
      t,
    )
  ) {
    const pricingDominant =
      text.length < 20_000 ||
      /\b\[sheet:|\bspreadsheet\b/i.test(text.slice(0, 500));
    if (pricingDominant) score("PRICING_SCHEDULE", 50, "content_pricing");
    else score("PRICING_SCHEDULE", 12, "mention_pricing");
  } else if (/\bpricing|commercial\s+schedule|boq|bordereau\b/.test(f)) {
    score("PRICING_SCHEDULE", 12, "filename_pricing");
  }
  if (/\bterms\s+and\s+conditions\b|\bconditions\s+g[eé]n[eé]rales\b|\bdraft\s+terms\b/.test(t)) {
    score("TERMS_AND_CONDITIONS", 42, "content_terms");
  } else if (/\bterms\b|\bconditions\b/.test(f) && !/\binvitation|itt|instructions\b/.test(f)) {
    score("TERMS_AND_CONDITIONS", 12, "filename_terms");
  }
  if (
    /\binstructions?\s+(?:to|aux)\s+(?:tenderers?|soumissionnaires?)\b|\binstruction\s+to\s+tenderers\b/.test(
      t,
    )
  ) {
    score("INSTRUCTIONS_TO_TENDERERS", 48, "content_instructions");
  }
  if (
    /\binvitation\s+to\s+tender\b|\bappel\s+[aà]\s+la\s+concurrence\b/.test(t) &&
    !/\bappendix\b|\bannexe\b/.test(f)
  ) {
    score("INVITATION", 52, "content_invitation");
  } else if (/\binvitation\s+to\s+tender\b|\bitt\b/.test(f) && !/\bappendix\b|\bannexe\b/.test(f)) {
    score("INVITATION", 12, "filename_invitation");
  }
  if (
    /\btender\s+notice\b|\bavis\s+d['']appel\b|\bkenyataan\s+tender\b|\bnotice\s+of\s+invitation\b/.test(
      t,
    )
  ) {
    score("TENDER_NOTICE", 45, "content_notice");
  }
  if (
    /\btechnical\s+specifications?\b|\bsp[eé]cifications?\s+techniques?\b|\bscope\s+of\s+(?:work|services)\b|\btechnical\s+schedule\b/.test(
      t,
    )
  ) {
    score("TECHNICAL_SPECIFICATION", 45, "content_tech");
  }
  if (/\beligibility\b|\bconditions?\s+de\s+participation\b|\bqualification\b/.test(t)) {
    score("ELIGIBILITY_DOCUMENT", 30, "content_eligibility");
  }
  if (/\bdeclaration\b|\baffidavit\b|\bself[- ]declaration\b/.test(t)) {
    score("DECLARATION", 28, "content_declaration");
  }
  if (/^annexe\s+[a-z0-9]/im.test(text)) {
    score("ANNEX", 32, "content_annex");
  } else if (/\bannexe?\b|\bappendix\b/.test(f)) {
    score("ANNEX", 12, "filename_annex");
  }
  if (
    /\bsample\s+(?:response|bid|proposal)\b|\bexample\s+bidder\b|\bcompleted\s+form\s+example\b/.test(t)
  ) {
    score("BIDDER_RESPONSE", 40, "content_bidder_response_example");
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0 && ranked[0]![1] >= 28) {
    const role = ranked[0]![0];
    return {
      role,
      confidence: Math.min(98, 40 + ranked[0]![1]),
      signals,
      legacyRole: mapUniversalRoleToLegacy(role),
    };
  }

  // Fall back to existing package role classifier, then map to universal
  const legacy = classifyTenderDocumentRole({ text, fileName: input.fileName });
  const mapped = legacyRoleToUniversal(legacy.role);
  return {
    role: mapped,
    confidence: legacy.confidence,
    signals: [...signals, ...legacy.signals, "legacy_fallback"],
    legacyRole: legacy.role,
  };
}

function legacyRoleToUniversal(role: TenderDocumentRole): UniversalDocumentRole {
  switch (role) {
    case "AVIS":
      return "TENDER_NOTICE";
    case "RFP":
      return "INVITATION";
    case "CPS":
      return "CONTRACT";
    case "TECHNICAL_SPECIFICATION":
      return "TECHNICAL_SPECIFICATION";
    case "ADMINISTRATIVE":
      return "ELIGIBILITY_DOCUMENT";
    case "FINANCIAL":
      return "PRICING_SCHEDULE";
    case "ANNEX":
      return "ANNEX";
    default:
      return "OTHER";
  }
}

export function versionRank(role: UniversalDocumentRole): number {
  // Higher = later in effective package order (overrides / annotations)
  switch (role) {
    case "CORRIGENDUM":
    case "ADDENDUM":
      return 90;
    case "CLARIFICATION":
    case "Q_AND_A":
      return 80;
    case "BIDDER_RESPONSE":
      return 70;
    default:
      return 10;
  }
}
