import { requireCompanyId } from "@/auth/session";
import { redirect } from "next/navigation";
import { isSupplierQualificationAvailable } from "./access";

export const SUPPLIER_QUALIFICATION_DISABLED_REDIRECT = "/upgrade";

export async function requireSupplierQualificationModule(): Promise<{
  companyId: string;
}> {
  const { companyId } = await requireCompanyId();
  if (!(await isSupplierQualificationAvailable(companyId))) {
    redirect(SUPPLIER_QUALIFICATION_DISABLED_REDIRECT);
  }
  return { companyId };
}
