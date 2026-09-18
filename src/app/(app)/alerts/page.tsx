export const dynamic = "force-dynamic";

import { AlertListItem } from "@/components/alerts/alert-list-item";
import { MarkAllReadButton } from "@/components/alerts/mark-all-read-button";
import { FeatureUpgradeNotice } from "@/components/billing/feature-upgrade-notice";
import { requireCompanyId } from "@/auth/session";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { hasFeature } from "@/services/entitlements";
import { notificationService } from "@/services/notifications";
import { Bell } from "lucide-react";

export default async function AlertsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.alerts;
  const { companyId } = await requireCompanyId();

  const allowed = await hasFeature(companyId, "smart_alerts");
  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        </div>
        <FeatureUpgradeNotice
          featureName={t.title}
          description="Smart Alerts and the alerts inbox are not included in your current plan. Upgrade to receive deadline and workflow notifications."
        />
      </div>
    );
  }

  await notificationService.dispatchDueAlerts(15).catch(() => 0);
  const [alerts, unread] = await Promise.all([
    notificationService.listCompanyAlerts(companyId),
    notificationService.countUnread(companyId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
          {unread > 0 ? (
            <p className="mt-1 text-xs font-medium text-primary">
              {t.unreadCount.replace("{count}", String(unread))}
            </p>
          ) : null}
        </div>
        {unread > 0 ? <MarkAllReadButton label={t.markAllRead} /> : null}
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t.emptyTitle}
          description={t.emptyDescription}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertListItem
              key={alert.id}
              alert={alert}
              newBadgeLabel={t.newBadge}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
