/**
 * Modular notification channels.
 * Email + in-app are live; WhatsApp / SMS / push are stubs for later adapters.
 */
import { emailService } from "@/services/email";
import { escapeHtml } from "@/lib/html";
import { logInfo } from "@/services/observability";
import type { NotificationPrefs } from "@/services/notifications/prefs";

export type ChannelMessage = {
  title: string;
  message: string;
  href?: string | null;
  companyId: string;
  recipients: Array<{ email: string; name?: string | null }>;
  /** Optional type label for email subject consistency with dashboard */
  alertType?: string;
};

export interface NotificationChannel {
  readonly key: "in_app" | "email" | "whatsapp" | "sms" | "push";
  isEnabled(prefs: NotificationPrefs): boolean;
  /** Returns true when at least one outbound delivery succeeded (email). */
  deliver(
    message: ChannelMessage,
    prefs: NotificationPrefs,
  ): Promise<boolean | void>;
}

export const emailChannel: NotificationChannel = {
  key: "email",
  isEnabled(prefs) {
    return prefs.emailEnabled;
  },
  async deliver(message) {
    if (message.recipients.length === 0) return false;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = message.href
      ? message.href.startsWith("http")
        ? message.href
        : `${appUrl}${message.href}`
      : appUrl;
    const typeLabel = message.alertType
      ? message.alertType.replaceAll("_", " ")
      : null;

    const results = await Promise.all(
      message.recipients.map((r) =>
        emailService.send({
          to: r.email,
          subject: `[Bidvera] ${message.title}`,
          text: [
            message.title,
            typeLabel ? `Type: ${typeLabel}` : null,
            "",
            message.message,
            "",
            `Open in Bidvera: ${link}`,
          ]
            .filter(Boolean)
            .join("\n"),
          html: `<p><strong>${escapeHtml(message.title)}</strong></p>${
            typeLabel
              ? `<p style="color:#64748b;font-size:12px">${escapeHtml(typeLabel)}</p>`
              : ""
          }<p>${escapeHtml(message.message)}</p><p><a href="${escapeHtml(link)}">Open in Bidvera</a></p>`,
        }),
      ),
    );

    const anyOk = results.some((r) => r.ok);
    logInfo("notify.email_channel", {
      companyId: message.companyId,
      recipients: message.recipients.length,
      delivered: results.filter((r) => r.ok).length,
      modes: [...new Set(results.map((r) => r.mode))],
    });
    return anyOk;
  },
};

/** Placeholder — implement with provider SDK later. */
export const whatsappChannel: NotificationChannel = {
  key: "whatsapp",
  isEnabled(prefs) {
    return prefs.whatsappEnabled;
  },
  async deliver(message) {
    logInfo("notify.whatsapp_stub", {
      companyId: message.companyId,
      title: message.title,
    });
  },
};

export const smsChannel: NotificationChannel = {
  key: "sms",
  isEnabled(prefs) {
    return prefs.smsEnabled;
  },
  async deliver(message) {
    logInfo("notify.sms_stub", {
      companyId: message.companyId,
      title: message.title,
    });
  },
};

export const pushChannel: NotificationChannel = {
  key: "push",
  isEnabled(prefs) {
    return prefs.pushEnabled;
  },
  async deliver(message) {
    logInfo("notify.push_stub", {
      companyId: message.companyId,
      title: message.title,
    });
  },
};

export const OUTBOUND_CHANNELS: NotificationChannel[] = [
  emailChannel,
  whatsappChannel,
  smsChannel,
  pushChannel,
];
