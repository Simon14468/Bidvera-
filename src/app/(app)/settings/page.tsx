export const dynamic = "force-dynamic";

import { logout, revokeOtherSessions } from "@/app/actions";
import { requireAuth } from "@/auth/session";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { AccountProfileForm } from "@/components/settings/account-profile-form";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { getCompanyNotificationPrefs } from "@/services/notifications/prefs";
import { companyHasUpgradePath } from "@/services/billing/upgrade-eligibility";
import { getPendingEmailChange } from "@/services/auth/tokens";
import { getTrialUsage } from "@/services/usage";
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
  const t = getDictionary(locale).app.settings;
  const auth = await requireAuth();
  if (!auth.user.companyId) redirect("/onboarding/company");
  const [
    usage,
    prefs,
    showUpgrade,
    documentComplianceEnabled,
    tenderCalendarEnabled,
    companyProfileEnabled,
    pendingEmailChange,
  ] = await Promise.all([
      getTrialUsage(auth.user.companyId),
      getCompanyNotificationPrefs(auth.user.companyId),
      companyHasUpgradePath(auth.user.companyId).catch(() => false),
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

  const planBody = `${String(usage.plan).replaceAll("_", " ")} · ${String(usage.effectiveStatus).replaceAll("_", " ")}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>{t.planTitle}</CardTitle>
          <CardDescription>{planBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/billing"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            {t.manageBilling}
          </Link>
          {showUpgrade ? (
            <Link
              href="/upgrade"
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-background"
            >
              {t.viewUpgrade}
            </Link>
          ) : null}
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
    </div>
  );
}
