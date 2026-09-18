/**
 * Resend email provider — credentials never logged.
 */

import { redactEmailForLog } from "@/lib/safe-log";
import { logError, logInfo } from "@/services/observability";
import type {
  EmailDeliveryConfig,
  EmailPayload,
  EmailProvider,
  EmailSendResult,
} from "./types";

function safeResendError(status: number, body: string): string {
  // Strip anything that might echo Authorization headers / keys
  const scrubbed = body
    .replace(/re_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 240);
  return `Resend HTTP ${status}: ${scrubbed || "request failed"}`;
}

export const resendEmailProvider: EmailProvider = {
  id: "resend",

  async send(
    payload: EmailPayload,
    config: EmailDeliveryConfig,
  ): Promise<EmailSendResult> {
    const apiKey = config.apiKey?.trim() ?? "";
    if (!apiKey) {
      return { ok: false, mode: "resend", error: "Resend API key missing" };
    }
    if (!config.from.trim()) {
      return { ok: false, mode: "resend", error: "From address missing" };
    }

    try {
      const body: Record<string, unknown> = {
        from: config.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      };
      if (config.replyTo) {
        body.reply_to = config.replyTo;
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const error = safeResendError(res.status, raw);
        logError("email.resend_failed", { status: res.status, error });
        return { ok: false, mode: "resend", error };
      }

      const json = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      logInfo("email.sent", {
        to: redactEmailForLog(payload.to),
        mode: "resend",
        providerMessageId: json?.id ?? null,
      });
      return {
        ok: true,
        mode: "resend",
        providerMessageId: json?.id ?? null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 200) : "network error";
      logError("email.resend_error", { message });
      return { ok: false, mode: "resend", error: message };
    }
  },
};

/** Validate API key without sending mail — never logs the key. */
export async function validateResendApiKey(
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const key = apiKey.trim();
  if (!key.startsWith("re_")) {
    return { ok: false, error: "Resend API keys typically start with re_." };
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Invalid Resend API key." };
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return { ok: false, error: safeResendError(res.status, raw) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Resend API." };
  }
}
