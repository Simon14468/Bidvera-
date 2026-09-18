/**
 * Client-side and cross-tenant security guards.
 */

import type { DecisionType } from "@prisma/client";
import { rejectClientProvidedDecision } from "./boundaries";

const CLIENT_CANONICAL_FIELDS = [
  "decision",
  "fitScore",
  "readinessScore",
  "bidScore",
  "confidence",
  "verificationStatus",
  "requirementStatus",
  "planId",
  "priceCents",
  "credits",
] as const;

export type ClientCanonicalField = (typeof CLIENT_CANONICAL_FIELDS)[number];

/** Reject when client sends a canonical value that diverges from server state. */
export function rejectClientProvidedCanonicalField(input: {
  field: ClientCanonicalField;
  clientValue: unknown;
  serverValue: unknown;
  context?: string;
}): void {
  if (input.clientValue == null || input.clientValue === "") return;
  if (input.field === "decision") {
    rejectClientProvidedDecision({
      clientDecision: input.clientValue as DecisionType | string,
      serverDecision: input.serverValue as DecisionType,
      context: input.context,
    });
    return;
  }
  if (String(input.clientValue) !== String(input.serverValue)) {
    throw new Error(
      `${input.context ?? "client-guard"}: client-provided ${input.field} rejected — use server canonical data only.`,
    );
  }
}

/** Enforce tenant scope on loaded resources. */
export function assertTenantResourceScope(input: {
  resourceCompanyId: string;
  sessionCompanyId: string;
  resourceLabel?: string;
}): void {
  if (input.resourceCompanyId !== input.sessionCompanyId) {
    throw new Error(
      `Cross-tenant access blocked${input.resourceLabel ? ` (${input.resourceLabel})` : ""}.`,
    );
  }
}

export function listClientCanonicalFields(): readonly ClientCanonicalField[] {
  return CLIENT_CANONICAL_FIELDS;
}
