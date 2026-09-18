/**
 * Super Admin — Resend email provider management.
 */

import type { SuperAdminContext } from "@/auth/super-admin-session";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import { sendEmail } from "@/services/email";
import {
  getResendAdminSnapshot,
  maskEmail,
  recordResendTestResult,
  resendAuditSafeSnapshot,
  saveResendAdminSettings,
  type ResendAdminSnapshot,
} from "@/services/email/resend-settings";
import { z } from "zod";

const testEmailSchema = z.object({
  to: z.string().trim().email().max(320),
});

export async function getEmailSettingsForAdmin(): Promise<ResendAdminSnapshot> {
  return getResendAdminSnapshot();
}

export async function saveEmailSettingsForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const before = resendAuditSafeSnapshot(await getResendAdminSnapshot());
  const snap = await saveResendAdminSettings(
    raw as Parameters<typeof saveResendAdminSettings>[0],
  );
  const after = resendAuditSafeSnapshot(snap);

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "EMAIL_RESEND_SETTINGS_UPDATED",
    targetType: "email_provider",
    targetId: "resend",
    previousValue: before,
    newValue: after,
    ipHash,
    metadata: {
      apiKeyRotated: Boolean(
        (raw as { apiKey?: string | null })?.apiKey?.trim?.(),
      ),
      apiKeyCleared: Boolean((raw as { clearApiKey?: boolean })?.clearApiKey),
    },
  });

  return snap;
}

export async function sendResendTestEmailForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const { to } = testEmailSchema.parse(raw);
  const before = await getResendAdminSnapshot();

  if (!before.hasApiKey) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Configure a Resend API key before sending a test email.",
      400,
    );
  }
  if (!before.fromEmail) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Configure a From email before sending a test email.",
      400,
    );
  }

  // Temporarily ensure delivery path can send: if disabled, still allow test
  // by using save path that validates — we send via sendEmail which requires
  // enabled OR env bootstrap. Force enable check:
  if (!before.enabled) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Enable the Resend provider before sending a test email.",
      400,
    );
  }

  const result = await sendEmail({
    to,
    subject: "[Bidvera] Resend test email",
    text: `This is a Bidvera Super Admin test email.\nSent at ${new Date().toISOString()}\n`,
    html: `<p>This is a <strong>Bidvera</strong> Super Admin test email.</p><p style="color:#64748b;font-size:13px">Sent at ${new Date().toISOString()}</p>`,
  });

  await recordResendTestResult({
    ok: result.ok,
    to,
    errorSafe: result.error,
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: result.ok ? "EMAIL_RESEND_TEST_OK" : "EMAIL_RESEND_TEST_FAILED",
    targetType: "email_provider",
    targetId: "resend",
    ipHash,
    metadata: {
      toMasked: maskEmail(to),
      mode: result.mode,
      ok: result.ok,
      // never store API key or full recipient if sensitive — masked only
    },
  });

  if (!result.ok) {
    throw new AppError(
      ErrorCode.VALIDATION,
      result.error ?? "Test email failed.",
      400,
    );
  }

  return {
    ok: true as const,
    toMasked: maskEmail(to),
    mode: result.mode,
    snapshot: await getResendAdminSnapshot(),
  };
}
