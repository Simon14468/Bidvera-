import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  QUESTIONNAIRE_ASSISTANT_FEATURE_KEY,
  QUESTIONNAIRE_ASSISTANT_MODULE_NAME,
} from "./constants";

export async function isQuestionnaireAssistantGloballyEnabled(): Promise<boolean> {
  const feature = await prisma.feature.findUnique({
    where: { key: QUESTIONNAIRE_ASSISTANT_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  return feature?.enabledGlobal ?? true;
}

export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

export async function isQuestionnaireAssistantAvailable(
  companyId: string,
): Promise<boolean> {
  if (await hasFeature(companyId, QUESTIONNAIRE_ASSISTANT_FEATURE_KEY)) return true;
  const globallyOn = await isQuestionnaireAssistantGloballyEnabled();
  if (!globallyOn && (await isSuperAdminEnterSession())) return true;
  return false;
}

export async function assertQuestionnaireAssistantAvailable(
  companyId: string,
): Promise<void> {
  if (await isQuestionnaireAssistantAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${QUESTIONNAIRE_ASSISTANT_MODULE_NAME} is not available.`,
    403,
  );
}
