import { assertQuestionnaireAssistantAvailable } from "./access";
import {
  extractQuestionnairesForTender,
  generateDraftAnswersForPack,
  getLatestQuestionnaireForTender,
  getQuestionnairePack,
  listQuestionnairePacks,
  reviewDraftAnswer,
} from "./internal";

export async function listTenderQuestionnaires(companyId: string, tenderId: string) {
  await assertQuestionnaireAssistantAvailable(companyId);
  return listQuestionnairePacks(companyId, tenderId);
}

export async function getTenderQuestionnaire(companyId: string, packId: string) {
  await assertQuestionnaireAssistantAvailable(companyId);
  return getQuestionnairePack(companyId, packId);
}

export async function getLatestTenderQuestionnaire(
  companyId: string,
  tenderId: string,
) {
  await assertQuestionnaireAssistantAvailable(companyId);
  return getLatestQuestionnaireForTender(companyId, tenderId);
}

export async function extractTenderQuestionnaires(input: {
  companyId: string;
  tenderId: string;
  force?: boolean;
}) {
  await assertQuestionnaireAssistantAvailable(input.companyId);
  return extractQuestionnairesForTender(input);
}

export async function draftTenderQuestionnaireAnswers(input: {
  companyId: string;
  packId: string;
  questionIds?: string[];
}) {
  await assertQuestionnaireAssistantAvailable(input.companyId);
  const { consumeAiQuota } = await import("@/services/entitlements/ai-quota");
  await consumeAiQuota({
    companyId: input.companyId,
    task: "CLASSIFICATION",
    operation: "questionnaire_assistant",
  });
  return generateDraftAnswersForPack(input);
}

export async function reviewTenderQuestionnaireDraft(input: {
  companyId: string;
  questionId: string;
  action: "approve" | "reject" | "edit";
  editedText?: string | null;
  actorUserId?: string | null;
}) {
  await assertQuestionnaireAssistantAvailable(input.companyId);
  return reviewDraftAnswer(input);
}
