import type { Locale } from "@/i18n/config";

export type SearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | "comparison"
  | "problem"
  | "question";

export type KeywordKind =
  | "primary"
  | "secondary"
  | "long_tail"
  | "commercial"
  | "informational"
  | "problem"
  | "question"
  | "comparison"
  | "ai_conversational"
  | "synonym";

export type BidveraCapability =
  | "company_intelligence"
  | "document_compliance"
  | "supplier_qualification"
  | "client_requests_questionnaires"
  | "evidence_intelligence"
  | "decision_intelligence"
  | "opportunity_readiness"
  | "team_workflow"
  | "tender_analysis"
  | "tender_calendar"
  | "smart_alerts"
  | "decision_memory"
  | "decision_simulator"
  | "explainable_decision"
  | "pdf_export"
  | "action_plan"
  | "platform_general";

export type ContentType =
  | "solution"
  | "use_case"
  | "guide"
  | "compare"
  | "resource"
  | "faq"
  | "glossary"
  | "product"
  | "pricing"
  | "home";

export type KeywordStatus = "mapped" | "planned" | "covered_by_hub" | "blocked_off_feature";

export type DemandEvidence =
  | "unknown"
  | "web_category_presence"
  | "native_vendor_terminology"
  | "autocomplete_observed"
  | "search_console"
  | "ads_keyword_planner"
  | "google_trends";

export type KeywordEntry = {
  id: string;
  keyword: string;
  language: Locale;
  /** ISO-ish region hint; UNKNOWN when not tied to a specific market. */
  region: string;
  intent: SearchIntent;
  kind: KeywordKind;
  capability: BidveraCapability;
  topic: string;
  /** 1–100 composite priority from scoring model — not a Google ranking. */
  priority: number;
  targetUrl: string;
  contentType: ContentType;
  status: KeywordStatus;
  source: string;
  confidence: "high" | "medium" | "low";
  demandEvidence: DemandEvidence;
  /** Always UNKNOWN unless a live measured volume is available. */
  searchVolume: number | "UNKNOWN";
  notes?: string;
};

export type ScoreInput = {
  commercialIntent: number; // 0–10
  relevance: number; // 0–10
  demandEvidenceStrength: number; // 0–10 (0 if UNKNOWN)
  competition: number; // 0–10 higher = harder
  conversionPotential: number; // 0–10
  contentOpportunity: number; // 0–10
  geographicOpportunity: number; // 0–10
};

/** Transparent heuristic scoring — not Google rankings. */
export function scoreKeyword(input: ScoreInput): number {
  const raw =
    input.commercialIntent * 2.2 +
    input.relevance * 2.5 +
    input.demandEvidenceStrength * 1.2 +
    input.conversionPotential * 1.8 +
    input.contentOpportunity * 1.3 +
    input.geographicOpportunity * 1.0 -
    input.competition * 0.8;
  return Math.max(1, Math.min(100, Math.round(raw * 2.2)));
}
