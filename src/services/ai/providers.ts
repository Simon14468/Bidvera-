import {
  AI_REQUEST_TIMEOUT_MS,
  AiRequestTimeoutError,
} from "@/config/ai-timeout";
import {
  AI_PROVIDER_OPTIONS,
  getProviderOption,
  type AiProviderOptionKey,
} from "@/config/ai-providers";
import {
  assertSafeAiBaseUrl,
  isUnsafeOutboundRedirectLocation,
} from "@/domain/security/safe-outbound-url";
import { AppError, ErrorCode } from "@/lib/errors";
import { resolveProviderApiKey } from "@/services/ai/provider-keys";
import { logInfo } from "@/services/observability";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Do not follow redirects — Location could point at link-local/metadata.
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (isUnsafeOutboundRedirectLocation(location, url)) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "AI provider redirect target is not allowed.",
          400,
        );
      }
      throw new AppError(
        ErrorCode.VALIDATION,
        "AI provider redirects are not followed.",
        400,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiRequestTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatCompletionInput {
  providerKey: string;
  baseUrl?: string | null;
  apiKeyEnvVar?: string | null;
  /** Direct key override (assistant-only vault). Never log this. */
  apiKey?: string | null;
  model: string;
  system: string;
  user: string;
  temperature?: number | null;
  maxTokens?: number | null;
  /** Default `json` preserves tender pipeline behavior. Use `text` for free-form assistant replies. */
  responseFormat?: "json" | "text";
  /** Optional single image as a data URL (data:image/...;base64,...). */
  imageDataUrl?: string | null;
}

export interface ChatCompletionResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function parseImageDataUrl(dataUrl: string | null | undefined): {
  mime: string;
  base64: string;
  dataUrl: string;
} | null {
  if (!dataUrl?.startsWith("data:")) return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mime = match[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  if (!ALLOWED_IMAGE_MIME.has(mime)) return null;
  const base64 = match[2]!.replace(/\s+/g, "");
  if (base64.length < 32 || base64.length > 5_500_000) return null;
  return { mime, base64, dataUrl: `data:${mime};base64,${base64}` };
}

function resolveBaseUrl(providerKey: string, baseUrl?: string | null): string {
  if (baseUrl) {
    const safe = assertSafeAiBaseUrl(baseUrl);
    if (!safe) {
      throw new AppError(ErrorCode.VALIDATION, "AI base URL is not allowed.", 400);
    }
    return safe;
  }
  const option = getProviderOption(providerKey);
  // Catalog defaults are compile-time https public endpoints — still normalize.
  return assertSafeAiBaseUrl(option?.defaultBaseUrl ?? "https://api.openai.com/v1")!;
}

/** Prefer provider message; never include API keys from error payloads. */
async function aiHttpError(response: Response): Promise<Error> {
  const status = response.status;
  let detail = "";
  try {
    const text = await response.text();
    const truncated = text.slice(0, 400);
    try {
      const json = JSON.parse(truncated) as {
        error?: { message?: string; status?: string; code?: number } | string;
        message?: string;
      };
      detail =
        (typeof json.error === "string"
          ? json.error
          : json.error?.message) ||
        json.message ||
        truncated;
    } catch {
      detail = truncated;
    }
  } catch {
    detail = "";
  }
  const cleaned = detail.replace(/\s+/g, " ").trim().slice(0, 240);
  return new Error(
    cleaned ? `AI_HTTP_${status}: ${cleaned}` : `AI_HTTP_${status}`,
  );
}

async function chatOpenAiCompatible(
  input: ChatCompletionInput,
  apiKey: string,
): Promise<ChatCompletionResult> {
  const base = resolveBaseUrl(input.providerKey, input.baseUrl);
  const asJson = (input.responseFormat ?? "json") === "json";
  const image = parseImageDataUrl(input.imageDataUrl);
  const userContent = image
    ? [
        { type: "text", text: input.user },
        { type: "image_url", image_url: { url: image.dataUrl } },
      ]
    : input.user;
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.1,
      ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
      ...(asJson ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    throw await aiHttpError(response);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    content: json.choices?.[0]?.message?.content ?? (asJson ? "{}" : ""),
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
  };
}

async function chatAnthropic(
  input: ChatCompletionInput,
  apiKey: string,
): Promise<ChatCompletionResult> {
  const base = resolveBaseUrl("anthropic", input.baseUrl);
  const asJson = (input.responseFormat ?? "json") === "json";
  const system = asJson
    ? `${input.system}\n\nRespond with valid JSON only.`
    : input.system;
  const image = parseImageDataUrl(input.imageDataUrl);
  const userContent = image
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: image.mime,
            data: image.base64,
          },
        },
        { type: "text", text: input.user },
      ]
    : input.user;
  const response = await fetchWithTimeout(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature ?? 0.1,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    throw await aiHttpError(response);
  }

  const json = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = json.content?.find((c) => c.type === "text")?.text ?? (asJson ? "{}" : "");

  return {
    content: text,
    tokensIn: json.usage?.input_tokens ?? 0,
    tokensOut: json.usage?.output_tokens ?? 0,
  };
}

async function chatGemini(
  input: ChatCompletionInput,
  apiKey: string,
): Promise<ChatCompletionResult> {
  const base = resolveBaseUrl("google", input.baseUrl);
  const modelId = input.model.replace(/^models\//, "").trim();
  const model = encodeURIComponent(modelId);
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`;
  const asJson = (input.responseFormat ?? "json") === "json";
  const systemText = asJson
    ? `${input.system}\nRespond with JSON only.`
    : input.system;
  const image = parseImageDataUrl(input.imageDataUrl);
  const parts: Array<Record<string, unknown>> = [{ text: input.user }];
  if (image) {
    parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
  }
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: input.temperature ?? 0.1,
        ...(input.maxTokens ? { maxOutputTokens: input.maxTokens } : {}),
        ...(asJson ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!response.ok) {
    throw await aiHttpError(response);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const content =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    (asJson ? "{}" : "");

  return {
    content,
    tokensIn: json.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Provider-agnostic chat completion.
 * Routes by provider key from configuration — never hard-codes a single vendor in callers.
 */
export async function providerChatCompletion(
  input: ChatCompletionInput,
): Promise<ChatCompletionResult> {
  const key = input.providerKey as AiProviderOptionKey | string;
  const apiKey =
    input.apiKey?.trim() || (await resolveProviderApiKey(key, input.apiKeyEnvVar));
  if (!apiKey) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      `API key not configured for provider "${key}". Add it in Super Admin → AI models or set the env var.`,
      503,
    );
  }

  logInfo("ai.provider.chat", { provider: key, model: input.model });

  if (key === "anthropic") return chatAnthropic(input, apiKey);
  if (key === "google") return chatGemini(input, apiKey);
  // openai + any openai-compatible custom providers
  return chatOpenAiCompatible(input, apiKey);
}

/** Lightweight connectivity probe for Super Admin “Test Model”. */
export async function testProviderModelConnection(input: {
  providerKey: string;
  baseUrl?: string | null;
  apiKeyEnvVar?: string | null;
  model: string;
}): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const started = Date.now();
  try {
    const result = await providerChatCompletion({
      providerKey: input.providerKey,
      baseUrl: input.baseUrl,
      apiKeyEnvVar: input.apiKeyEnvVar,
      model: input.model,
      system: "Reply with JSON only.",
      user: JSON.stringify({ ping: true, reply: { ok: true } }),
      temperature: 0,
      maxTokens: 64,
    });
    const latencyMs = Date.now() - started;
    if (!result.content) {
      return { ok: false, latencyMs, message: "Empty response from provider." };
    }
    return {
      ok: true,
      latencyMs,
      message: `Connected (${latencyMs}ms). Provider responded.`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export async function listKnownProviders() {
  const { getProviderKeyStatus } = await import("@/services/ai/provider-keys");
  const status = await getProviderKeyStatus();
  return AI_PROVIDER_OPTIONS.map((p) => ({
    key: p.key,
    name: p.name,
    defaultBaseUrl: p.defaultBaseUrl,
    apiKeyEnvVar: p.apiKeyEnvVar,
    keyConfigured: status[p.key].configured,
    hasVaultKey: status[p.key].hasVaultKey,
    hasEnvKey: status[p.key].hasEnvKey,
  }));
}
