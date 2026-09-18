/**
 * Source hierarchy for Decision Validation Guardian.
 *
 * A. Tender facts — authoritative, never overwritten by Internet.
 * B. Company capability — verified Bidvera evidence only.
 * C. External web — optional validation/context; never silently overwrites tender.
 */

export type GuardianSourceTier = "TENDER" | "COMPANY" | "EXTERNAL";

export type GuardianExternalClaim = {
  source: string;
  url: string | null;
  retrievedAt: string | null;
  claim: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  /** When true, claim is allowed to inform decision logic (still cannot overwrite tender facts). */
  affectsDecisionLogic: boolean;
  /** Tender fact field this claim relates to (deadline, guarantee, etc.). */
  relatedFactKey?: string | null;
  /** If set, claim attempted to replace a tender value — must fail Guardian. */
  overwritesTenderValue?: string | null;
  tenderAuthoritativeValue?: string | null;
};

export type GuardianSourceContradiction = {
  id: string;
  affectedCanonicalItemIds: string[];
  sourceA: string;
  sourceB: string;
  conflictType:
    | "DEADLINE"
    | "AMOUNT"
    | "PERCENTAGE"
    | "QUANTITY"
    | "DURATION"
    | "THRESHOLD"
    | "OBLIGATION"
    | "SECTION"
    | "OTHER";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  requiredHumanVerification: true;
};

export type GuardianRiskInput = {
  id: string;
  requirementId?: string | null;
  severity: string;
  fitStatus?: string | null;
  evidenceState?: string | null;
  title?: string | null;
};

export type GuardianDerivedDeadlineInput = {
  /** Canonical authoritative deadline */
  canonicalIso: string | null;
  canonicalTimezone: string | null;
  /** Derived representations that must agree (web label, PDF label, calendar ISO, action due). */
  representations: Array<{
    channel: "WEB" | "PDF" | "CALENDAR" | "ACTION" | "OTHER";
    iso?: string | null;
    display?: string | null;
    timezone?: string | null;
  }>;
};

export type GuardianAiClaimInput = {
  claim: string;
  groundedInTender: boolean;
  groundedInCompanyEvidence: boolean;
  affectsDecision: boolean;
};
