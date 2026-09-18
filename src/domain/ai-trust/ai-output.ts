/**
 * AI assist boundaries — AI may explain/classify; never mutate authoritative state.
 */

import type { PipelineTrustStage } from "./types";
import { AI_TRUST_PRINCIPLES } from "./types";

export const AI_ASSIST_FORBIDDEN_ACTIONS = [
  "approve_tender",
  "reject_tender",
  "verify_evidence",
  "change_requirements",
  "change_readiness",
  "change_subscription",
  "grant_credits",
  "bypass_permissions",
  "modify_billing",
] as const;

export type AiAssistForbiddenAction = (typeof AI_ASSIST_FORBIDDEN_ACTIONS)[number];

const READ_ONLY_STAGES: PipelineTrustStage[] = [
  "EVIDENCE_INTELLIGENCE",
  "EXPLAINABLE_DECISION",
  "DECISION_SIMULATOR",
];

/** Application modules at read-only stages must not persist authoritative mutations. */
export function assertAiAssistReadOnly(stage: PipelineTrustStage, context: string): void {
  if (!READ_ONLY_STAGES.includes(stage)) return;
  if (!AI_TRUST_PRINCIPLES.decisionEngineIsFinalAuthority) {
    throw new Error(`AI trust misconfigured at ${context}.`);
  }
}

export function trustLabelForSourceBasis(
  basis: "DIRECT_SOURCE" | "AI_INTERPRETATION" | "COMPANY_INFORMATION" | "UNKNOWN" | string,
): "TENDER_FACT" | "COMPANY_FACT" | "AI_INFERENCE" | "UNKNOWN" {
  switch (basis) {
    case "DIRECT_SOURCE":
      return "TENDER_FACT";
    case "COMPANY_INFORMATION":
      return "COMPANY_FACT";
    case "AI_INTERPRETATION":
      return "AI_INFERENCE";
    default:
      return "UNKNOWN";
  }
}

export function assertAiCannotPerform(action: AiAssistForbiddenAction, context: string): void {
  throw new Error(
    `AI assist boundary (${context}): ${action.replace(/_/g, " ")} is forbidden — use server-side canonical services.`,
  );
}
