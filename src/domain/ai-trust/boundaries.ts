/**
 * Data vs control-plane boundary guards.
 */

import type { DecisionType } from "@prisma/client";
import type { TrustSourceKind } from "./types";

const CONTROL_PLANE_FIELDS = new Set([
  "decision",
  "fitScore",
  "readinessScore",
  "bidScore",
  "confidence",
  "billing",
  "credits",
  "role",
  "companyId",
  "permissions",
  "authorization",
]);

/** Tender-derived content must never be labeled as verified fact without verification. */
export function assertTrustSourceSeparation(input: {
  presentedAs: TrustSourceKind;
  actualSource: TrustSourceKind;
  context: string;
}): void {
  if (input.presentedAs === "TENDER_FACT" && input.actualSource === "AI_INFERENCE") {
    throw new Error(
      `${input.context}: AI inference cannot be presented as TENDER_FACT.`,
    );
  }
  if (
    input.presentedAs === "VERIFICATION_RESULT" &&
    input.actualSource !== "VERIFICATION_RESULT"
  ) {
    throw new Error(
      `${input.context}: only canonical verification may be presented as VERIFICATION_RESULT.`,
    );
  }
}

/** Reject client-supplied canonical decision values. */
export function rejectClientProvidedDecision(input: {
  clientDecision?: DecisionType | string | null;
  serverDecision: DecisionType;
  context?: string;
}): void {
  if (input.clientDecision == null || input.clientDecision === "") return;

  const normalized =
    typeof input.clientDecision === "string"
      ? input.clientDecision.replace("-", "_").toUpperCase()
      : input.clientDecision;

  if (normalized !== input.serverDecision) {
    throw new Error(
      `${input.context ?? "canonical-guard"}: client-provided decision rejected — use server canonical data only.`,
    );
  }
}

/** Tender text must not mutate control-plane fields. */
export function assertTenderContentCannotMutateControlPlane(
  targetField: string,
): void {
  if (CONTROL_PLANE_FIELDS.has(targetField)) {
    throw new Error(
      `Control-plane field "${targetField}" cannot be set from tender document content.`,
    );
  }
}

export function isControlPlaneField(field: string): boolean {
  return CONTROL_PLANE_FIELDS.has(field);
}
