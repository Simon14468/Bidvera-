import type { Dictionary } from "@/i18n/dictionaries";

export type PricingFeatureKey = keyof Dictionary["pricing"]["features"];
export type PricingGroupId = keyof Dictionary["pricing"]["groups"];

export const PRICING_FEATURE_GROUPS: Array<{
  id: PricingGroupId;
  keys: PricingFeatureKey[];
}> = [
  {
    id: "readiness",
    keys: ["company_profile", "document_compliance", "supplier_qualification"],
  },
  {
    id: "opportunities",
    keys: ["client_requests", "tender_calendar"],
  },
  {
    id: "intelligence",
    keys: [
      "evidence_intelligence",
      "advanced_decision_engine",
      "decision_memory",
      "decision_simulator",
      "explainable_decision",
    ],
  },
  {
    id: "workflow",
    keys: [
      "questionnaire_assistant",
      "smart_alerts",
      "team_collaboration",
      "pdf_export",
      "tender_action_plan",
    ],
  },
];

export function planHasFeature(enabledKeys: string[], key: string): boolean {
  return enabledKeys.includes(key);
}
