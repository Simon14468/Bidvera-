/**
 * Modular email provider contracts.
 * Smart Alerts and transactional mail depend on this — not on Resend specifically.
 */

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailSendResult = {
  ok: boolean;
  mode: string;
  /** Provider message id when available — never contains secrets */
  providerMessageId?: string | null;
  /** Safe error for logs/UI — never includes API keys */
  error?: string | null;
};

export type EmailDeliveryConfig = {
  providerId: "resend" | "dev" | "none";
  from: string;
  replyTo: string | null;
  apiKey: string | null;
  ready: boolean;
  reason?: string;
};

export interface EmailProvider {
  readonly id: string;
  send(
    payload: EmailPayload,
    config: EmailDeliveryConfig,
  ): Promise<EmailSendResult>;
}
