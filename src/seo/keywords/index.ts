import type { Locale } from "@/i18n/config";
import { keywordRegistry } from "./registry";
import { keywordEvidenceNotes } from "./evidence";
import type { BidveraCapability, KeywordEntry, SearchIntent } from "./types";
export * from "./types";
export { keywordRegistry } from "./registry";
export { keywordEvidenceNotes } from "./evidence";

export function keywordsByLanguage(language: Locale): KeywordEntry[] {
  return keywordRegistry.filter((k) => k.language === language);
}

export function keywordsByCapability(capability: BidveraCapability): KeywordEntry[] {
  return keywordRegistry.filter((k) => k.capability === capability);
}

export function keywordsByIntent(intent: SearchIntent): KeywordEntry[] {
  return keywordRegistry.filter((k) => k.intent === intent);
}

export function commercialKeywords(): KeywordEntry[] {
  return keywordRegistry.filter(
    (k) =>
      k.intent === "commercial" ||
      k.kind === "commercial" ||
      k.keyword.toLowerCase().includes("best ") ||
      k.keyword.includes("logiciel") ||
      k.keyword.includes("software") ||
      k.keyword.includes("برنامج") ||
      k.keyword.includes("软件"),
  );
}

export function questionKeywords(): KeywordEntry[] {
  return keywordRegistry.filter(
    (k) => k.intent === "question" || k.kind === "ai_conversational" || k.kind === "question",
  );
}

export function keywordsWithVerifiedDemand(): KeywordEntry[] {
  return keywordRegistry.filter(
    (k) =>
      k.demandEvidence === "web_category_presence" ||
      k.demandEvidence === "native_vendor_terminology",
  );
}

export function keywordsWithoutVolume(): KeywordEntry[] {
  return keywordRegistry.filter((k) => k.searchVolume === "UNKNOWN");
}

/** Highest registry priority mapped to a path (for sitemap boosts). */
export function maxPriorityForPath(path: string): number | null {
  const hits = keywordRegistry.filter(
    (k) => k.targetUrl === path && k.status !== "blocked_off_feature",
  );
  if (!hits.length) return null;
  return Math.max(...hits.map((k) => k.priority));
}

export function keywordToPageMap(): Array<{
  keyword: string;
  language: Locale;
  region: string;
  intent: SearchIntent;
  topic: string;
  capability: BidveraCapability;
  priority: number;
  target_url: string;
  content_type: string;
  status: string;
  source: string;
  confidence: string;
  demand_evidence: string;
  search_volume: number | "UNKNOWN";
}> {
  return keywordRegistry.map((k) => ({
    keyword: k.keyword,
    language: k.language,
    region: k.region,
    intent: k.intent,
    topic: k.topic,
    capability: k.capability,
    priority: k.priority,
    target_url: k.targetUrl,
    content_type: k.contentType,
    status: k.status,
    source: k.source,
    confidence: k.confidence,
    demand_evidence: k.demandEvidence,
    search_volume: k.searchVolume,
  }));
}

export function registrySummary() {
  return {
    total: keywordRegistry.length,
    byLanguage: {
      en: keywordsByLanguage("en").length,
      fr: keywordsByLanguage("fr").length,
      es: keywordsByLanguage("es").length,
      ar: keywordsByLanguage("ar").length,
      zh: keywordsByLanguage("zh").length,
    },
    commercial: commercialKeywords().length,
    questions: questionKeywords().length,
    verifiedDemand: keywordsWithVerifiedDemand().length,
    unknownVolume: keywordsWithoutVolume().length,
    evidence: keywordEvidenceNotes,
  };
}
