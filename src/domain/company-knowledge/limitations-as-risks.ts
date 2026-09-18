import type { CompanyKnowledge } from "./types";

export type KnowledgeRisk = {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  description: string;
  sourceDocument: string | null;
  sourcePage: number | null;
  excerpt: string | null;
};

/**
 * Surface company limitations only when they intersect the current tender.
 * Do NOT convert every limitation into a tender risk.
 */
export function risksFromRelevantLimitations(input: {
  knowledge: CompanyKnowledge;
  tenderText: string;
  estimatedValue: number | null;
}): KnowledgeRisk[] {
  const risks: KnowledgeRisk[] = [];
  const tender = input.tenderText.toLowerCase();

  for (const lim of input.knowledge.limitations) {
    const v = lim.value.toLowerCase();
    let relevant = false;
    let severity: KnowledgeRisk["severity"] = "MEDIUM";

    if (/iso\s*27001/i.test(v) && /iso\s*27001/i.test(tender)) {
      relevant = true;
      severity = "CRITICAL";
    } else if (/24\s*\/\s*7|round[- ]the[- ]clock/i.test(v) && /24\s*\/\s*7|24x7|round[- ]the[- ]clock/i.test(tender)) {
      relevant = true;
      severity = "HIGH";
    } else if (/healthcare/i.test(v) && /healthcare|hospital|clinical/i.test(tender)) {
      relevant = true;
      severity = "HIGH";
    } else if (
      /above\s+mad\s*1[\s,]*000[\s,]*000|mad\s*1[\s,]*000[\s,]*000/i.test(v) &&
      input.estimatedValue != null &&
      input.estimatedValue > 1_000_000
    ) {
      relevant = true;
      severity = "HIGH";
    } else if (/international/i.test(v) && /international|cross-border|overseas/i.test(tender)) {
      relevant = true;
      severity = "MEDIUM";
    } else if (/onsite|permanent onsite|large.*team|capacity/i.test(v) && /onsite|dedicated team|24\/7/i.test(tender)) {
      relevant = true;
      severity = "MEDIUM";
    }

    if (!relevant) continue;
    risks.push({
      severity,
      category: "company_limitation",
      description: `Relevant company limitation: ${lim.value}`,
      sourceDocument: lim.provenance.sourceDocument,
      sourcePage: typeof lim.provenance.page === "number" ? lim.provenance.page : null,
      excerpt: lim.provenance.excerpt,
    });
  }

  // Contract capacity vs tender value
  const max = input.knowledge.contractCapacity.preferredMaxNumeric;
  if (
    max != null &&
    input.estimatedValue != null &&
    input.estimatedValue > max * 1.5
  ) {
    const prov = input.knowledge.contractCapacity.provenance;
    risks.push({
      severity: "HIGH",
      category: "capacity",
      description: `Tender value exceeds stated preferred contract capacity (${input.knowledge.contractCapacity.preferredMax}).`,
      sourceDocument: prov?.sourceDocument ?? null,
      sourcePage: typeof prov?.page === "number" ? prov.page : null,
      excerpt: prov?.excerpt ?? null,
    });
  }

  // Explicit NOT_HELD certifications mentioned in tender
  for (const cert of input.knowledge.certifications.filter((c) => c.status === "NOT_HELD")) {
    const needle = cert.name.replace(/\s+/g, "\\s*");
    if (new RegExp(needle, "i").test(input.tenderText)) {
      risks.push({
        severity: "CRITICAL",
        category: "certification",
        description: `Tender references ${cert.name}, which the company profile marks as not held.`,
        sourceDocument: cert.provenance.sourceDocument,
        sourcePage: typeof cert.provenance.page === "number" ? cert.provenance.page : null,
        excerpt: cert.detail,
      });
    }
  }

  return risks;
}

export function missingDocumentsFromKnowledge(input: {
  knowledge: CompanyKnowledge;
  tenderText: string;
}): { documentName: string; reason: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }[] {
  const missing: {
    documentName: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }[] = [];

  for (const cert of input.knowledge.certifications.filter((c) => c.status === "NOT_HELD")) {
    const needle = cert.name.replace(/\s+/g, "\\s*");
    if (new RegExp(needle, "i").test(input.tenderText)) {
      missing.push({
        documentName: `${cert.name} certification`,
        reason: `Company profile explicitly states ${cert.name} is not held.`,
        severity: "CRITICAL",
      });
    }
  }

  return missing;
}
