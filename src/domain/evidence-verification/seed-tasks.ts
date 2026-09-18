/**
 * Team workflow seed candidates for requirements needing human verification.
 */

import type { RequirementVerificationChain } from "@/domain/evidence-verification/types";
import type { SeedTaskCandidate } from "@/domain/team-workflow";
import {
  buildTaskDedupeKey,
  suggestDepartmentForKind,
} from "@/domain/team-workflow";

export function buildVerificationSeedCandidates(input: {
  companyId: string;
  tenderId: string;
  tenderDeadline: Date | null;
  chains: RequirementVerificationChain[];
}): SeedTaskCandidate[] {
  const out: SeedTaskCandidate[] = [];

  for (const chain of input.chains) {
    if (chain.verificationStatus !== "NEEDS_VERIFICATION") continue;

    const kind = "EVIDENCE_REQUEST" as const;
    out.push({
      kind,
      title: `Verify evidence: ${chain.requirement.slice(0, 120)}`,
      description:
        chain.verificationReason ??
        "Evidence requires human verification before it can be treated as confirmed.",
      requiredResponse:
        "Confirm evidence validity with source document and page reference, or document why verification cannot be completed.",
      department: suggestDepartmentForKind(kind, chain.requirement),
      priority: chain.mandatory ? "HIGH" : "MEDIUM",
      deadline: input.tenderDeadline,
      dedupeKey: buildTaskDedupeKey({
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind,
        sourceId: `verify:${chain.requirementId}`,
      }),
      requirementId: chain.requirementId,
    });
  }

  return out;
}
