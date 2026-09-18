"use server";

import {
  activateFreeOrTrialPlanAction,
  completeCompanyOnboardingAction,
  createAccountAction,
  forgotPasswordAction,
  loginAction,
  logoutAction,
  resendVerificationAction,
  resetPasswordAction,
  skipCompanyOnboardingAction,
  verifyEmailAction,
} from "@/application/auth-service";
import { updateCompanyProfileAction } from "@/application/company-service";
import {
  getTenderAnalysisStatus,
  processTenderAnalysis,
  uploadAndQueueTenderPackage,
} from "@/modules/tender-analysis";
import { assertCanManageBilling } from "@/auth/billing-access";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyId } from "@/auth/session";
import { rethrowRedirect, toSafeClientError } from "@/lib/errors";
import { billingService } from "@/services/billing";
import { assertDrainJobsAllowed } from "@/services/jobs/drain-guard";
import { notificationService } from "@/services/notifications";
import { trackEvent } from "@/services/observability";
import { getTrialUsage, recordUsage } from "@/services/usage";
import { processJobsOnce } from "@/services/jobs";
import { after } from "next/server";
import { redirect } from "next/navigation";

function fail(error: unknown) {
  rethrowRedirect(error);
  return { ok: false as const, error: toSafeClientError(error) };
}

export async function signup(raw: unknown) {
  try {
    return { ok: true as const, data: await createAccountAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function login(raw: unknown) {
  try {
    return { ok: true as const, data: await loginAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function verifyEmail(token: string) {
  try {
    return { ok: true as const, data: await verifyEmailAction(token) };
  } catch (error) {
    return fail(error);
  }
}

export async function confirmEmailChange(token: string) {
  try {
    const { confirmEmailChangeAction } = await import("@/application/auth-service");
    return { ok: true as const, data: await confirmEmailChangeAction(token) };
  } catch (error) {
    return fail(error);
  }
}

export async function updateAccountProfile(raw: unknown) {
  try {
    const { updateAccountProfileAction } = await import("@/application/auth-service");
    const { revalidatePath } = await import("next/cache");
    const data = await updateAccountProfileAction(raw);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelEmailChange() {
  try {
    const { cancelEmailChangeAction } = await import("@/application/auth-service");
    const { revalidatePath } = await import("next/cache");
    await cancelEmailChangeAction();
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function resendEmailChange() {
  try {
    const { resendEmailChangeAction } = await import("@/application/auth-service");
    const { revalidatePath } = await import("next/cache");
    const data = await resendEmailChangeAction();
    revalidatePath("/settings");
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function resendVerification() {
  try {
    return { ok: true as const, data: await resendVerificationAction() };
  } catch (error) {
    return fail(error);
  }
}

export async function completeCompanyOnboarding(raw: unknown) {
  try {
    return { ok: true as const, data: await completeCompanyOnboardingAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function skipCompanyOnboarding(raw?: unknown) {
  try {
    return { ok: true as const, data: await skipCompanyOnboardingAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function activateFreeOrTrialPlan(raw: unknown) {
  try {
    return { ok: true as const, data: await activateFreeOrTrialPlanAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function forgotPassword(raw: unknown) {
  try {
    return { ok: true as const, data: await forgotPasswordAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function resetPassword(raw: unknown) {
  try {
    return { ok: true as const, data: await resetPasswordAction(raw) };
  } catch (error) {
    return fail(error);
  }
}

export async function logout() {
  try {
    await logoutAction();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeOtherSessions() {
  try {
    const { revokeOtherSessionsAction } = await import("@/application/auth-service");
    return { ok: true as const, data: await revokeOtherSessionsAction() };
  } catch (error) {
    return fail(error);
  }
}

/** Clears session and sends the user to login (for forms / header buttons). */
export async function signOutAndRedirect() {
  await logoutAction();
  redirect("/login");
}

export async function updateCompanyProfile(raw: unknown) {
  try {
    const profile = await updateCompanyProfileAction(raw);
    return { ok: true as const, data: profile };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadUserAvatarAction(formData: FormData) {
  try {
    const { requireAuth } = await import("@/auth/session");
    const {
      deleteUserAvatarFile,
      saveUserAvatarUpload,
      setUserAvatarUrl,
    } = await import("@/services/user-avatar");
    const { revalidatePath } = await import("next/cache");

    const auth = await requireAuth();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return {
        ok: false as const,
        error: { message: "No file uploaded.", code: "VALIDATION" },
      };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const previous = auth.user.avatarUrl;
    const url = await saveUserAvatarUpload({ userId: auth.user.id, body: buf });
    await setUserAvatarUrl(auth.user.id, url);
    if (previous && previous !== url) {
      await deleteUserAvatarFile(previous);
    }
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true as const, data: { url } };
  } catch (error) {
    return fail(error);
  }
}

export async function removeUserAvatarAction() {
  try {
    const { requireAuth } = await import("@/auth/session");
    const { deleteUserAvatarFile, setUserAvatarUrl } = await import(
      "@/services/user-avatar"
    );
    const { revalidatePath } = await import("next/cache");

    const auth = await requireAuth();
    const previous = auth.user.avatarUrl;
    await setUserAvatarUrl(auth.user.id, null);
    await deleteUserAvatarFile(previous);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function getUsageAction() {
  try {
    const { companyId } = await requireCompanyId();
    return { ok: true as const, data: await getTrialUsage(companyId) };
  } catch (error) {
    return fail(error);
  }
}

export async function markAlertReadAction(alertId: string) {
  try {
    const { companyId } = await requireCompanyId();
    await notificationService.markRead(companyId, alertId);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function markAllAlertsReadAction() {
  try {
    const { companyId } = await requireCompanyId();
    const count = await notificationService.markAllRead(companyId);
    return { ok: true as const, data: { count } };
  } catch (error) {
    return fail(error);
  }
}

export async function startCheckoutAction(input: {
  planId: string;
  gateway?: "stripe" | "paypal";
  interval?: "MONTH" | "YEAR";
  returnPath?: string;
  turnstileToken?: string;
}) {
  try {
    const { requireAuth } = await import("@/auth/session");
    const auth = await requireAuth();
    assertCanManageBilling(auth.user.role);
    if (!auth.user.companyId) {
      return {
        ok: false as const,
        error: {
          code: "FORBIDDEN",
          message: "Complete company setup before checkout.",
          status: 403,
        },
      };
    }
    const companyId = auth.user.companyId;
    const planId = typeof input === "string" ? input : input.planId;
    const gateway = typeof input === "string" ? undefined : input.gateway;
    const interval = typeof input === "string" ? "MONTH" : input.interval ?? "MONTH";
    const returnPath =
      typeof input === "string" ? "/upgrade" : input.returnPath ?? "/upgrade";
    const { assertTurnstileToken, requestClientIp } = await import(
      "@/services/security/turnstile"
    );
    await assertTurnstileToken({
      token: typeof input === "string" ? undefined : input.turnstileToken,
      action: "checkout",
      ip: await requestClientIp(),
    });

    await recordUsage({
      companyId,
      action: "CHECKOUT_STARTED",
      metadata: { planId, gateway, interval },
    });
    await trackEvent({
      action: "CHECKOUT_STARTED",
      companyId,
      userId: auth.user.id,
      metadata: { planId, gateway, interval, onboarding: returnPath.includes("onboarding") },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const joiner = returnPath.includes("?") ? "&" : "?";
    const session = await billingService.createCheckoutSession({
      companyId,
      userEmail: auth.user.email,
      planId,
      gateway,
      interval,
      successUrl: `${base}${returnPath}${joiner}checkout=success`,
      cancelUrl: `${base}${returnPath}${joiner}canceled=1`,
    });
    return { ok: true as const, data: session };
  } catch (error) {
    return fail(error);
  }
}

export async function openBillingPortalAction() {
  try {
    const { auth, companyId } = await requireCompanyId();
    assertCanManageBilling(auth.user.role);
    const { prisma } = await import("@/lib/db");
    const row = await prisma.subscription.findUnique({
      where: { companyId },
      select: { companyId: true, provider: true, providerCustomerId: true },
    });
    if (!row || row.companyId !== companyId) {
      return {
        ok: false as const,
        error: { code: "FORBIDDEN", message: "Billing is not available.", status: 403 },
      };
    }
    const { createStripeBillingPortalSession } = await import(
      "@/services/billing/billing-portal"
    );
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await createStripeBillingPortalSession({
      companyId,
      returnUrl: `${base}/billing`,
    });
    return { ok: true as const, data: session };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelSubscriptionAction(atPeriodEnd = true) {
  try {
    const { auth, companyId } = await requireCompanyId();
    assertCanManageBilling(auth.user.role);
    const { prisma } = await import("@/lib/db");
    const row = await prisma.subscription.findUnique({
      where: { companyId },
    });
    if (!row?.providerSubscriptionId) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: "No provider subscription to cancel.",
          status: 400,
        },
      };
    }
    if (row.provider === "stripe") {
      const { cancelStripeSubscription } = await import("@/services/billing");
      await cancelStripeSubscription(companyId, atPeriodEnd);
    } else if (row.provider === "paypal") {
      const { cancelPayPalSubscription } = await import("@/services/billing");
      await cancelPayPalSubscription(companyId);
    } else {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: "This subscription cannot be cancelled online.",
          status: 400,
        },
      };
    }
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function pollAnalysisStatusAction(tenderId: string) {
  try {
    const { companyId } = await requireCompanyId();
    const { prisma } = await import("@/lib/db");
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: { companyId: true, analysisStatus: true },
    });
    if (!tender || tender.companyId !== companyId) {
      return fail(new Error("Tender not found"));
    }

    // Keep upload non-blocking; advance this tender's job while the client polls.
    // Do not await the full analysis — return status immediately so the bar moves.
    if (
      tender.analysisStatus !== "COMPLETED" &&
      tender.analysisStatus !== "FAILED"
    ) {
      after(() => {
        void (async () => {
          const { kickTenderAnalysisJob } = await import("@/services/jobs");
          await kickTenderAnalysisJob(tenderId, (id) =>
            processTenderAnalysis(id),
          );
        })().catch(() => undefined);
      });
    }

    return { ok: true as const, data: await getTenderAnalysisStatus(tenderId) };
  } catch (error) {
    return fail(error);
  }
}

export async function recordTenderOutcomeAction(raw: {
  tenderId: string;
  outcome:
    | "WON"
    | "LOST"
    | "WITHDRAWN"
    | "CANCELLED"
    | "NOT_SUBMITTED"
    | "PENDING"
    | "BID_SUBMITTED"
    | "NO_BID_CONFIRMED";
  outcomeDate?: string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  humanFinalDecision?: "BID" | "REVIEW" | "NO_BID" | null;
  attachmentDocumentId?: string | null;
  idempotencyKey?: string | null;
  allowReversal?: boolean;
}) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { assertCanMutateTenderAnalysis } = await import("@/auth/tender-access");
    assertCanMutateTenderAnalysis(auth.user.role);
    const { recordDecisionOutcome } = await import(
      "@/services/decision-outcome-learning"
    );
    const data = await recordDecisionOutcome({
      tenderId: raw.tenderId,
      companyId,
      userId: auth.user.id,
      outcome: raw.outcome,
      outcomeDate: raw.outcomeDate,
      reasonCode: raw.reasonCode,
      reasonDetail: raw.reasonDetail,
      humanFinalDecision: raw.humanFinalDecision ?? null,
      attachmentDocumentId: raw.attachmentDocumentId ?? null,
      idempotencyKey: raw.idempotencyKey,
      allowReversal: raw.allowReversal,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function setGlobalLearningConsentAction(consent: boolean) {
  try {
    const { auth, companyId } = await requireCompanyId();
    assertCanManageCompanySettings(auth.user.role);
    const { setGlobalLearningConsent } = await import("@/services/learning");
    const data = await setGlobalLearningConsent({ companyId, consent });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Dev/local helper: drain one job in-process after upload.
 * Production should run `npm run worker` as a separate process.
 */
export async function drainJobsAction(max = 3) {
  try {
    assertDrainJobsAllowed();
    await requireCompanyId();
    let processed = 0;
    for (let i = 0; i < max; i++) {
      const did = await processJobsOnce({
        RUN_TENDER_ANALYSIS: async (job) => {
          const tenderId =
            (job.payload as { tenderId?: string })?.tenderId ?? job.tenderId;
          if (!tenderId) throw new Error("Missing tenderId in job payload");
          await processTenderAnalysis(tenderId);
        },
        PROCESS_TENDER_DOCUMENT: async (job) => {
          const tenderId =
            (job.payload as { tenderId?: string })?.tenderId ?? job.tenderId;
          if (!tenderId) throw new Error("Missing tenderId");
          await processTenderAnalysis(tenderId);
        },
        SEND_ALERT: async () => {
          await notificationService.dispatchDueAlerts(20);
        },
        SCHEDULE_DEADLINE_ALERTS: async (job) => {
          const tenderId =
            (job.payload as { tenderId?: string })?.tenderId ?? job.tenderId;
          if (!tenderId) {
            await notificationService.reconcileDeadlineSchedules(10);
            return;
          }
          const { prisma } = await import("@/lib/db");
          const tender = await prisma.tender.findUnique({
            where: { id: tenderId },
            select: {
              id: true,
              companyId: true,
              title: true,
              deadline: true,
              deadlineTimezone: true,
            },
          });
          if (tender?.deadline) {
            await notificationService.scheduleDeadlineAlerts({
              companyId: tender.companyId,
              tenderId: tender.id,
              deadline: tender.deadline,
              title: tender.title,
              timezone: tender.deadlineTimezone,
            });
          }
        },
        SEND_EMAIL: async (job) => {
          const payload = job.payload as {
            to?: string;
            subject?: string;
            html?: string;
            text?: string;
          };
          if (!payload.to || !payload.subject || !payload.html) return;
          const { sendEmail } = await import("@/services/email");
          await sendEmail({
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
          });
        },
      });
      if (!did) break;
      processed += 1;
    }
    return { ok: true as const, data: { processed } };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadTenderAction(formData: FormData) {
  try {
    // Prefer multi-file field; fall back to legacy single "file".
    const rawFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((f): f is File => f instanceof File);

    // Dedupe identical File references if both keys were set
    const uniqueFiles = [...new Map(rawFiles.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f])).values()];

    if (uniqueFiles.length === 0) {
      return {
        ok: false as const,
        error: { code: "VALIDATION", message: "File is required", status: 400 },
      };
    }

    const { UPLOAD_LIMITS } = await import("@/config/server");
    if (uniqueFiles.length > UPLOAD_LIMITS.maxFilesPerPackage) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: `A Tender Package accepts a maximum of ${UPLOAD_LIMITS.maxFilesPerPackage} documents.`,
          status: 400,
        },
      };
    }

    const prepared = await Promise.all(
      uniqueFiles.map(async (file) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        const name = file.name.toLowerCase();
        let mimeType = file.type || "application/octet-stream";
        if (!file.type || file.type === "application/octet-stream") {
          if (name.endsWith(".docx")) {
            mimeType =
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          } else if (name.endsWith(".doc")) {
            mimeType = "application/msword";
          } else if (name.endsWith(".pdf")) {
            mimeType = "application/pdf";
          } else if (name.endsWith(".xlsx")) {
            mimeType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          } else if (name.endsWith(".xls")) {
            mimeType = "application/vnd.ms-excel";
          } else if (name.endsWith(".pptx")) {
            mimeType =
              "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          } else if (name.endsWith(".ppt")) {
            mimeType = "application/vnd.ms-powerpoint";
          } else if (name.endsWith(".csv")) {
            mimeType = "text/csv";
          } else if (name.endsWith(".txt")) {
            mimeType = "text/plain";
          } else if (name.endsWith(".png")) {
            mimeType = "image/png";
          } else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            mimeType = "image/jpeg";
          } else if (name.endsWith(".tif") || name.endsWith(".tiff")) {
            mimeType = "image/tiff";
          } else if (name.endsWith(".zip")) {
            mimeType = "application/zip";
          } else if (name.endsWith(".rar")) {
            mimeType = "application/vnd.rar";
          }
        }
        return {
          fileName: file.name,
          mimeType,
          fileSize: file.size,
          bytes,
        };
      }),
    );

    const result = await uploadAndQueueTenderPackage({
      files: prepared,
      title: String(formData.get("title") ?? "") || undefined,
      idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
    });

    // Fast upload response + background kick (poll also kicks if this is skipped).
    after(() => {
      void (async () => {
        const { kickTenderAnalysisJob } = await import("@/services/jobs");
        await kickTenderAnalysisJob(result.tenderId, (id) =>
          processTenderAnalysis(id),
        );
      })().catch(() => undefined);
    });

    return { ok: true as const, data: result };
  } catch (error) {
    const passwordPending = await tryCreateArchivePasswordPending(error, formData).catch(
      () => null,
    );
    if (passwordPending) return passwordPending;
    return fail(error);
  }
}

async function tryCreateArchivePasswordPending(
  error: unknown,
  formData: FormData,
): Promise<
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        status: number;
        uploadStage: string;
        userAction: string;
        fileName: string;
        retryable: true;
        pendingToken: string;
      };
    }
  | null
> {
  const { AppError } = await import("@/lib/errors");
  if (!(error instanceof AppError)) return null;
  const details =
    error.details && typeof error.details === "object"
      ? (error.details as Record<string, unknown>)
      : {};
  const stage = String(details.uploadStage ?? "");
  if (stage !== "ARCHIVE_PASSWORD_REQUIRED" && details.userAction !== "ENTER_ARCHIVE_PASSWORD") {
    return null;
  }

  const { requireCompanyId } = await import("@/auth/session");
  const { companyId } = await requireCompanyId();

  const rawFiles = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((f): f is File => f instanceof File);
  const uniqueFiles = [
    ...new Map(rawFiles.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f])).values(),
  ];
  if (uniqueFiles.length === 0) return null;

  const prepared = await Promise.all(
    uniqueFiles.map(async (file) => {
      const bytes = Buffer.from(await file.arrayBuffer());
      return {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        bytes,
        needsPassword:
          file.name === details.fileName ||
          /\.(zip|rar)$/i.test(file.name),
      };
    }),
  );

  const passwordFileIndex = Math.max(
    0,
    prepared.findIndex((u) => u.fileName === details.fileName),
  );
  prepared[passwordFileIndex]!.needsPassword = true;

  const { createPendingArchiveSession } = await import(
    "@/domain/universal-intake/archive/pending-store"
  );
  const session = await createPendingArchiveSession({
    companyId,
    uploads: prepared,
    passwordFileIndex,
    title: String(formData.get("title") ?? "") || undefined,
    idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
  });

  return {
    ok: false as const,
    error: {
      code: "ARCHIVE_PASSWORD_REQUIRED",
      message: "This file is password protected. Enter the password to continue.",
      status: 400,
      uploadStage: "ARCHIVE_PASSWORD_REQUIRED",
      userAction: "ENTER_ARCHIVE_PASSWORD",
      fileName: prepared[passwordFileIndex]!.fileName,
      retryable: true as const,
      pendingToken: session.token,
    },
  };
}

/**
 * Unlock a password-pending archive session and continue upload.
 * Password is ephemeral — read from formData only, never logged or stored.
 */
export async function unlockArchiveAction(formData: FormData) {
  try {
    const { requireCompanyId } = await import("@/auth/session");
    const { companyId } = await requireCompanyId();
    const token = String(formData.get("pendingToken") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    // Intentionally do not log password or include it in any thrown message.

    if (!token) {
      return {
        ok: false as const,
        error: { code: "VALIDATION", message: "Missing archive unlock token.", status: 400 },
      };
    }
    if (!password) {
      return {
        ok: false as const,
        error: {
          code: "ARCHIVE_WRONG_PASSWORD",
          message: "Incorrect password. Please try again.",
          status: 400,
          uploadStage: "ARCHIVE_WRONG_PASSWORD",
          userAction: "ENTER_ARCHIVE_PASSWORD",
          retryable: true,
        },
      };
    }

    const {
      loadPendingArchiveSession,
      destroyPendingArchiveSession,
    } = await import("@/domain/universal-intake/archive/pending-store");
    const loaded = await loadPendingArchiveSession(token, companyId);
    if (!loaded) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: "Archive unlock session expired. Please upload the package again.",
          status: 400,
        },
      };
    }

    const target = loaded.uploadsWithBytes[loaded.session.passwordFileIndex];
    const passwordsByFileName: Record<string, string> = {};
    if (target) {
      passwordsByFileName[target.fileName] = password;
    }

    try {
      const result = await uploadAndQueueTenderPackage({
        files: loaded.uploadsWithBytes.map((u) => ({
          fileName: u.fileName,
          mimeType: u.mimeType,
          fileSize: u.fileSize,
          bytes: u.bytes,
        })),
        title: loaded.session.title,
        idempotencyKey: loaded.session.idempotencyKey,
        passwordsByFileName,
      });

      await destroyPendingArchiveSession(token);

      after(() => {
        void (async () => {
          const { kickTenderAnalysisJob } = await import("@/services/jobs");
          await kickTenderAnalysisJob(result.tenderId, (id) =>
            processTenderAnalysis(id),
          );
        })().catch(() => undefined);
      });

      return { ok: true as const, data: result };
    } catch (error) {
      const { AppError } = await import("@/lib/errors");
      if (error instanceof AppError) {
        const details =
          error.details && typeof error.details === "object"
            ? (error.details as Record<string, unknown>)
            : {};
        if (
          details.uploadStage === "ARCHIVE_WRONG_PASSWORD" ||
          details.archiveIssueCode === "WRONG_PASSWORD" ||
          details.uploadStage === "ARCHIVE_PASSWORD_REQUIRED"
        ) {
          // Keep pending session for retry — do not destroy.
          return {
            ok: false as const,
            error: {
              code: "ARCHIVE_WRONG_PASSWORD",
              message: "Incorrect password. Please try again.",
              status: 400,
              uploadStage: "ARCHIVE_WRONG_PASSWORD",
              userAction: "ENTER_ARCHIVE_PASSWORD",
              fileName: target?.fileName,
              retryable: true as const,
              pendingToken: token,
            },
          };
        }
      }
      return fail(error);
    }
  } catch (error) {
    return fail(error);
  }
}
