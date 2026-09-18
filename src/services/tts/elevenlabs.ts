import { AppError, ErrorCode } from "@/lib/errors";
import { resolveAssistantElevenLabsKey } from "@/services/ai/assistant-settings";
import { logError, logInfo } from "@/services/observability";

/**
 * ElevenLabs TTS for Bidvera AI Assistant only.
 * Key from SA vault (preferred) or ELEVENLABS_API_KEY env — never NEXT_PUBLIC_*.
 */
export async function synthesizeSpeech(input: {
  text: string;
  language?: string | null;
}): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const apiKey = await resolveAssistantElevenLabsKey();
  if (!apiKey) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Voice is unavailable. Text answers still work.",
      503,
    );
  }

  const text = input.text.trim().slice(0, 2500);
  if (text.length < 1) {
    throw new AppError(ErrorCode.VALIDATION, "Nothing to speak.", 400);
  }

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";
  const modelId =
    process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  const languageCode =
    input.language === "zh"
      ? "zh"
      : input.language === "ar"
        ? "ar"
        : input.language === "es"
          ? "es"
          : input.language === "fr"
            ? "fr"
            : input.language === "en"
              ? "en"
              : undefined;

  async function request(withLanguage: boolean) {
    return fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey!,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          ...(withLanguage && languageCode ? { language_code: languageCode } : {}),
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      },
    );
  }

  let response = await request(true);
  // Some accounts/models reject language_code — retry once without it.
  if (!response.ok && response.status === 400 && languageCode) {
    response = await request(false);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logError("tts.elevenlabs_failed", {
      status: response.status,
      body: body.slice(0, 200),
    });
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "ElevenLabs API key was rejected. Update it under Super Admin → AI Knowledge.",
        502,
      );
    }
    throw new AppError(ErrorCode.UPSTREAM, "Voice synthesis failed.", 502);
  }

  const audio = await response.arrayBuffer();
  if (!audio.byteLength) {
    throw new AppError(ErrorCode.UPSTREAM, "Empty audio from ElevenLabs.", 502);
  }
  logInfo("tts.elevenlabs_ok", { bytes: audio.byteLength });
  return {
    audio,
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}
