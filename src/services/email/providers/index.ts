/**
 * Email provider registry — extend here to add SendGrid / SES later.
 */

import { resolveEmailDeliveryConfig } from "@/services/email/resend-settings";
import { resendEmailProvider } from "./resend";
import type {
  EmailDeliveryConfig,
  EmailPayload,
  EmailProvider,
  EmailSendResult,
} from "./types";
import { logInfo } from "@/services/observability";

const providers: Record<string, EmailProvider> = {
  resend: resendEmailProvider,
};

export function registerEmailProvider(provider: EmailProvider) {
  providers[provider.id] = provider;
}

export async function getActiveEmailDelivery(): Promise<{
  config: EmailDeliveryConfig;
  provider: EmailProvider | null;
}> {
  const config = await resolveEmailDeliveryConfig();
  if (!config.ready || config.providerId === "none") {
    return { config, provider: null };
  }
  const provider = providers[config.providerId] ?? null;
  return { config, provider };
}

export async function sendViaActiveProvider(
  payload: EmailPayload,
): Promise<EmailSendResult> {
  const { config, provider } = await getActiveEmailDelivery();

  if (!config.ready || !provider) {
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd && config.reason === "disabled") {
      // Dev console fallback only when provider disabled / unconfigured
      logInfo("email.dev_fallback", {
        to: payload.to,
        subject: payload.subject,
        reason: config.reason,
        text: (payload.text ?? payload.html.replace(/<[^>]+>/g, " ")).slice(
          0,
          2000,
        ),
      });
      console.info("\n── Bidvera email (dev — provider disabled) ──────────");
      console.info(`To: ${payload.to}`);
      console.info(`Subject: ${payload.subject}`);
      console.info(payload.text ?? payload.html);
      console.info("─────────────────────────────────────────────────────\n");
      return { ok: true, mode: "dev" };
    }
    return {
      ok: false,
      mode: config.providerId === "none" ? "disabled" : "unconfigured",
      error: config.reason ?? "Email provider not ready",
    };
  }

  return provider.send(payload, config);
}

export type { EmailPayload, EmailSendResult, EmailDeliveryConfig };
