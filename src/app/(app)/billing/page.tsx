export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { CancelSubscriptionDialog } from "@/components/billing/cancel-subscription-dialog";
import { UpdatePaymentMethodButton } from "@/components/billing/update-payment-method-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  canCancelProviderSubscription,
  resolveBillingDisplayStatus,
  resolveGraceDaysRemaining,
  resolveTrialCountdown,
  type BillingDisplayStatus,
} from "@/services/billing/billing-display";
import { listPublicCheckoutPlans } from "@/services/billing/catalog";
import {
  canOpenStripeBillingPortal,
  isPaypalManagedBilling,
} from "@/services/billing/billing-portal";
import {
  listCustomerFacingInvoices,
  refreshStripeInvoicesForCompany,
} from "@/services/billing/customer-invoices";
import { companyHasUpgradePath } from "@/services/billing/upgrade-eligibility";
import { countCompanySeats, getEffectiveEntitlements } from "@/services/entitlements";
import { sumCompanyAiTokensInPeriod } from "@/services/entitlements/ai-quota";
import { getTrialUsage } from "@/services/usage";
import { isAnalysesBlocked, isUnlimitedAnalyses } from "@/config/usage";
import type { Dictionary } from "@/i18n/dictionaries";
import Link from "next/link";

type BillingCopy = Dictionary["app"]["billing"];

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

function statusLabel(status: BillingDisplayStatus, copy: BillingCopy): string {
  switch (status) {
    case "TRIALING":
      return copy.statusTrialing;
    case "ACTIVE":
      return copy.statusActive;
    case "PAST_DUE":
      return copy.pastDue;
    case "PAYMENT_FAILED":
      return copy.paymentFailed;
    case "CANCELED":
      return copy.statusCanceled;
    case "UNPAID":
      return copy.statusUnpaid;
    case "EXPIRED":
      return copy.statusExpired;
    case "FREE_WORKSPACE":
      return copy.freeWorkspace;
    case "INCOMPLETE":
      return copy.statusIncomplete;
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale).app.billing;
  const { companyId } = await requireCompanyId();
  const params = await searchParams;

  const [sub, plans, usage, entitlements, seatsUsed, canUpgrade] =
    await Promise.all([
      prisma.subscription.findUnique({
        where: { companyId },
        include: { billingPlan: true },
      }),
      listPublicCheckoutPlans(locale),
      getTrialUsage(companyId),
      getEffectiveEntitlements(companyId),
      countCompanySeats(companyId),
      companyHasUpgradePath(companyId),
    ]);
  await refreshStripeInvoicesForCompany(companyId);
  const invoices = await listCustomerFacingInvoices(companyId);

  const aiUsed = await sumCompanyAiTokensInPeriod(companyId, usage.trialStartedAt
    ? new Date(sub?.currentPeriodStart ?? usage.trialStartedAt)
    : sub?.currentPeriodStart ?? null);

  const displayStatus = resolveBillingDisplayStatus({
    status: sub?.status ?? usage.subscriptionStatus,
    effectiveStatus: usage.effectiveStatus,
    plan: sub?.plan ?? usage.plan,
    slug: sub?.billingPlan?.slug ?? entitlements.planSlug,
    isFree: sub?.billingPlan?.isFree ?? entitlements.planSlug === "free",
  });
  const isFreeWorkspace = displayStatus === "FREE_WORKSPACE";
  const countdown = resolveTrialCountdown({
    status: sub?.status ?? usage.subscriptionStatus,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    trialEndsAt: sub?.currentPeriodEnd ?? usage.trialEndsAt,
  });

  const intervalLabel =
    (sub?.billingInterval ?? usage.billingInterval) === "YEAR"
      ? t.yearlyInterval
      : (sub?.billingInterval ?? usage.billingInterval) === "MONTH"
        ? t.monthlyInterval
        : "—";

  const planName = isFreeWorkspace
    ? t.freeWorkspace
    : (sub?.billingPlan?.name ?? entitlements.planName ?? sub?.plan ?? t.trialFallback);

  const nextBillDate = sub?.currentPeriodEnd ?? (usage.periodEndsAt ? new Date(usage.periodEndsAt) : null);
  const showNextBill =
    Boolean(nextBillDate) &&
    displayStatus === "ACTIVE" &&
    !sub?.cancelAtPeriodEnd &&
    !isFreeWorkspace;

  const priceCents =
    (sub?.billingInterval ?? entitlements.billingInterval) === "YEAR"
      ? (sub?.billingPlan?.annualPriceCents ?? entitlements.annualPriceCents)
      : (sub?.billingPlan?.monthlyPriceCents ?? entitlements.monthlyPriceCents);
  const currency = sub?.billingPlan?.currency ?? entitlements.currency ?? "usd";

  const paymentSummary =
    sub?.paymentMethodBrand && sub.paymentMethodLast4
      ? `${sub.paymentMethodBrand} ···· ${sub.paymentMethodLast4}`
      : sub?.provider === "paypal"
        ? t.paypalMethod
        : "—";

  const analysesUnlimited = isUnlimitedAnalyses(entitlements.analysesLimit);
  const analysesBlocked = isAnalysesBlocked(entitlements.analysesLimit);
  const paymentProblem =
    displayStatus === "PAST_DUE" ||
    displayStatus === "PAYMENT_FAILED" ||
    displayStatus === "UNPAID";
  const canManageStripe = canOpenStripeBillingPortal(sub);
  const paypalBilling = isPaypalManagedBilling(sub);
  const canCancel = canCancelProviderSubscription({
    status: sub?.status ?? "",
    providerSubscriptionId: sub?.providerSubscriptionId,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  });
  const cancelKind = (sub?.status ?? "") === "TRIALING" ? "trial" : "paid";
  const cancelDate = nextBillDate ? formatDate(nextBillDate, locale) : "—";
  const canceledPendingPeriodEnd =
    Boolean(sub?.cancelAtPeriodEnd) && Boolean(nextBillDate) && !isFreeWorkspace;
  const graceDaysRemaining = resolveGraceDaysRemaining(
    usage.gracePeriodEndsAt ?? sub?.gracePeriodEndsAt ?? null,
  );
  // "Subscription ended" applies only after an actual paid → Free downgrade.
  const endedIntoFreeWorkspace = isFreeWorkspace
    ? Boolean(
        await prisma.subscriptionEvent.findFirst({
          where: {
            companyId,
            eventType: "FREE_WORKSPACE_ASSIGNED",
            fromPlan: { in: ["STARTER", "PRO", "BUSINESS"] },
          },
          select: { id: true },
        }),
      )
    : false;
  const upgradesBody =
    plans.length === 1
      ? t.upgradesBodyOne
      : t.upgradesBody.replaceAll("{count}", String(plans.length));

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      {params.activated === "1" ? (
        <Alert variant="success" title={t.activatedTitle}>
          {t.activatedBody}
        </Alert>
      ) : null}

      {usage.isTrialExpired ? (
        <Alert variant="warning" title={t.trialEndedTitle}>
          {t.trialEndedBody}
          <UpgradeLink label={t.viewPlans} />
        </Alert>
      ) : null}

      {canceledPendingPeriodEnd && nextBillDate ? (
        <Alert variant="warning" title={t.canceledAlertTitle}>
          {fill(t.accessUntil, { date: formatDate(nextBillDate, locale) })}
          <UpgradeLink label={t.viewPlans} />
        </Alert>
      ) : null}

      {endedIntoFreeWorkspace ? (
        <Alert variant="warning" title={t.subscriptionEndedTitle}>
          {t.subscriptionEndedBody}
          <UpgradeLink label={t.choosePlan} />
        </Alert>
      ) : null}

      {paymentProblem ? (
        <Alert variant="warning" title={t.paymentProblemTitle}>
          {t.paymentProblemBody}
          {usage.inGrace && usage.gracePeriodEndsAt ? (
            <p className="mt-2">
              {fill(t.graceBody, { date: formatDate(new Date(usage.gracePeriodEndsAt), locale) })}
            </p>
          ) : null}
          {usage.inGrace && graceDaysRemaining != null ? (
            <p className="mt-1">
              {graceDaysRemaining === 1
                ? t.graceDaysRemainingOne
                : fill(t.graceDaysRemaining, { days: graceDaysRemaining })}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {canManageStripe ? (
              <>
                <UpdatePaymentMethodButton copy={t} />
                <UpdatePaymentMethodButton
                  copy={t}
                  variant="outline"
                  label={t.retryPayment}
                />
              </>
            ) : paypalBilling ? (
              <p className="text-sm text-muted">{t.paypalManageHint}</p>
            ) : null}
          </div>
        </Alert>
      ) : usage.inGrace && usage.gracePeriodEndsAt ? (
        <Alert variant="warning" title={t.graceTitle}>
          {fill(t.graceBody, { date: formatDate(new Date(usage.gracePeriodEndsAt), locale) })}
          <UpgradeLink label={t.viewPlans} />
        </Alert>
      ) : null}

      {!usage.accessAllowed && !usage.isTrialExpired && !isFreeWorkspace ? (
        <Alert variant="warning" title={t.inactiveTitle}>
          {t.inactiveBody}
          <UpgradeLink label={t.viewPlans} />
        </Alert>
      ) : null}

      {countdown.show ? (
        <Card className="border-primary/25 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>{t.trialBadge}</CardTitle>
            <CardDescription>
              {countdown.cancelled
                ? t.cancelScheduled
                : countdown.endingToday
                  ? t.trialEndingToday
                  : countdown.daysRemaining === 1
                    ? t.trialEndsInOne
                    : countdown.daysRemaining != null
                      ? fill(t.trialEndsIn, { days: countdown.daysRemaining })
                      : t.statusTrialing}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted">
            {countdown.endsAt ? (
              <p className="font-medium text-foreground">
                {fill(t.trialEndsOn, { date: formatDate(countdown.endsAt, locale) })}
              </p>
            ) : null}
            <p>{t.noChargeToday}</p>
            <p>{t.trialAutoConvert}</p>
          </CardContent>
        </Card>
      ) : null}

      {isFreeWorkspace ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.freeWorkspace}</CardTitle>
            <CardDescription>{t.freeWorkspaceBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted">
              <li>{t.freeCapabilityProfile}</li>
              <li>{t.freeCapabilityCompliance}</li>
            </ul>
            <Link
              href="/upgrade"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
            >
              {t.upgradePlan}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t.currentPlanTitle}</CardTitle>
          <CardDescription>{t.currentPlanBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.plan}</p>
            <p className="mt-1 text-lg font-semibold">{planName}</p>
            {!isFreeWorkspace && priceCents != null && priceCents > 0 ? (
              <p className="mt-1 text-sm text-muted">
                {formatMoney(priceCents, currency)}
                {intervalLabel !== "—" ? ` · ${intervalLabel}` : ""}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.status}</p>
            <p className="mt-1">
              <Badge variant={displayStatus === "ACTIVE" || displayStatus === "TRIALING" ? "default" : "outline"}>
                {statusLabel(displayStatus, t)}
              </Badge>
              {usage.inGrace ? (
                <span className="ms-2 text-sm text-warning">{t.pastDue}</span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.billingCycle}</p>
            <p className="mt-1">{intervalLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.paymentMethod}</p>
            <p className="mt-1">{paymentSummary}</p>
            {canManageStripe ? (
              <div className="mt-2">
                <UpdatePaymentMethodButton copy={t} variant="outline" />
              </div>
            ) : paypalBilling ? (
              <p className="mt-2 text-xs text-muted">{t.paypalManageHint}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.started}</p>
            <p className="mt-1">
              {sub?.startedAt
                ? formatDate(sub.startedAt, locale)
                : usage.trialStartedAt
                  ? formatDate(new Date(usage.trialStartedAt), locale)
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              {showNextBill ? t.nextBillingDate : t.renewal}
            </p>
            <p className="mt-1">
              {nextBillDate && !isFreeWorkspace ? formatDate(nextBillDate, locale) : "—"}
            </p>
          </div>
          {sub?.cancelAtPeriodEnd && nextBillDate ? (
            <div className="sm:col-span-2 space-y-1 text-sm">
              <p className="font-medium text-warning">
                {t.cancellationDate}: {formatDate(nextBillDate, locale)}
              </p>
              <p className="text-muted">{fill(t.accessUntil, { date: formatDate(nextBillDate, locale) })}</p>
              <p className="text-muted">{t.cancelPaidExplainAfter}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {canUpgrade || isFreeWorkspace || displayStatus === "TRIALING" ? (
              <Link
                href="/upgrade"
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
              >
                {displayStatus === "ACTIVE" ? t.changePlan : t.upgradePlan}
              </Link>
            ) : displayStatus === "ACTIVE" ? (
              <Link
                href="/upgrade"
                className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-background"
              >
                {t.changePlan}
              </Link>
            ) : null}
            {canCancel ? (
              <CancelSubscriptionDialog
                kind={cancelKind}
                effectiveDate={cancelDate}
                copy={t}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.usage}</CardTitle>
          <CardDescription>{t.usageTitle}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.seatsUsage}</p>
            <p className="mt-1 font-semibold tabular-nums">
              {seatsUsed} / {entitlements.seatsLimit}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.analysesUsage}</p>
            <p className="mt-1 font-semibold tabular-nums">
              {analysesUnlimited
                ? t.unlimited
                : analysesBlocked
                  ? t.analysesNotIncluded
                  : `${usage.analysesUsed} / ${entitlements.analysesLimit}`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.aiUsage}</p>
            <p className="mt-1 font-semibold tabular-nums">
              {entitlements.aiTokensLimit == null
                ? t.unlimited
                : entitlements.aiTokensLimit <= 0
                  ? t.analysesNotIncluded
                  : `${aiUsed} / ${entitlements.aiTokensLimit}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {plans.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.upgradesTitle}</CardTitle>
            <CardDescription>{upgradesBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/upgrade" className="text-sm font-medium text-primary hover:underline">
              {t.openCheckout}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t.billingHistory}</CardTitle>
          <CardDescription>{t.invoices}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted">{t.billingHistoryEmpty}</p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {(inv.amountCents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(new Date(inv.date), locale)} · {inv.status}
                  </p>
                </div>
                {inv.receiptUrl ? (
                  <a
                    href={inv.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t.viewReceipt}
                  </a>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UpgradeLink({ label }: { label: string }) {
  return (
    <Link
      href="/upgrade"
      className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
    >
      {label}
    </Link>
  );
}
