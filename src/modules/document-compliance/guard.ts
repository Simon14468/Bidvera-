/**
 * Route / RSC guard — redirect when Document Compliance is not available.
 */

import { requireCompanyId } from "@/auth/session";
import { redirect } from "next/navigation";
import { isDocumentComplianceAvailable } from "./access";

export const DOCUMENT_COMPLIANCE_DISABLED_REDIRECT = "/upgrade";

export async function requireDocumentComplianceModule(): Promise<{
  companyId: string;
}> {
  const { companyId } = await requireCompanyId();
  if (!(await isDocumentComplianceAvailable(companyId))) {
    redirect(DOCUMENT_COMPLIANCE_DISABLED_REDIRECT);
  }
  return { companyId };
}
