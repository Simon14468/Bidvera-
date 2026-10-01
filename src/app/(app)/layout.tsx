import { resolveAuthContext } from "@/auth/session";
import { onboardingPathForStep } from "@/auth/onboarding";
import { loadAppChromeSnapshot } from "@/application/app-chrome";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { FreeWorkspaceTrialBanner } from "@/components/billing/free-workspace-trial-banner";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { DatabaseUnavailable } from "@/components/system/database-unavailable";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import type { Locale } from "@/i18n/config";
import { isDatabaseTransientError } from "@/lib/db-capacity";
import { hasFeature } from "@/services/entitlements";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import { formatFreeWorkspaceTrialBanner } from "@/services/billing/billing-display";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let auth;
  try {
    auth = await resolveAuthContext();
  } catch (error) {
    if (isDatabaseTransientError(error)) {
      return <DatabaseUnavailable />;
    }
    throw error;
  }
  if (!auth) {
    redirect("/login");
  }
  if (auth.user.onboardingStep !== "DONE" || !auth.user.companyId) {
    redirect(onboardingPathForStep(auth.user.onboardingStep));
  }

  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const companyId = auth.user.companyId;

  const [
    chrome,
    tenderAnalysisAvailable,
    documentComplianceEnabled,
    supplierQualificationEnabled,
    tenderCalendarEnabled,
    clientRequestsEnabled,
    questionnaireAssistantEnabled,
    matchingEngineAvailable,
    decisionMemoryEnabled,
    teamWorkflowEnabled,
    smartAlertsEnabled,
    companyProfileEnabled,
    newMatchesCountRaw,
  ] = await Promise.all([
    loadAppChromeSnapshot(companyId, locale),
    import("@/modules/tender-analysis").then((m) =>
      m.isTenderAnalysisAvailable(companyId).catch(() => false),
    ),
    import("@/modules/document-compliance").then((m) =>
      m.isDocumentComplianceAvailable(companyId).catch(() => false),
    ),
    import("@/modules/supplier-qualification").then((m) =>
      m.isSupplierQualificationAvailable(companyId).catch(() => false),
    ),
    import("@/modules/tender-calendar").then((m) =>
      m.isTenderCalendarAvailable(companyId).catch(() => false),
    ),
    import("@/modules/client-requests").then((m) =>
      m.isClientRequestsAvailable(companyId).catch(() => false),
    ),
    import("@/modules/questionnaire-assistant").then((m) =>
      m.isQuestionnaireAssistantAvailable(companyId).catch(() => false),
    ),
    import("@/modules/matching-engine").then((m) =>
      m.isMatchingEngineAvailable(companyId).catch(() => false),
    ),
    hasFeature(companyId, "decision_memory").catch(() => false),
    hasFeature(companyId, "team_collaboration").catch(() => false),
    hasFeature(companyId, "smart_alerts").catch(() => false),
    hasFeature(companyId, "company_profile").catch(() => false),
    import("@/modules/matching-engine")
      .then((m) => m.countMatchedOpportunityNotificationsForCompany(companyId))
      .catch(() => 0),
  ]);

  // Internal/admin-only: never surface in company nav/chrome (SA can still open /tenders).
  const tenderAnalysisEnabled =
    isCommerciallyAvailableFeature("tender_analysis") && tenderAnalysisAvailable;

  // Matching: commercially unsold — do not show nav Lock/entry unless sold AND entitled.
  const matchingEngineEnabled =
    isCommerciallyAvailableFeature("matching_engine") && matchingEngineAvailable;

  const unreadAlerts = smartAlertsEnabled ? chrome.unreadAlerts : 0;
  const newMatchesCount = matchingEngineEnabled ? newMatchesCountRaw : 0;

  const trialBanner = chrome.trialChrome
    ? formatFreeWorkspaceTrialBanner(chrome.trialChrome, {
        titleDays: dict.app.billing.freeWorkspaceTrialBannerDays,
        titleDay: dict.app.billing.freeWorkspaceTrialBannerDay,
        titleHours: dict.app.billing.freeWorkspaceTrialBannerHours,
        titleHour: dict.app.billing.freeWorkspaceTrialBannerHour,
        titleEnding: dict.app.billing.freeWorkspaceTrialBannerEnding,
        hint: dict.app.billing.freeWorkspaceTrialBannerHint,
        expiredTitle: dict.app.billing.freeWorkspaceTrialExpiredTitle,
        expiredBody: dict.app.billing.freeWorkspaceTrialExpiredBody,
        cta: dict.app.billing.freeWorkspaceTrialCta,
      })
    : null;

  return (
    <PwaProvider accountId={companyId}>
      <div className="flex min-h-full flex-col lg:flex-row">
        <AppSidebar
          copy={dict.app}
          unreadAlerts={unreadAlerts}
          tenderAnalysisEnabled={tenderAnalysisEnabled}
          documentComplianceEnabled={documentComplianceEnabled}
          supplierQualificationEnabled={supplierQualificationEnabled}
          tenderCalendarEnabled={tenderCalendarEnabled}
          clientRequestsEnabled={clientRequestsEnabled}
          questionnaireAssistantEnabled={questionnaireAssistantEnabled}
          matchingEngineEnabled={matchingEngineEnabled}
          decisionMemoryEnabled={decisionMemoryEnabled}
          teamWorkflowEnabled={teamWorkflowEnabled}
          smartAlertsEnabled={smartAlertsEnabled}
          companyProfileEnabled={companyProfileEnabled}
          showUpgrade={chrome.showUpgrade}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            locale={locale}
            languageLabel={dict.nav.language}
            shell={dict.app.shell}
            companyName={chrome.companyName}
            userName={auth.user.name ?? ""}
            userAvatarUrl={auth.user.avatarUrl}
            showUpgrade={chrome.showUpgrade}
            planBadge={chrome.planBadge}
            tenderAnalysisEnabled={tenderAnalysisEnabled}
            companyProfileEnabled={companyProfileEnabled}
            matchingEngineEnabled={matchingEngineEnabled}
            newMatchesCount={newMatchesCount}
          />
          <main className="min-w-0 flex-1 overflow-x-clip px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8">
            {trialBanner ? <FreeWorkspaceTrialBanner {...trialBanner} /> : null}
            {children}
          </main>
        </div>
      </div>
    </PwaProvider>
  );
}
