import { requireCompanyId, type AuthContext } from "@/auth/session";
import { redirect } from "next/navigation";
import { isMatchingEngineAvailable } from "./access";
import { MATCHING_ENGINE_DISABLED_REDIRECT } from "./constants";

export { MATCHING_ENGINE_DISABLED_REDIRECT };

export async function requireMatchingEngineModule(): Promise<{
  companyId: string;
  auth: AuthContext;
}> {
  const { companyId, auth } = await requireCompanyId();
  if (!(await isMatchingEngineAvailable(companyId))) {
    redirect(MATCHING_ENGINE_DISABLED_REDIRECT);
  }
  return { companyId, auth };
}
