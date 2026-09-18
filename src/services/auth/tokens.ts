/**
 * Auth email link tokens — raw bearer never enters Job.payload.
 * Jobs store { authMail: { kind, tokenId } }; worker decrypts deliverySecretEnc.
 */
import { EMAIL_CHANGE } from "@/config/server";
import { generateToken, hashToken } from "@/lib/crypto";
import { decryptDeliverySecret, encryptDeliverySecret } from "@/lib/delivery-secret";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { redactEmailForLog } from "@/lib/safe-log";
import { enqueueJob } from "@/services/jobs";
import {
  emailChangeConfirmEmail,
  emailChangeNotifyEmail,
  passwordResetEmail,
  sendEmail,
  verificationEmail,
  type EmailPayload,
} from "@/services/email";
import { trackEvent } from "@/services/observability";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export type AuthMailKind = "verification" | "password_reset" | "email_change";

export type AuthMailJobPayload = {
  authMail: { kind: AuthMailKind; tokenId: string };
};

function emailChangeTtlMs() {
  return EMAIL_CHANGE.ttlMinutes * 60 * 1000;
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** True when a SEND_EMAIL job payload uses the opaque auth-mail reference (no raw token). */
export function isAuthMailJobPayload(payload: unknown): payload is AuthMailJobPayload {
  if (!payload || typeof payload !== "object") return false;
  const authMail = (payload as { authMail?: unknown }).authMail;
  if (!authMail || typeof authMail !== "object") return false;
  const kind = (authMail as { kind?: unknown }).kind;
  const tokenId = (authMail as { tokenId?: unknown }).tokenId;
  return (
    (kind === "verification" || kind === "password_reset" || kind === "email_change") &&
    typeof tokenId === "string" &&
    tokenId.length > 0
  );
}

/** Assert serialized job JSON never contains raw auth link tokens. */
export function assertJobPayloadHasNoAuthBearer(payload: unknown): void {
  const blob = JSON.stringify(payload ?? {});
  if (/[?&]token=/.test(blob) || /confirm-email-change\?token=/.test(blob)) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "Auth bearer must not be serialized into job payloads.",
      500,
    );
  }
}

async function enqueueAuthMailJob(input: {
  companyId: string | null;
  kind: AuthMailKind;
  tokenId: string;
  idempotencyKey: string;
}) {
  const payload: AuthMailJobPayload = {
    authMail: { kind: input.kind, tokenId: input.tokenId },
  };
  assertJobPayloadHasNoAuthBearer(payload);
  await enqueueJob({
    companyId: input.companyId,
    type: "SEND_EMAIL",
    payload,
    idempotencyKey: input.idempotencyKey,
  });
}

/**
 * Worker (and tests): resolve opaque auth-mail job → email payload.
 * Clears deliverySecretEnc after successful build so retries cannot re-exfiltrate forever.
 */
export async function materializeAuthMailJob(
  payload: AuthMailJobPayload,
): Promise<EmailPayload> {
  const { kind, tokenId } = payload.authMail;

  if (kind === "verification") {
    const row = await prisma.emailVerificationToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date() || !row.deliverySecretEnc) {
      throw new Error("Auth mail delivery secret unavailable.");
    }
    const raw = decryptDeliverySecret(row.deliverySecretEnc);
    if (!raw) throw new Error("Auth mail delivery secret unavailable.");
    const verifyUrl = `${appBaseUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
    const template = verificationEmail({ name: row.user.name, verifyUrl });
    template.to = row.user.email;
    await prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { deliverySecretEnc: null },
    });
    return template;
  }

  if (kind === "password_reset") {
    const row = await prisma.passwordResetToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date() || !row.deliverySecretEnc) {
      throw new Error("Auth mail delivery secret unavailable.");
    }
    const raw = decryptDeliverySecret(row.deliverySecretEnc);
    if (!raw) throw new Error("Auth mail delivery secret unavailable.");
    const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
    const template = passwordResetEmail({ name: row.user.name, resetUrl });
    template.to = row.user.email;
    await prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { deliverySecretEnc: null },
    });
    return template;
  }

  const row = await prisma.emailChangeToken.findUnique({
    where: { id: tokenId },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.deliverySecretEnc) {
    throw new Error("Auth mail delivery secret unavailable.");
  }
  const raw = decryptDeliverySecret(row.deliverySecretEnc);
  if (!raw) throw new Error("Auth mail delivery secret unavailable.");
  const confirmUrl = `${appBaseUrl()}/confirm-email-change?token=${encodeURIComponent(raw)}`;
  const template = emailChangeConfirmEmail({
    name: row.user.name,
    newEmail: row.newEmail,
    confirmUrl,
    expiresMinutes: EMAIL_CHANGE.ttlMinutes,
  });
  template.to = row.newEmail;
  await prisma.emailChangeToken.update({
    where: { id: row.id },
    data: { deliverySecretEnc: null },
  });
  return template;
}

export async function issueEmailVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(ErrorCode.NOT_FOUND, "User not found.", 404);
  if (user.emailVerified) {
    return { alreadyVerified: true as const };
  }

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date(), deliverySecretEnc: null },
  });

  const raw = generateToken();
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);
  const row = await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      deliverySecretEnc: encryptDeliverySecret(raw),
      expiresAt,
    },
  });

  const verifyUrl = `${appBaseUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
  const template = verificationEmail({ name: user.name, verifyUrl });
  template.to = user.email;

  await enqueueAuthMailJob({
    companyId: user.companyId,
    kind: "verification",
    tokenId: row.id,
    idempotencyKey: `verify-email:${userId}:${row.id}`,
  });

  try {
    await sendEmail(template);
    await prisma.emailVerificationToken
      .update({ where: { id: row.id }, data: { deliverySecretEnc: null } })
      .catch(() => undefined);
  } catch {
    // Worker will materialize from deliverySecretEnc
  }

  await trackEvent({
    action: "EMAIL_VERIFICATION_SENT",
    companyId: user.companyId,
    userId: user.id,
  });

  return { alreadyVerified: false as const, expiresAt };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid or expired verification link.", 400);
  }

  const nextStep =
    row.user.onboardingStep === "VERIFY_EMAIL" ? ("COMPANY" as const) : undefined;

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date(), deliverySecretEnc: null },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: {
        emailVerified: true,
        ...(nextStep ? { onboardingStep: nextStep } : {}),
      },
    }),
  ]);

  await trackEvent({
    action: "EMAIL_VERIFIED",
    companyId: row.user.companyId,
    userId: row.userId,
  });

  return prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
}

export async function issuePasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  // Always succeed outwardly to avoid account enumeration
  if (!user) return { ok: true as const };

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date(), deliverySecretEnc: null },
  });

  const raw = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const row = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      deliverySecretEnc: encryptDeliverySecret(raw),
      expiresAt,
    },
  });

  const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
  const template = passwordResetEmail({ name: user.name, resetUrl });
  template.to = user.email;

  await enqueueAuthMailJob({
    companyId: user.companyId,
    kind: "password_reset",
    tokenId: row.id,
    idempotencyKey: `pwd-reset:${user.id}:${row.id}`,
  });

  try {
    await sendEmail(template);
    await prisma.passwordResetToken
      .update({ where: { id: row.id }, data: { deliverySecretEnc: null } })
      .catch(() => undefined);
  } catch {
    // worker retry
  }

  await trackEvent({
    action: "PASSWORD_RESET_REQUESTED",
    companyId: user.companyId,
    userId: user.id,
  });

  return { ok: true as const };
}

export async function consumePasswordResetToken(rawToken: string, newPasswordHash: string) {
  const tokenHash = hashToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid or expired reset link.", 400);
  }

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date(), deliverySecretEnc: null },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  await trackEvent({
    action: "PASSWORD_RESET_COMPLETED",
    companyId: row.user.companyId,
    userId: row.userId,
  });

  return row.user;
}

export async function getPendingEmailChange(userId: string) {
  const row = await prisma.emailChangeToken.findFirst({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, newEmail: true, expiresAt: true, createdAt: true },
  });
  return row;
}

export async function cancelPendingEmailChange(
  userId: string,
  meta?: { companyId?: string | null; ipHash?: string | null },
) {
  const result = await prisma.emailChangeToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date(), deliverySecretEnc: null },
  });
  if (result.count > 0) {
    await trackEvent({
      action: "EMAIL_CHANGE_CANCELLED",
      companyId: meta?.companyId ?? null,
      userId,
      ipHash: meta?.ipHash ?? null,
      metadata: { revokedCount: result.count },
    });
  }
  return result.count;
}

async function recordEmailChangeFailure(input: {
  userId?: string | null;
  companyId?: string | null;
  ipHash?: string | null;
  reason: string;
}) {
  await trackEvent({
    action: "EMAIL_CHANGE_FAILED",
    companyId: input.companyId ?? null,
    userId: input.userId ?? null,
    ipHash: input.ipHash ?? null,
    metadata: { reason: input.reason },
  }).catch(() => undefined);
}

/** Generic copy — never confirm whether an address is registered. */
export const EMAIL_CHANGE_UNAVAILABLE_MESSAGE =
  "Unable to use that email address. Try a different address or contact support.";

/**
 * Issue a pending email change. Does NOT mutate User.email.
 * Stores only HMAC token hash (+ encrypted delivery secret for the worker).
 */
export async function issueEmailChange(
  userId: string,
  newEmailRaw: string,
  meta?: { ipHash?: string | null },
) {
  const newEmail = newEmailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(ErrorCode.NOT_FOUND, "User not found.", 404);

  if (newEmail === user.email.toLowerCase()) {
    return { unchanged: true as const };
  }

  const taken = await prisma.user.findFirst({
    where: {
      email: { equals: newEmail, mode: "insensitive" },
      NOT: { id: userId },
    },
    select: { id: true },
  });
  if (taken) {
    throw new AppError(ErrorCode.VALIDATION, EMAIL_CHANGE_UNAVAILABLE_MESSAGE, 400);
  }

  await prisma.emailChangeToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date(), deliverySecretEnc: null },
  });

  const raw = generateToken(32);
  const expiresAt = new Date(Date.now() + emailChangeTtlMs());
  const tokenRow = await prisma.emailChangeToken.create({
    data: {
      userId,
      newEmail,
      tokenHash: hashToken(raw),
      deliverySecretEnc: encryptDeliverySecret(raw),
      expiresAt,
    },
  });

  const confirmUrl = `${appBaseUrl()}/confirm-email-change?token=${encodeURIComponent(raw)}`;
  const requestedAt = new Date().toISOString();
  const confirm = emailChangeConfirmEmail({
    name: user.name,
    newEmail,
    confirmUrl,
    expiresMinutes: EMAIL_CHANGE.ttlMinutes,
  });
  confirm.to = newEmail;

  const notify = emailChangeNotifyEmail({
    name: user.name,
    newEmail,
    currentEmail: user.email,
    requestedAt,
  });
  notify.to = user.email;

  let confirmDelivered = false;
  const confirmSend = await sendEmail(confirm);
  if (confirmSend.ok) {
    confirmDelivered = true;
    await prisma.emailChangeToken
      .update({ where: { id: tokenRow.id }, data: { deliverySecretEnc: null } })
      .catch(() => undefined);
  }

  try {
    await enqueueAuthMailJob({
      companyId: user.companyId,
      kind: "email_change",
      tokenId: tokenRow.id,
      idempotencyKey: `email-change:${userId}:${tokenRow.id}`,
    });
    confirmDelivered = true;
  } catch {
    // Immediate send may still have succeeded.
  }

  if (!confirmDelivered) {
    await prisma.emailChangeToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date(), deliverySecretEnc: null },
    });
    await recordEmailChangeFailure({
      userId: user.id,
      companyId: user.companyId,
      ipHash: meta?.ipHash,
      reason: "confirm_delivery_failed",
    });
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Could not send the confirmation email. Your email was not changed — try again later.",
      502,
    );
  }

  try {
    await sendEmail(notify);
  } catch {
    // best-effort
  }

  await trackEvent({
    action: "EMAIL_CHANGE_REQUESTED",
    companyId: user.companyId,
    userId: user.id,
    ipHash: meta?.ipHash ?? null,
    metadata: {
      newEmailRedacted: redactEmailForLog(newEmail),
      currentEmailRedacted: redactEmailForLog(user.email),
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { unchanged: false as const, newEmail, expiresAt };
}

export async function consumeEmailChangeToken(
  rawToken: string,
  meta?: { ipHash?: string | null },
) {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 512) {
    await recordEmailChangeFailure({
      ipHash: meta?.ipHash,
      reason: "malformed_token",
    });
    throw new AppError(ErrorCode.VALIDATION, "Invalid or expired confirmation link.", 400);
  }

  const tokenHash = hashToken(rawToken);
  const row = await prisma.emailChangeToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, companyId: true, email: true } } },
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    await recordEmailChangeFailure({
      userId: row?.userId ?? null,
      companyId: row?.user.companyId ?? null,
      ipHash: meta?.ipHash,
      reason: !row ? "unknown_token" : row.usedAt ? "already_used" : "expired",
    });
    throw new AppError(ErrorCode.VALIDATION, "Invalid or expired confirmation link.", 400);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailChangeToken.updateMany({
        where: {
          id: row.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date(), deliverySecretEnc: null },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "Invalid or expired confirmation link.",
          400,
        );
      }

      await tx.emailChangeToken.updateMany({
        where: { userId: row.userId, usedAt: null, id: { not: row.id } },
        data: { usedAt: new Date(), deliverySecretEnc: null },
      });

      const taken = await tx.user.findFirst({
        where: {
          email: { equals: row.newEmail, mode: "insensitive" },
          NOT: { id: row.userId },
        },
        select: { id: true },
      });
      if (taken) {
        throw new AppError(ErrorCode.VALIDATION, EMAIL_CHANGE_UNAVAILABLE_MESSAGE, 400);
      }

      const user = await tx.user.update({
        where: { id: row.userId },
        data: {
          email: row.newEmail,
          emailVerified: true,
        },
      });

      await tx.session.deleteMany({ where: { userId: row.userId } });

      return user;
    });

    await trackEvent({
      action: "EMAIL_CHANGED",
      companyId: updated.companyId,
      userId: updated.id,
      ipHash: meta?.ipHash ?? null,
      metadata: {
        previousEmailRedacted: redactEmailForLog(row.user.email),
        newEmailRedacted: redactEmailForLog(updated.email),
      },
    });
    await trackEvent({
      action: "EMAIL_CHANGE_CONFIRMED",
      companyId: updated.companyId,
      userId: updated.id,
      ipHash: meta?.ipHash ?? null,
    });

    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      await recordEmailChangeFailure({
        userId: row.userId,
        companyId: row.user.companyId,
        ipHash: meta?.ipHash,
        reason: error.message === EMAIL_CHANGE_UNAVAILABLE_MESSAGE
          ? "email_taken"
          : "confirm_rejected",
      });
      throw error;
    }
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2002") {
      await recordEmailChangeFailure({
        userId: row.userId,
        companyId: row.user.companyId,
        ipHash: meta?.ipHash,
        reason: "email_taken_race",
      });
      throw new AppError(ErrorCode.VALIDATION, EMAIL_CHANGE_UNAVAILABLE_MESSAGE, 400);
    }
    throw error;
  }
}
