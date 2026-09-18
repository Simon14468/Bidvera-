import { resolveAuthContext } from "@/auth/session";
import { onboardingPathForStep } from "@/auth/onboarding";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { DatabaseUnavailable } from "@/components/system/database-unavailable";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { isDatabaseTransientError } from "@/lib/db-capacity";
import { notificationService } from "@/services/notifications";
import { hasFeature } from "@/services/entitlements";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
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

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const companyId = auth.user.companyId;

  const [
    tenderMod,
    dcmMod,
    sqMod,
    calMod,
    crMod,
    qaMod,
    matchMod,
    upgradeMod,
  ] = await Promise.all([
    import("@/modules/tender-analysis"),
    import("@/modules/document-compliance"),
    import("@/modules/supplier-qualification"),
    import("@/modules/tender-calendar"),
    import("@/modules/client-requests"),
    import("@/modules/questionnaire-assistant"),
    import("@/modules/matching-engine"),
    import("@/services/billing/upgrade-eligibility"),
  ]);

  const [
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
    showUpgrade,
  ] = await Promise.all([
    tenderMod.isTenderAnalysisAvailable(companyId).catch(() => false),
    dcmMod.isDocumentComplianceAvailable(companyId).catch(() => false),
    sqMod.isSupplierQualificationAvailable(companyId).catch(() => false),
    calMod.isTenderCalendarAvailable(companyId).catch(() => false),
    crMod.isClientRequestsAvailable(companyId).catch(() => false),
    qaMod.isQuestionnaireAssistantAvailable(companyId).catch(() => false),
    matchMod.isMatchingEngineAvailable(companyId).catch(() => false),
    hasFeature(companyId, "decision_memory").catch(() => false),
    hasFeature(companyId, "team_collaboration").catch(() => false),
    hasFeature(companyId, "smart_alerts").catch(() => false),
    hasFeature(companyId, "company_profile").catch(() => false),
    upgradeMod.companyHasUpgradePath(companyId).catch(() => false),
  ]);

  // Internal/admin-only: never surface in company nav/chrome (SA can still open /tenders).
  const tenderAnalysisEnabled =
    isCommerciallyAvailableFeature("tender_analysis") && tenderAnalysisAvailable;

  // Matching: commercially unsold — do not show nav Lock/entry unless sold AND entitled.
  const matchingEngineEnabled =
    isCommerciallyAvailableFeature("matching_engine") && matchingEngineAvailable;

  // Unread count only when alerts are entitled (avoids extra DB on every layout).
  const unreadAlerts = smartAlertsEnabled
    ? await notificationService.countUnread(companyId).catch(() => 0)
    : 0;

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
          showUpgrade={showUpgrade}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            tenderAnalysisEnabled={tenderAnalysisEnabled}
            companyProfileEnabled={companyProfileEnabled}
            languageLabel={dict.nav.language}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </PwaProvider>
  );
}
