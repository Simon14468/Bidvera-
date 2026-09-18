import { requireCompanyId } from "@/auth/session";
import { redirect } from "next/navigation";
import { isQuestionnaireAssistantAvailable } from "./access";

export const QUESTIONNAIRE_ASSISTANT_DISABLED_REDIRECT = "/upgrade";

export async function requireQuestionnaireAssistantModule(): Promise<{
  companyId: string;
}> {
  const { companyId } = await requireCompanyId();
  if (!(await isQuestionnaireAssistantAvailable(companyId))) {
    redirect(QUESTIONNAIRE_ASSISTANT_DISABLED_REDIRECT);
  }
  return { companyId };
}
