import { redactEmailForLog } from "@/lib/safe-log";
import { escapeHtml } from "@/lib/html";
import { logInfo } from "@/services/observability";
import { sendViaActiveProvider } from "@/services/email/providers";
import type { EmailPayload } from "@/services/email/providers/types";

export type { EmailPayload };

/**
 * Pluggable mailer: Super Admin Resend config (encrypted) → provider → send.
 * Never throws for Soft Alert paths when delivery fails — returns { ok:false }.
 * Auth flows that need hard fail can check ok.
 */
export async function sendEmail(
  payload: EmailPayload,
): Promise<{ ok: boolean; mode: string; error?: string | null }> {
  const result = await sendViaActiveProvider(payload);
  if (!result.ok) {
    logInfo("email.send_skipped_or_failed", {
      to: redactEmailForLog(payload.to),
      mode: result.mode,
      error: result.error?.slice(0, 200) ?? null,
    });
  }
  return {
    ok: result.ok,
    mode: result.mode,
    error: result.error ?? null,
  };
}

export function verificationEmail(input: {
  name: string;
  verifyUrl: string;
}): EmailPayload {
  const text = `Hi ${input.name},\n\nVerify your Bidvera email:\n${input.verifyUrl}\n\nThis link expires in 24 hours.\n`;
  return {
    to: "",
    subject: "Verify your Bidvera email",
    text,
    html: `<p>Hi ${escapeHtml(input.name)},</p>
<p>Confirm your email to continue onboarding:</p>
<p><a href="${escapeHtml(input.verifyUrl)}">Verify email</a></p>
<p style="color:#666;font-size:13px">Or paste this link: ${escapeHtml(input.verifyUrl)}</p>
<p style="color:#666;font-size:13px">Expires in 24 hours.</p>`,
  };
}

export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
}): EmailPayload {
  const text = `Hi ${input.name},\n\nReset your Bidvera password:\n${input.resetUrl}\n\nIf you did not request this, ignore this email. Link expires in 1 hour.\n`;
  return {
    to: "",
    subject: "Reset your Bidvera password",
    text,
    html: `<p>Hi ${escapeHtml(input.name)},</p>
<p>Reset your password:</p>
<p><a href="${escapeHtml(input.resetUrl)}">Reset password</a></p>
<p style="color:#666;font-size:13px">Or paste: ${escapeHtml(input.resetUrl)}</p>
<p style="color:#666;font-size:13px">Expires in 1 hour. If you did not request this, ignore the email.</p>`,
  };
}

export function emailChangeConfirmEmail(input: {
  name: string;
  newEmail: string;
  confirmUrl: string;
  expiresMinutes?: number;
}): EmailPayload {
  const minutes = input.expiresMinutes ?? 45;
  const text = `Hi ${input.name},

Confirm this email address (${input.newEmail}) for your Bidvera account:
${input.confirmUrl}

This link expires in ${minutes} minutes and can be used only once.
If you did not request this change, ignore this email — your account email will stay the same.
`;
  return {
    to: "",
    subject: "Confirm your new Bidvera email",
    text,
    html: `<p><strong>Bidvera</strong></p>
<p>Hi ${escapeHtml(input.name)},</p>
<p>An email change was requested for your Bidvera account. Confirm <strong>${escapeHtml(input.newEmail)}</strong> as your new sign-in email:</p>
<p><a href="${escapeHtml(input.confirmUrl)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">Confirm email change</a></p>
<p style="color:#666;font-size:13px">Or paste this link: ${escapeHtml(input.confirmUrl)}</p>
<p style="color:#666;font-size:13px">Expires in ${minutes} minutes · single use. If you did not request this, ignore the email — nothing changes until you confirm.</p>`,
  };
}

export function emailChangeNotifyEmail(input: {
  name: string;
  newEmail: string;
  currentEmail?: string;
  requestedAt?: string;
}): EmailPayload {
  const when = input.requestedAt
    ? new Date(input.requestedAt).toUTCString()
    : new Date().toUTCString();
  const text = `Hi ${input.name},

A request was made to change your Bidvera account email to ${input.newEmail}.

Your current email (${input.currentEmail ?? "this address"}) has NOT changed yet.
A confirmation link was sent to the new address. The change completes only after that link is used.

Requested at (UTC): ${when}

If you did not request this, sign in immediately, change your password, and contact support. Do not forward this message.
`;
  return {
    to: "",
    subject: "Security alert: Bidvera email change requested",
    text,
    html: `<p><strong>Bidvera</strong> · Security alert</p>
<p>Hi ${escapeHtml(input.name)},</p>
<p>A request was made to change your Bidvera account email to <strong>${escapeHtml(input.newEmail)}</strong>.</p>
<p><strong>Your current email has not changed yet.</strong> A confirmation link was sent to the new address. The change completes only after that link is used.</p>
<p style="color:#666;font-size:13px">Requested at (UTC): ${escapeHtml(when)}</p>
<p style="color:#666;font-size:13px">If you did not request this, sign in, change your password, and contact support. This message never contains passwords or confirmation links.</p>`,
  };
}

/** Back-compat adapter for alerts / notifications */
export const emailService = {
  async send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    return sendEmail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<p>${escapeHtml(input.text)}</p>`,
    });
  },
};
