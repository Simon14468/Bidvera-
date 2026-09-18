import { requireCompanyId } from "@/auth/session";
import { redirect } from "next/navigation";
import { isClientRequestsAvailable } from "./access";

export const CLIENT_REQUESTS_DISABLED_REDIRECT = "/upgrade";

export async function requireClientRequestsModule(): Promise<{ companyId: string }> {
  const { companyId } = await requireCompanyId();
  if (!(await isClientRequestsAvailable(companyId))) {
    redirect(CLIENT_REQUESTS_DISABLED_REDIRECT);
  }
  return { companyId };
}
