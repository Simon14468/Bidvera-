import { PlanBadge } from "@/components/billing/plan-badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettingsBillingSummary } from "@/application/settings-billing-summary";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

type SettingsCopy = Dictionary["app"]["settings"];
type BillingCopy = Dictionary["app"]["billing"];

function statusLabel(
  key: SettingsBillingSummary["statusLabelKey"],
  billing: BillingCopy,
): string {
  switch (key) {
    case "TRIALING":
      return billing.statusTrialing;
    case "ACTIVE":
      return billing.statusActive;
    case "PAST_DUE":
      return billing.pastDue;
    case "PAYMENT_FAILED":
      return billing.paymentFailed;
    case "CANCELED":
      return billing.statusCanceled;
    case "UNPAID":
      return billing.statusUnpaid;
    case "EXPIRED":
      return billing.statusExpired;
    case "FREE_WORKSPACE":
      return billing.freeWorkspace;
    case "INCOMPLETE":
      return billing.statusIncomplete;
    default:
      return key;
  }
}

export function BillingSubscriptionSection({
  summary,
  settingsCopy,
  billingCopy,
  locale,
}: {
  summary: SettingsBillingSummary;
  settingsCopy: SettingsCopy;
  billingCopy: BillingCopy;
  locale: Locale;
}) {
  const interval =
    summary.billingInterval === "YEAR"
      ? billingCopy.yearlyInterval
      : summary.billingInterval === "MONTH"
        ? billingCopy.monthlyInterval
        : null;

  const periodEnd = summary.currentPeriodEnd
    ? formatDate(new Date(summary.currentPeriodEnd), locale)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{settingsCopy.billingSectionTitle}</CardTitle>
          <PlanBadge
            label={summary.badge.label}
            tone={summary.badge.tone}
            title={summary.planName}
            size="md"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {summary.paymentProblem ? (
          <Alert variant="warning" title={billingCopy.paymentProblemTitle}>
            {billingCopy.paymentProblemBody}
            {summary.graceDaysRemaining != null ? (
              <p className="mt-2 text-sm">
                {summary.graceDaysRemaining === 1
                  ? billingCopy.graceDaysRemainingOne
                  : billingCopy.graceDaysRemaining.replaceAll(
                      "{days}",
                      String(summary.graceDaysRemaining),
                    )}
              </p>
            ) : null}
          </Alert>
        ) : null}

        {summary.cancelAtPeriodEnd && periodEnd && summary.badge.hasPaidAccess ? (
          <Alert variant="warning" title={billingCopy.canceledAlertTitle}>
            {billingCopy.accessUntil.replaceAll("{date}", periodEnd)}
          </Alert>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {settingsCopy.currentPlanLabel}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{summary.planName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {settingsCopy.statusLabel}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {statusLabel(summary.statusLabelKey, billingCopy)}
            </dd>
          </div>
          {interval ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {settingsCopy.intervalLabel}
              </dt>
              <dd className="mt-1 text-sm text-foreground">{interval}</dd>
            </div>
          ) : null}
          {periodEnd ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {summary.cancelAtPeriodEnd
                  ? settingsCopy.accessUntilLabel
                  : summary.badge.label === "TRIAL"
                    ? settingsCopy.trialEndsLabel
                    : settingsCopy.renewsLabel}
              </dt>
              <dd className="mt-1 text-sm text-foreground">{periodEnd}</dd>
            </div>
          ) : null}
          {summary.provider ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {settingsCopy.providerLabel}
              </dt>
              <dd className="mt-1 text-sm capitalize text-foreground">{summary.provider}</dd>
            </div>
          ) : null}
        </dl>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {settingsCopy.includedFeatures}
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {summary.features.map((f) => (
              <li
                key={f.key}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                {f.enabled ? (
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                ) : (
                  <Minus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                )}
                <span className={f.enabled ? undefined : "text-muted"}>{f.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/billing"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            {settingsCopy.manageBilling}
          </Link>
          {summary.canUpgrade ? (
            <Link
              href="/upgrade"
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-background"
            >
              {summary.badge.hasPaidAccess
                ? settingsCopy.changePlan
                : settingsCopy.viewUpgrade}
            </Link>
          ) : summary.badge.hasPaidAccess ? (
            <Link
              href="/upgrade"
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-background"
            >
              {settingsCopy.changePlan}
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
