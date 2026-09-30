export const dynamic = "force-dynamic";

import { logout, revokeOtherSessions } from "@/app/actions";
import { requireAuth } from "@/auth/session";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { loadSettingsBillingSummary } from "@/application/settings-billing-summary";
import { CookieSettingsLink } from "@/components/consent/cookie-consent-root";
import { AccountProfileForm } from "@/components/settings/account-profile-form";
import { BillingSubscriptionSection } from "@/components/settings/billing-subscription-section";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCookieConsentCopy } from "@/i18n/cookie-consent";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { getCompanyNotificationPrefs } from "@/services/notifications/prefs";
import { getPendingEmailChange } from "@/services/auth/tokens";
import Link from "next/link";
import { redirect } from "next/navigation";

async function signOut() {
  "use server";
  await logout();
  redirect("/login");
}

async function signOutOtherDevices() {
  "use server";
  await revokeOtherSessions();
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.app.settings;
  const billingCopy = dict.app.billing;
  const cookiesCopy = getCookieConsentCopy(locale);
  const auth = await requireAuth();
  if (!auth.user.companyId) redirect("/onboarding/company");

  const [
    prefs,
    billingSummary,
    documentComplianceEnabled,
    tenderCalendarEnabled,
    companyProfileEnabled,
    pendingEmailChange,
  ] = await Promise.all([
    getCompanyNotificationPrefs(auth.user.companyId),
    loadSettingsBillingSummary(auth.user.companyId),
    import("@/modules/document-compliance").then((m) =>
      m.isDocumentComplianceAvailable(auth.user.companyId!).catch(() => false),
    ),
    import("@/modules/tender-calendar").then((m) =>
      m.isTenderCalendarAvailable(auth.user.companyId!).catch(() => false),
    ),
    import("@/services/entitlements").then((m) =>
      m.hasFeature(auth.user.companyId!, "company_profile").catch(() => false),
    ),
    getPendingEmailChange(auth.user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      {/* A. Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t.accountTitle}</CardTitle>
          <CardDescription>{t.accountBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <AccountProfileForm
            key={`${auth.user.name}|${auth.user.email}|${auth.user.avatarUrl ?? ""}|${pendingEmailChange?.newEmail ?? ""}|${pendingEmailChange?.expiresAt?.toISOString() ?? ""}`}
            initialName={auth.user.name}
            initialEmail={auth.user.email}
            initialAvatarUrl={auth.user.avatarUrl}
            pendingEmail={pendingEmailChange?.newEmail ?? null}
            pendingExpiresAt={pendingEmailChange?.expiresAt?.toISOString() ?? null}
            copy={t}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.companyProfileTitle}</CardTitle>
          <CardDescription>{t.companyProfileBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={companyProfileEnabled ? "/company" : "/upgrade"}
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            {t.editCompanyProfile}
          </Link>
        </CardContent>
      </Card>

      {/* B. Security */}
      <Card>
        <CardHeader>
          <CardTitle>{t.securityTitle}</CardTitle>
          <CardDescription>{t.securityBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <form action={signOut}>
            <Button type="submit" variant="outline">
              {t.signOut}
            </Button>
          </form>
          <form action={signOutOtherDevices}>
            <Button type="submit" variant="outline" title={t.revokeOtherSessionsHint}>
              {t.revokeOtherSessions}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* C. Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>{t.notificationsTitle}</CardTitle>
          <CardDescription>{t.notificationsBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationPrefsForm
            initial={prefs}
            copy={t}
            canManage={canManageCompanySettings(auth.user.role)}
          />
        </CardContent>
      </Card>

      {documentComplianceEnabled || tenderCalendarEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.moduleRemindersTitle}</CardTitle>
            <CardDescription>{t.moduleRemindersBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {documentComplianceEnabled ? (
              <Link
                href="/document-compliance/settings"
                className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-background"
              >
                {t.complianceRemindersLink}
              </Link>
            ) : null}
            {tenderCalendarEnabled ? (
              <Link
                href="/tender-calendar/settings"
                className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-background"
              >
                {t.calendarRemindersLink}
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* D. Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>{t.appearanceTitle}</CardTitle>
          <CardDescription>{t.appearanceBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <p className="text-sm text-muted">{t.appearanceThemeHint}</p>
        </CardContent>
      </Card>

      {/* E. Billing & Subscription */}
      <BillingSubscriptionSection
        summary={billingSummary}
        settingsCopy={t}
        billingCopy={billingCopy}
        locale={locale}
      />

      <Card>
        <CardHeader>
          <CardTitle>{cookiesCopy.settingsTitle}</CardTitle>
          <CardDescription>{cookiesCopy.settingsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <CookieSettingsLink
            label={cookiesCopy.manageCookies}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-background"
          />
        </CardContent>
      </Card>
    </div>
  );
}
