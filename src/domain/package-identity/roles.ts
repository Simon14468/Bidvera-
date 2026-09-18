/**
 * Package-aware document identity.
 * Content evidence first. Filename may corroborate an already-scored role
 * and must never assign a role by itself.
 */

import type { PackageIdentityPart, PackageIdentityDocument, PackageIdentityRole } from "./types";

type RoleScore = { role: PackageIdentityRole; score: number; signal: string; fromHead: boolean };

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const VOLUME_ROLES = new Set<PackageIdentityRole>([
  "NOTICE",
  "INVITATION",
  "INSTRUCTIONS",
  "SCHEDULE_OF_REQUIREMENTS",
  "TECHNICAL_SPECIFICATION",
  "RETURNABLE_FORMS",
  "PRICING",
  "CONTRACT_FORMS",
  "PREBID_MATERIAL",
]);

function filenameCorroboration(fileName: string): PackageIdentityRole | null {
  const f = fold(fileName);
  if (/\bcorrigend|rectificatif|errata\b/.test(f)) return "CORRIGENDUM";
  if (/\baddendum|amendment\b/.test(f)) return "AMENDMENT";
  if (/\bq\s*&\s*a\b|\bqa\b|\bclarif/.test(f)) return "Q_AND_A";
  if (/\bpre[-_ ]?bid\b/.test(f)) return "PREBID_MATERIAL";
  if (/\binstructions?\s+to\s+(?:bidders?|tenderers?|offerors?)\b|\bitt\b/.test(f)) return "INSTRUCTIONS";
  if (/\bschedule\s+of\s+requirements?\b/.test(f)) return "SCHEDULE_OF_REQUIREMENTS";
  if (/\breturnable\s+bidding\s+forms?\b|\breturnable\s+forms?\b/.test(f)) return "RETURNABLE_FORMS";
  if (/\bsample\s+contract\b/.test(f)) return "SAMPLE_CONTRACT";
  if (/\bcontract\s+forms?\b/.test(f)) return "CONTRACT_FORMS";
  if (/\bnotice|avis|iklan|kenyataan\b/.test(f)) return "NOTICE";
  if (/\bpric|boq|bordereau|commercial\s+schedule\b/.test(f)) return "PRICING";
  if (/\bvendor\s+guide\b|\bsupplier\s+guide\b/.test(f)) return "VENDOR_GUIDE";
  if (/\be-?sourcing\b|\bportal\s+guide\b/.test(f)) return "PORTAL_GUIDE";
  if (/\bcode\s+of\s+conduct\b|\bethics\s+policy\b/.test(f)) return "POLICY_OR_CODE";
  return null;
}

function scoreDocument(text: string, fileName: string): RoleScore[] {
  const head = text.slice(0, 3_000);
  const body = text;
  const t = fold(body);
  const h = fold(head);
  const scores: RoleScore[] = [];
  const add = (role: PackageIdentityRole, n: number, signal: string, fromHead = false) => {
    if (n <= 0) return;
    scores.push({ role, score: n, signal, fromHead });
  };

  if (/\bcorrigendum\b|\brectificatif\b|\berrata\b/.test(h)) {
    add("CORRIGENDUM", 55, "content_corrigendum", true);
  } else if (/\bcorrigendum\b|\brectificatif\b|\berrata\b/.test(t)) {
    add("CORRIGENDUM", 40, "content_corrigendum", false);
  }
  if (/\baddendum\b|\bamendment\b|\bmodification\s+notice\b/.test(h)) {
    add("AMENDMENT", 50, "content_amendment", true);
  } else if (/\baddendum\b|\bamendment\b|\bmodification\s+notice\b/.test(t)) {
    add("AMENDMENT", 36, "content_amendment", false);
  }
  if (/\bquestion\b/.test(h) && /\banswer\b|\br[eé]ponse\b/.test(h)) {
    add("Q_AND_A", 50, "content_qa", true);
  } else if (/\bquestion\b/.test(t) && /\banswer\b|\br[eé]ponse\b/.test(t)) {
    add("Q_AND_A", 36, "content_qa", false);
  }
  if (
    /\bclarification\b|\bresponse\s+to\s+(?:clarification|question)/.test(h) &&
    (text.length < 15_000 || (/\bquestion\b/.test(t) && /\banswer\b/.test(t)))
  ) {
    add("CLARIFICATION", 45, "content_clarification", true);
  }
  if (
    /\bpre[- ]?bid\s+(?:meeting|minutes|conference|slides|clarification\s+meeting)\b/.test(h)
  ) {
    add("PREBID_MATERIAL", 52, "content_prebid", true);
  } else if (
    /\bpre[- ]?bid\s+(?:meeting|minutes|conference|slides|clarification\s+meeting)\b/.test(t)
  ) {
    add("PREBID_MATERIAL", 38, "content_prebid", false);
  }
  if (
    /\binstructions?\s+(?:to|aux)\s+(?:bidders?|tenderers?|soumissionnaires?|offerors?)\b/.test(
      h,
    )
  ) {
    add("INSTRUCTIONS", 54, "content_instructions", true);
  } else if (
    /\binstructions?\s+(?:to|aux)\s+(?:bidders?|tenderers?|soumissionnaires?|offerors?)\b/.test(
      t,
    )
  ) {
    add("INSTRUCTIONS", 36, "content_instructions", false);
  }
  if (/\bschedule\s+of\s+requirements?\b/.test(h)) {
    add("SCHEDULE_OF_REQUIREMENTS", 54, "content_schedule", true);
  } else if (/\bschedule\s+of\s+requirements?\b/.test(t)) {
    add("SCHEDULE_OF_REQUIREMENTS", 36, "content_schedule", false);
  }
  if (/\breturnable\s+bidding\s+forms?\b|\breturnable\s+forms?\b/.test(h)) {
    add("RETURNABLE_FORMS", 54, "content_returnable", true);
  } else if (
    /\bform\s+of\s+tender\b/.test(h) &&
    !/\bschedule\s+of\s+requirements?\b|\binstructions?\s+(?:to|aux)\s+(?:bidders?|tenderers?)\b/.test(
      t,
    )
  ) {
    add("RETURNABLE_FORMS", 48, "content_form_of_tender", true);
  } else if (/\breturnable\s+bidding\s+forms?\b/.test(t)) {
    add("RETURNABLE_FORMS", 32, "content_returnable_body", false);
  }
  if (/\bsample\s+contract\b/.test(h)) {
    add("SAMPLE_CONTRACT", 56, "content_sample_contract", true);
  } else if (/\bsample\s+contract\b/.test(t)) {
    add("SAMPLE_CONTRACT", 36, "content_sample_contract_body", false);
  }
  if (
    /\bcontract\s+forms?\b|\bspecial\s+conditions\s+of\s+contract\b|\bgeneral\s+conditions\s+of\s+contract\b/.test(
      h,
    )
  ) {
    add("CONTRACT_FORMS", 50, "content_contract_forms", true);
  } else if (
    /\bcontract\s+forms?\b|\bspecial\s+conditions\s+of\s+contract\b|\bgeneral\s+conditions\s+of\s+contract\b/.test(
      t,
    )
  ) {
    add("CONTRACT_FORMS", 32, "content_contract_forms", false);
  }
  if (/\bterms\s+and\s+conditions\b|\bconditions\s+g[eé]n[eé]rales\b/.test(h)) {
    add("TERMS_AND_CONDITIONS", 46, "content_terms", true);
  }
  if (
    /\btender\s+notice\b|\bavis\s+d['']appel\b|\bkenyataan\s+tender\b|\bnotice\s+of\s+invitation\b|\biklan\b/.test(
      h,
    )
  ) {
    add("NOTICE", 50, "content_notice", true);
  } else if (
    /\btender\s+notice\b|\bavis\s+d['']appel\b|\bkenyataan\s+tender\b|\bnotice\s+of\s+invitation\b|\biklan\b/.test(
      t,
    )
  ) {
    add("NOTICE", 36, "content_notice", false);
  }
  if (/\binvitation\s+to\s+(?:tender|bid)\b|\bappel\s+[aà]\s+la\s+concurrence\b/.test(h)) {
    add("INVITATION", 50, "content_invitation", true);
  }
  if (
    /\bpricing\s+schedule\b|\bbill\s+of\s+quantities\b|\bbordereau\s+des\s+prix\b|\bcommercial\s+schedule\b/.test(
      h,
    )
  ) {
    add("PRICING", 50, "content_pricing", true);
  } else if (
    /\bpricing\s+schedule\b|\bbill\s+of\s+quantities\b|\bbordereau\s+des\s+prix\b|\bcommercial\s+schedule\b/.test(
      t,
    )
  ) {
    const pricingDominant = text.length < 20_000 || /\b\[sheet:|\bspreadsheet\b/i.test(text.slice(0, 500));
    add("PRICING", pricingDominant ? 36 : 14, "content_pricing", false);
  }
  if (
    /\btechnical\s+specifications?\b|\bsp[eé]cifications?\s+techniques?\b|\bscope\s+of\s+(?:work|services)\b/.test(
      h,
    )
  ) {
    const scheduleDominant = /\bschedule\s+of\s+requirements?\b/.test(h);
    add("TECHNICAL_SPECIFICATION", scheduleDominant ? 18 : 46, "content_tech", true);
  } else if (
    /\btechnical\s+specifications?\b|\bsp[eé]cifications?\s+techniques?\b|\bscope\s+of\s+(?:work|services)\b/.test(
      t,
    )
  ) {
    add("TECHNICAL_SPECIFICATION", 28, "content_tech", false);
  }
  if (/^annexe?\s+[a-z0-9]/im.test(head) || /\bappendix\b/.test(h)) {
    add("ANNEX", 36, "content_annex", true);
  }
  if (
    /\b(?:vendor|supplier)\s+guide\b|\bvendor\s+registration\s+(?:guide|manual)\b|\bthis\s+guide\s+(?:explains|describes|will\s+help|covers|provides)\b/.test(
      h,
    )
  ) {
    add("VENDOR_GUIDE", 56, "content_vendor_guide", true);
  } else if (
    /\b(?:vendor|supplier)\s+guide\b|\bvendor\s+registration\s+(?:guide|manual)\b|\bthis\s+guide\s+(?:explains|describes|will\s+help|covers|provides)\b/.test(
      t,
    )
  ) {
    add("VENDOR_GUIDE", 42, "content_vendor_guide", false);
  }
  if (
    /\be-?sourcing\s+(?:user\s+)?(?:guide|manual)\b|\bhow\s+to\s+(?:use|access|register\s+(?:in|on|with))\s+(?:the\s+)?(?:portal|e-?sourcing|system|platform)\b/.test(
      h,
    )
  ) {
    add("PORTAL_GUIDE", 48, "content_portal_guide", true);
  } else if (
    /\be-?sourcing\s+(?:user\s+)?(?:guide|manual)\b|\bhow\s+to\s+(?:use|access)\s+(?:the\s+)?(?:portal|e-?sourcing)\b/.test(
      t,
    )
  ) {
    add("PORTAL_GUIDE", 34, "content_portal_guide", false);
  }
  if (
    /\bcode\s+of\s+conduct\b|\bethics\s+policy\b|\bthis\s+policy\s+(?:describes|sets\s+out)\b/.test(
      h,
    )
  ) {
    add("POLICY_OR_CODE", 46, "content_policy", true);
  }

  const hint = filenameCorroboration(fileName);
  if (hint && scores.some((s) => s.role === hint && s.score >= 20)) {
    add(hint, 8, "filename_corroboration", false);
  }

  return scores;
}

function completenessOf(part: PackageIdentityPart): PackageIdentityDocument["completeness"] {
  const len = part.text.trim().length;
  if (len < 40) return "UNREADABLE";
  if (part.truncated) return "TRUNCATED";
  if (len < 200) return "PARTIAL";
  return "COMPLETE";
}

export function classifyPackageDocumentIdentity(
  parts: PackageIdentityPart[],
): PackageIdentityDocument[] {
  const scored = parts.map((part) => {
    const rankings = scoreDocument(part.text, part.fileName);
    const byRole = new Map<
      PackageIdentityRole,
      { score: number; signals: string[]; fromHead: boolean }
    >();
    for (const r of rankings) {
      const cur = byRole.get(r.role) ?? { score: 0, signals: [], fromHead: false };
      cur.score += r.score;
      cur.signals.push(r.signal);
      cur.fromHead = cur.fromHead || r.fromHead;
      byRole.set(r.role, cur);
    }
    const ordered = [...byRole.entries()].sort((a, b) => b[1].score - a[1].score);
    const headWinner = ordered.find(([, info]) => info.fromHead && info.score >= 40);
    const selected = headWinner
      ? [headWinner, ...ordered.filter((row) => row[0] !== headWinner[0])]
      : ordered;
    return { part, ordered: selected };
  });

  const used = new Map<PackageIdentityRole, string>();
  const result: PackageIdentityDocument[] = [];

  for (const row of scored) {
    const top = row.ordered[0];
    if (!top || top[1].score < 28) {
      result.push({
        fileName: row.part.fileName,
        role: "UNKNOWN",
        confidence: top ? Math.min(50, 20 + top[1].score) : 20,
        signals: top?.[1].signals ?? ["insufficient_content_evidence"],
        completeness: completenessOf(row.part),
      });
      continue;
    }
    result.push({
      fileName: row.part.fileName,
      role: top[0],
      confidence: Math.min(98, 40 + top[1].score),
      signals: top[1].signals,
      completeness: completenessOf(row.part),
    });
    if (VOLUME_ROLES.has(top[0]) && !used.has(top[0])) {
      used.set(top[0], row.part.fileName);
    }
  }

  // Complementary pass: if two files share a volume role, the weaker file
  // may keep a distinct unused runner-up that the content already supports.
  for (let i = 0; i < result.length; i++) {
    const doc = result[i]!;
    const row = scored[i]!;
    if (!VOLUME_ROLES.has(doc.role)) continue;
    const sameRoleOwners = result.filter((d) => d.role === doc.role);
    if (sameRoleOwners.length < 2) continue;
    const runner = row.ordered.find(
      ([role, info]) =>
        role !== doc.role &&
        VOLUME_ROLES.has(role) &&
        !used.has(role) &&
        info.score >= 24,
    );
    if (!runner) continue;
    const strongestSame = Math.max(
      ...scored
        .filter((_, idx) => result[idx]?.role === doc.role)
        .map((s) => s.ordered[0]?.[1].score ?? 0),
    );
    if ((row.ordered[0]?.[1].score ?? 0) >= strongestSame) continue;
    used.delete(doc.role);
    used.set(runner[0], doc.fileName);
    result[i] = {
      ...doc,
      role: runner[0],
      confidence: Math.min(90, 36 + runner[1].score),
      signals: [...runner[1].signals, "package_complementary_role"],
    };
  }

  return result;
}

export function metadataAuthority(role: PackageIdentityRole): number {
  switch (role) {
    case "NOTICE":
    case "INVITATION":
    case "INSTRUCTIONS":
    case "CORRIGENDUM":
    case "AMENDMENT":
      return 3;
    case "SCHEDULE_OF_REQUIREMENTS":
    case "TECHNICAL_SPECIFICATION":
    case "CONTRACT_FORMS":
    case "TERMS_AND_CONDITIONS":
      return 2;
    default:
      return 0;
  }
}

export function identityRoleToStiString(role: PackageIdentityRole): string {
  switch (role) {
    case "NOTICE":
      return "NOTICE";
    case "INVITATION":
      return "INVITATION";
    case "INSTRUCTIONS":
      return "INSTRUCTIONS_TO_BIDDERS";
    case "SCHEDULE_OF_REQUIREMENTS":
      return "SCHEDULE_OF_REQUIREMENTS";
    case "TECHNICAL_SPECIFICATION":
      return "TECHNICAL_SPECIFICATION";
    case "RETURNABLE_FORMS":
      return "RETURNABLE_BIDDING_FORMS";
    case "PRICING":
      return "FINANCIAL_FORMS";
    case "CONTRACT_FORMS":
      return "CONTRACT_FORM";
    case "SAMPLE_CONTRACT":
      return "SAMPLE_CONTRACT";
    case "TERMS_AND_CONDITIONS":
      return "TERMS_AND_CONDITIONS";
    case "AMENDMENT":
      return "AMENDMENT";
    case "CORRIGENDUM":
      return "CORRIGENDUM";
    case "Q_AND_A":
      return "Q_AND_A";
    case "CLARIFICATION":
      return "CLARIFICATION";
    case "PREBID_MATERIAL":
      return "PREBID_MATERIAL";
    case "QUALIFICATION":
      return "QUALIFICATION";
    case "VENDOR_GUIDE":
      return "VENDOR_GUIDE";
    case "PORTAL_GUIDE":
      return "PORTAL_GUIDE";
    case "POLICY_OR_CODE":
      return "POLICY_OR_CODE_OF_CONDUCT";
    case "ANNEX":
    case "APPENDIX":
      return "ANNEX";
    case "OTHER":
      return "OTHER";
    default:
      return "UNKNOWN";
  }
}

const SPECIFICATION_IDENTITY_ROLES = new Set<PackageIdentityRole>([
  "INSTRUCTIONS",
  "INVITATION",
  "SCHEDULE_OF_REQUIREMENTS",
  "TECHNICAL_SPECIFICATION",
  "TERMS_AND_CONDITIONS",
  "CONTRACT_FORMS",
]);

export function isSpecificationIdentityRole(role: PackageIdentityRole): boolean {
  return SPECIFICATION_IDENTITY_ROLES.has(role);
}

/** Compatibility mapping for assemble completeness only. Snapshot/STI keep identity roles. */
export function identityRoleToAssemblyHint(
  role: PackageIdentityRole,
):
  | "AVIS"
  | "CPS"
  | "RFP"
  | "TECHNICAL_SPECIFICATION"
  | "ADMINISTRATIVE"
  | "FINANCIAL"
  | "ANNEX"
  | "OTHER"
  | null {
  switch (role) {
    case "NOTICE":
      return "AVIS";
    case "INSTRUCTIONS":
    case "INVITATION":
      return "RFP";
    case "SCHEDULE_OF_REQUIREMENTS":
    case "TECHNICAL_SPECIFICATION":
      return "TECHNICAL_SPECIFICATION";
    case "CONTRACT_FORMS":
    case "SAMPLE_CONTRACT":
    case "TERMS_AND_CONDITIONS":
      return "CPS";
    case "PRICING":
      return "FINANCIAL";
    case "RETURNABLE_FORMS":
    case "QUALIFICATION":
      return "ADMINISTRATIVE";
    case "ANNEX":
    case "APPENDIX":
      return "ANNEX";
    case "UNKNOWN":
      return null;
    default:
      return "OTHER";
  }
}
