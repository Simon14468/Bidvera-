/**
 * Evidence Intelligence — read-only application access with permission checks.
 */

import { requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis } from "@/auth/tender-access";
import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import type { EvidenceIntelligenceBundle } from "@/domain/evidence-intelligence";
import {
  assertEvidenceIntelligenceReadOnly,
  EVIDENCE_INTELLIGENCE_INVARIANTS,
} from "@/domain/evidence-intelligence";
import { assertAiAssistReadOnly } from "@/domain/ai-trust";
import { assertFeature } from "@/services/entitlements";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * Load Evidence Intelligence for the current session — never writes to DB.
 */
export async function getEvidenceIntelligenceForSession(
  tenderId: string,
): Promise<EvidenceIntelligenceBundle> {
  assertEvidenceIntelligenceReadOnly("getEvidenceIntelligenceForSession");
  assertAiAssistReadOnly("EVIDENCE_INTELLIGENCE", "getEvidenceIntelligenceForSession");

  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  await assertFeature(companyId, "evidence_intelligence");

  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const bundle = canonical.intelligence?.evidenceIntelligence;

  if (!bundle?.computed) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Evidence Intelligence is not available for this tender yet.",
      404,
    );
  }

  return bundle;
}

export { EVIDENCE_INTELLIGENCE_INVARIANTS };
