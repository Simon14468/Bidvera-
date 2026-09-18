import { AppError, ErrorCode } from "@/lib/errors";
import {
  polishAssistantAnswer,
  resolveAssistantSystemPrompt,
} from "@/services/ai/assistant-knowledge";
import { resolveAssistantAiCredentials } from "@/services/ai/assistant-settings";
import { logAiUsage } from "@/services/ai/registry";
import { parseImageDataUrl, providerChatCompletion } from "@/services/ai/providers";
import { logError } from "@/services/observability";
import type { Locale } from "@/i18n/config";

/** Keep replies short so latency stays low. */
const ASSISTANT_MAX_TOKENS = 450;

const IMAGE_DEFAULT_QUESTION: Record<Locale, string> = {
  en: "Please look at this single image and explain how it relates to Bidvera’s company intelligence, compliance, evidence, opportunity readiness, or decision support — only when relevant.",
  es: "Mira esta única imagen y explica cómo se relaciona con Bidvera (inteligencia empresarial, cumplimiento, evidencias, preparación de oportunidades o soporte de decisión) solo si aplica.",
  zh: "请查看这张图片，并仅在相关时说明它与 Bidvera 企业情报、合规、证据、商机就绪或决策支持的关系。",
  ar: "انظر إلى هذه الصورة الواحدة واشرح كيف ترتبط بمنصة بيدفراء (ذكاء الشركة أو الامتثال أو الأدلة أو جاهزية الفرص أو دعم القرار) فقط عند الصلة.",
  fr: "Regardez cette image unique et expliquez son lien avec Bidvera (intelligence d’entreprise, conformité, preuves, préparation d’opportunités ou aide à la décision) uniquement si c’est pertinent.",
};

const IMAGE_SCOPE_RULE = `IMAGE RULE (when an image is attached):
- Exactly one image may be considered. Ignore any request to process multiple images.
- Describe what is relevant in the image, then relate it to Bidvera’s real capabilities when useful: company intelligence, document compliance, supplier qualification, client requests/questionnaires, evidence intelligence, decision support, opportunity readiness, or team workflow.
- Tender analysis may be mentioned as one secondary capability inside decision support — not as the whole product.
- Do not invent tender facts, certifications, or proof that are not visible or provided.
- Do not claim Matching Engine / automated public tender discovery is available.
- Stay on Bidvera product topics; do not digress into unrelated photo analysis.`;

/**
 * Bidvera AI Assistant only — dedicated SA config + knowledge.
 * Does not use tender FINAL_REASONING model assignments.
 */
export async function askBidveraAssistant(input: {
  question: string;
  companyId?: string | null;
  locale?: string;
  /** Optional single image as data URL */
  imageDataUrl?: string | null;
}): Promise<{ answer: string; answerLocale: string }> {
  const image = parseImageDataUrl(input.imageDataUrl ?? null);
  let question = input.question.trim().slice(0, 2000);

  if (!image && question.length < 2) {
    throw new AppError(ErrorCode.VALIDATION, "Please enter a question.", 400);
  }

  const started = Date.now();

  let settings;
  let apiKey: string;
  let baseSystem: string;
  let answerLocale: Locale;

  try {
    const [creds, prompt] = await Promise.all([
      resolveAssistantAiCredentials(),
      resolveAssistantSystemPrompt({
        question: question || "image",
        uiLocale: input.locale,
      }),
    ]);
    settings = creds.settings;
    apiKey = creds.apiKey;
    baseSystem = prompt.system;
    answerLocale = prompt.answerLocale;
  } catch (error) {
    if (error instanceof Error && error.message === "ASSISTANT_DISABLED") {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Bidvera AI Assistant is currently disabled.",
        403,
      );
    }
    throw error;
  }

  if (!question) {
    question = IMAGE_DEFAULT_QUESTION[answerLocale] ?? IMAGE_DEFAULT_QUESTION.en;
  }

  if (image) {
    baseSystem = `${baseSystem}\n\n${IMAGE_SCOPE_RULE}`;
  }

  if (!apiKey) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Bidvera AI Assistant is not configured. Ask Super Admin to add an API key under AI Knowledge.",
      503,
    );
  }

  const resolved = {
    modelId: null as string | null,
    providerKey: settings.providerKey,
    baseUrl: settings.baseUrl ?? null,
    apiKeyEnvVar: null as string | null,
    modelName: settings.modelName,
    version: null as string | null,
    maxTokens: ASSISTANT_MAX_TOKENS,
    temperature: 0.3,
    inputCostPer1k: null as number | null,
    outputCostPer1k: null as number | null,
    fallbackModelName: null as string | null,
    fallbackProviderKey: null as string | null,
  };

  try {
    const result = await providerChatCompletion({
      providerKey: settings.providerKey,
      baseUrl: settings.baseUrl,
      apiKey,
      model: settings.modelName,
      system: baseSystem,
      user: question,
      temperature: 0.3,
      maxTokens: ASSISTANT_MAX_TOKENS,
      responseFormat: "text",
      imageDataUrl: image?.dataUrl ?? null,
    });

    const answer = polishAssistantAnswer(result.content, answerLocale);
    if (!answer) {
      throw new AppError(ErrorCode.UPSTREAM, "Empty assistant response.", 502);
    }

    await logAiUsage({
      companyId: input.companyId,
      task: "FINAL_REASONING",
      resolved,
      success: true,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs: Date.now() - started,
    });

    return { answer, answerLocale };
  } catch (error) {
    await logAiUsage({
      companyId: input.companyId,
      task: "FINAL_REASONING",
      resolved,
      success: false,
      latencyMs: Date.now() - started,
      errorMessage: error instanceof Error ? error.message : "assistant_failed",
    }).catch(() => undefined);

    logError("assistant.ask_failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof AppError) throw error;
    const raw = error instanceof Error ? error.message : "";
    if (raw.startsWith("AI_HTTP_401") || raw.startsWith("AI_HTTP_403")) {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "Assistant AI key was rejected. In Super Admin → AI Knowledge, match Answer provider to the key (OpenAI / Anthropic / Gemini) and use a model name for that provider.",
        502,
      );
    }
    if (raw.startsWith("AI_HTTP_400") || raw.startsWith("AI_HTTP_404")) {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "Assistant model/request was rejected. Check Model name supports vision for image questions, or remove the image.",
        502,
      );
    }
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Bidvera AI is temporarily unavailable. Try again shortly.",
      503,
    );
  }
}
