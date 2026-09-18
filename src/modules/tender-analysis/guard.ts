/**
 * Route / RSC guard — redirect when Tender Analysis is not available to the user.
 */

import { requireCompanyId } from "@/auth/session";
import { redirect } from "next/navigation";
import { isTenderAnalysisAvailable } from "./access";

export const TENDER_ANALYSIS_DISABLED_REDIRECT = "/dashboard";

/**
 * Call from Tender Analysis app pages. Super Admin enter-sessions still pass
 * when the module is globally disabled (operator testing).
 */
export async function requireTenderAnalysisModule(): Promise<{ companyId: string }> {
  const { companyId } = await requireCompanyId();
  if (!(await isTenderAnalysisAvailable(companyId))) {
    redirect(TENDER_ANALYSIS_DISABLED_REDIRECT);
  }
  return { companyId };
}
