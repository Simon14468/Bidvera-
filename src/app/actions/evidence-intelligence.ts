"use server";

import { requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis } from "@/auth/tender-access";
import { getEvidenceIntelligenceForSession } from "@/application/evidence-intelligence";

export async function fetchEvidenceIntelligenceAction(tenderId: string) {
  const { auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  return getEvidenceIntelligenceForSession(tenderId);
}
