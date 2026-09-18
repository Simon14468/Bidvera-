"use server";

import { requireCompanyId } from "@/auth/session";
import {
  assertCanCreateReportShare,
  assertCanMutateCompanyContent,
} from "@/auth/company-content-access";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { toSafeClientError, rethrowRedirect } from "@/lib/errors";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import {
  createReportShareToken,
  REPORT_SHARE_TTL_MS,
  revokeReportSharesForTender,
} from "@/services/reports/share-token";
import {
  buildTenderReportPdf,
  buildTenderReportPdfFileName,
  getTenderReportForCompany,
} from "@/services/reports/tender-report";
import {
  getCompanyNotificationPrefs,
  saveCompanyNotificationPrefs,
} from "@/services/notifications/prefs";
import { getLocale } from "@/i18n/get-locale";
import { prisma } from "@/lib/db";

function fail(error: unknown) {
  rethrowRedirect(error);
  return { ok: false as const, error: toSafeClientError(error) };
}

export async function downloadTenderReportPdf(tenderId: string) {
  try {
    const { companyId } = await requireCompanyId();
    const { assertFeature } = await import("@/services/entitlements");
    await assertFeature(
      companyId,
      "pdf_export",
      "PDF export is not included in your plan. Upgrade to download reports.",
    );
    const [report, locale, company, appOrigin] = await Promise.all([
      getTenderReportForCompany(tenderId, companyId),
      getLocale(),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
      resolveRequestAppOrigin(),
    ]);
    const pdf = await buildTenderReportPdf(report, {
      locale,
      companyName: company?.name ?? null,
      appOrigin,
    });
    return {
      ok: true as const,
      data: {
        base64: pdf.toString("base64"),
        fileName: buildTenderReportPdfFileName(report.title, tenderId),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function createReportShareLink(tenderId: string) {
  try {
    const { companyId, auth } = await requireCompanyId();
    assertCanCreateReportShare(auth.user.role);
    const { assertFeature } = await import("@/services/entitlements");
    await assertFeature(
      companyId,
      "pdf_export",
      "Report sharing is not included in your plan.",
    );
    // Ensure report exists / company owns tender
    await getTenderReportForCompany(tenderId, companyId);
    const token = await createReportShareToken({
      companyId,
      tenderId,
      createdByUserId: auth.user.id,
    });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      ok: true as const,
      data: {
        url: `${base}/share/report/${token}`,
        expiresInHours: Math.round(REPORT_SHARE_TTL_MS / (60 * 60 * 1000)),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeReportShareLinks(tenderId: string) {
  try {
    const { companyId, auth } = await requireCompanyId();
    assertCanMutateCompanyContent(auth.user.role);
    await getTenderReportForCompany(tenderId, companyId);
    const revoked = await revokeReportSharesForTender(companyId, tenderId);
    return { ok: true as const, data: { revoked } };
  } catch (error) {
    return fail(error);
  }
}

export async function saveNotificationPrefsAction(raw: unknown) {
  try {
    const { companyId, auth } = await requireCompanyId();
    assertCanManageCompanySettings(auth.user.role);
    const data = await saveCompanyNotificationPrefs(companyId, raw);
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function getNotificationPrefsAction() {
  try {
    const { companyId } = await requireCompanyId();
    return { ok: true as const, data: await getCompanyNotificationPrefs(companyId) };
  } catch (error) {
    return fail(error);
  }
}
