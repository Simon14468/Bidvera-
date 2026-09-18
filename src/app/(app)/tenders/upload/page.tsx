export const dynamic = "force-dynamic";

import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { formatDate } from "@/lib/format";
import {
  getAnalysisBlockReason,
  getTrialUsage,
} from "@/services/usage";
import { redirect } from "next/navigation";
import { TenderUploadPanel } from "./upload-panel";
import { UPLOAD_LIMITS } from "@/config/server";

export default async function TenderUploadPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.upload;
  const { requireTenderAnalysisModule } = await import("@/modules/tender-analysis");
  const { companyId } = await requireTenderAnalysisModule();
  const [blockReason, usage] = await Promise.all([
    getAnalysisBlockReason(companyId),
    getTrialUsage(companyId),
  ]);

  if (blockReason) {
    redirect(
      blockReason === "trial_expired" || blockReason === "credits_exhausted"
        ? `/upgrade?reason=${blockReason}`
        : "/billing",
    );
  }

  const trialLeft = t.trialLeft.replaceAll(
    "{remaining}",
    String(usage.analysesRemaining),
  );
  const trialEnds =
    !usage.isTrialExpired && usage.trialEndsAt
      ? t.trialEnds.replaceAll("{date}", formatDate(usage.trialEndsAt, locale))
      : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        {usage.trialEndsAt && usage.plan === "TRIAL" ? (
          <p className="mt-2 text-xs text-muted">
            {trialLeft}
            {trialEnds}
          </p>
        ) : null}
      </div>
      <TenderUploadPanel
        canAnalyze={!blockReason}
        remaining={usage.isUnlimited ? null : usage.analysesRemaining}
        isUnlimited={usage.isUnlimited}
        copy={t}
        limits={{
          maxFilesPerPackage: UPLOAD_LIMITS.maxFilesPerPackage,
          maxFileBytes: UPLOAD_LIMITS.maxFileBytes,
          maxPackageBytes: UPLOAD_LIMITS.maxPackageBytes,
        }}
      />
    </div>
  );
}
