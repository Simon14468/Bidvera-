/**
 * AI Questionnaire Assistant — public module API (Feature 7A).
 *
 * Import ONLY from `@/modules/questionnaire-assistant`.
 * Reads persisted TenderDocument text — does not re-run Tender Analysis.
 * Draft answers are separate from Decision Engine evidence state.
 */

export {
  QUESTIONNAIRE_ASSISTANT_FEATURE_KEY,
  QUESTIONNAIRE_ASSISTANT_MODULE_ID,
  QUESTIONNAIRE_ASSISTANT_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
} from "./constants";

export {
  assertQuestionnaireAssistantAvailable,
  isQuestionnaireAssistantAvailable,
  isQuestionnaireAssistantGloballyEnabled,
  isSuperAdminEnterSession,
} from "./access";

export {
  QUESTIONNAIRE_ASSISTANT_DISABLED_REDIRECT,
  requireQuestionnaireAssistantModule,
} from "./guard";

export {
  draftTenderQuestionnaireAnswers,
  extractTenderQuestionnaires,
  getLatestTenderQuestionnaire,
  getTenderQuestionnaire,
  listTenderQuestionnaires,
  reviewTenderQuestionnaireDraft,
} from "./entry";

export type {
  QuestionnaireDraftDto,
  QuestionnairePackDto,
  QuestionnaireQuestionDto,
  QuestionnaireSectionDto,
} from "./internal/types";
