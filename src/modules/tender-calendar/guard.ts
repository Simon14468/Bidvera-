import { requireCompanyId } from "@/auth/session";
import type { AuthContext } from "@/auth/session";
import { redirect } from "next/navigation";
import { isTenderCalendarAvailable } from "./access";

export const TENDER_CALENDAR_DISABLED_REDIRECT = "/upgrade";

export async function requireTenderCalendarModule(): Promise<{
  auth: AuthContext;
  companyId: string;
}> {
  const { auth, companyId } = await requireCompanyId();
  if (!(await isTenderCalendarAvailable(companyId))) {
    redirect(TENDER_CALENDAR_DISABLED_REDIRECT);
  }
  return { auth, companyId };
}
