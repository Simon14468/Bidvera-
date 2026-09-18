import type { TenderDocumentRole } from "./types";

export type TenderRoleClassification = {
  role: TenderDocumentRole;
  confidence: number;
  signals: string[];
};

/**
 * Classify the role of a tender-package document.
 * Never invents content — signals come from filename + text markers only.
 */
export function classifyTenderDocumentRole(input: {
  text: string;
  fileName: string;
}): TenderRoleClassification {
  const text = input.text;
  const lower = text.toLowerCase();
  const file = input.fileName.toLowerCase();
  const signals: string[] = [];

  let avis = 0;
  let cps = 0;
  let rfp = 0;
  let tech = 0;
  let admin = 0;
  let financial = 0;
  let annex = 0;

  // --- AVIS / tender notice (FR / EN / MY) ---
  if (
    /\bavis\s+d['’]?appel|avis\s+d['’]?ao|kenyataan\s+tender|\biklan\b|papan\s+notis|tender\s+notice|notice\s+(?:of\s+)?(?:invitation|tender)|invitation\s+to\s+tender\s+notice/i.test(
      text,
    )
  ) {
    avis += 45;
    signals.push("notice_heading");
  }
  if (/\b(avis|iklan|notis|notice|kenyataan)\b/i.test(file)) {
    avis += 30;
    signals.push("filename_notice");
  }
  if (
    /estimation\s+des\s+co[uû]ts|cautionnement\s+provisoire|ouverture\s+des\s+plis|tarikh\s+tutup|jumlah\s+harga\s+indikatif|tempoh\s+iklan/i.test(
      text,
    )
  ) {
    avis += 20;
    signals.push("notice_meta_fields");
  }
  // Short notice-like documents without CPS structure
  if (
    text.length < 8_000 &&
    /appel\s+d['’]offres|kenyataan\s+tender|tender\s+notice/i.test(text) &&
    !/cahier\s+des\s+prescriptions|cahier\s+des\s+charges|technical\s+specifications?/i.test(
      text,
    )
  ) {
    avis += 15;
    signals.push("short_notice_shape");
  }

  // --- CPS / Cahier ---
  if (
    /cahier\s+des\s+prescriptions\s+sp[eé]ciales|cahier\s+des\s+charges|\bcps\b|special\s+conditions\s+of\s+contract/i.test(
      text,
    )
  ) {
    cps += 50;
    signals.push("cps_heading");
  }
  if (/\b(cps|cahier|prescriptions)\b/i.test(file)) {
    cps += 35;
    signals.push("filename_cps");
  }
  if (
    /preambule|dispositions\s+particuli[eè]res|clauses\s+techniques|lot\s+unique/i.test(
      text,
    ) &&
    text.length > 10_000
  ) {
    cps += 15;
    signals.push("cps_structure");
  }

  // --- RFP / ITT ---
  if (
    /\brequest\s+for\s+(?:proposal|quotation|tender)|invitation\s+to\s+tender|\brfp\b|\bitt\b|\brfq\b/i.test(
      text,
    )
  ) {
    rfp += 40;
    signals.push("rfp_marker");
  }
  if (/\b(rfp|itt|rfq)\b/i.test(file)) {
    rfp += 30;
    signals.push("filename_rfp");
  }

  // --- Technical specifications ---
  if (
    /sp[eé]cifications?\s+techniques?|technical\s+specifications?|scope\s+of\s+(?:work|services)|exigences?\s+techniques?|senarai\s+semak\s+untuk\s+pematuhan\s+teknikal|\bspesifikasi\b/i.test(
      text,
    )
  ) {
    tech += 40;
    signals.push("tech_spec_marker");
  }
  if (/tech(?:nical)?[-_\s]?spec|sp[eé]cification/i.test(file)) {
    tech += 25;
    signals.push("filename_tech");
  }

  // --- Administrative ---
  if (
    /dossier\s+administratif|administrative\s+requirements?|pi[eè]ces?\s+(?:administratives?|à\s+fournir)|syarat[- ]syarat\s+am|dokumen\s+administratif/i.test(
      text,
    )
  ) {
    admin += 35;
    signals.push("admin_marker");
  }
  if (/admin|administratif/i.test(file)) {
    admin += 20;
    signals.push("filename_admin");
  }

  // --- Financial ---
  if (
    /bordereau\s+des\s+prix|pricing\s+schedule|bill\s+of\s+quantities|dossier\s+financier|pematuhan\s+kewangan|financial\s+offer/i.test(
      text,
    )
  ) {
    financial += 35;
    signals.push("financial_marker");
  }
  if (/financ|prix|pricing|boq/i.test(file)) {
    financial += 20;
    signals.push("filename_financial");
  }

  // --- Annex ---
  if (/\bannexe?\b|\bappendix\b|\bschedule\b/i.test(file) || /^annexe\s+[a-z0-9]/im.test(text)) {
    annex += 30;
    signals.push("annex_marker");
  }

  const scored: Array<{ role: TenderDocumentRole; score: number }> = [
    { role: "AVIS", score: avis },
    { role: "CPS", score: cps },
    { role: "RFP", score: rfp },
    { role: "TECHNICAL_SPECIFICATION", score: tech },
    { role: "ADMINISTRATIVE", score: admin },
    { role: "FINANCIAL", score: financial },
    { role: "ANNEX", score: annex },
  ];
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]!;

  if (top.score < 20) {
    // Weak signal: treat long obligation-heavy packs as OTHER (still tender source)
    if (lower.includes("shall") || lower.includes("doit") || lower.includes("must")) {
      return { role: "OTHER", confidence: 40, signals: [...signals, "obligation_language"] };
    }
    return { role: "OTHER", confidence: 30, signals: [...signals, "low_confidence"] };
  }

  return {
    role: top.role,
    confidence: Math.min(98, 45 + top.score),
    signals,
  };
}

/** Roles that carry technical / contractual requirements sufficient for decision scoring. */
export function isSpecificationSourceRole(role: TenderDocumentRole): boolean {
  return (
    role === "CPS" ||
    role === "RFP" ||
    role === "TECHNICAL_SPECIFICATION"
  );
}

export function isNoticeRole(role: TenderDocumentRole): boolean {
  return role === "AVIS";
}
