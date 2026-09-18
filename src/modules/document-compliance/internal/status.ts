import type { ComplianceStatus } from "@prisma/client";
import { daysBetweenDateOnly, todayDateOnly } from "./date-only";

export type StatusInput = {
  expiryDateYmd: string | null;
  /** True when extraction could not confirm expiry facts. */
  uncertain: boolean;
  /** Explicit evidence that the document has no expiry. */
  noExpiry: boolean;
  expiringSoonDays?: number;
  todayYmd?: string;
};

/**
 * Derive ComplianceStatus from date-only expiry facts.
 * Never invents an expiry — missing/uncertain → NO_EXPIRY or UNKNOWN.
 */
export function computeComplianceStatus(input: StatusInput): ComplianceStatus {
  const today = input.todayYmd ?? todayDateOnly();
  const soonDays = input.expiringSoonDays ?? 90;

  if (input.expiryDateYmd) {
    const daysLeft = daysBetweenDateOnly(today, input.expiryDateYmd);
    if (daysLeft < 0) return "EXPIRED";
    if (daysLeft <= soonDays) return "EXPIRING_SOON";
    return "VALID";
  }
  if (input.uncertain) return "UNKNOWN";
  return "NO_EXPIRY";
}
