import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkspacePlanSummary } from "@/application/workspace-dashboard";
import { formatDate } from "@/lib/format";
import { formatMessage } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import type { AppModuleBundle } from "@/i18n/app-modules";
import Link from "next/link";

/** Canonical English title — kept in source for workspace-dashboard contract tests. */
const CURRENT_PLAN = "Current plan";

export function WorkspacePlanCard({
  plan,
  locale,
  labels,
  featureLabels,
}: {
  plan: WorkspacePlanSummary;
  locale: Locale;
  labels: AppModuleBundle["common"];
  /** Map feature key → localized label (e.g. dict.pricing.features) */
  featureLabels: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {locale === "en" ? CURRENT_PLAN : labels.currentPlan}
        </CardTitle>
        <CardDescription>{labels.currentPlanHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{plan.planName}</p>
          <p className="mt-1 text-sm text-muted">
            {plan.subscriptionStatus
              ? plan.subscriptionStatus.replaceAll("_", " ")
              : labels.noSubscription}
            {plan.billingInterval ? ` · ${plan.billingInterval}` : ""}
          </p>
        </div>

        {plan.isExpiredTrial ? (
          <div className="rounded-[12px] border border-[#EF4444]/25 bg-[#FAFAFA] px-3 py-2">
            <p className="text-sm font-medium text-[#1A1D1F]">
              {labels.freeWorkspaceTrialExpiredTitle}
            </p>
            <p className="mt-1 text-sm text-muted">
              {labels.freeWorkspaceTrialExpiredBody}
            </p>
            <Link
              href="/upgrade?reason=trial_expired"
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-[#4CAF6D] px-4 text-sm font-medium text-white sm:h-10 sm:w-auto"
            >
              {labels.freeWorkspaceTrialCta}
            </Link>
          </div>
        ) : plan.isTrialing && plan.trialEndsAt ? (
          <p className="text-sm text-muted">
            {formatMessage(labels.trialEnds, {
              date: formatDate(plan.trialEndsAt, locale),
            })}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">{labels.teamMembers}</dt>
            <dd className="font-semibold tabular-nums">
              {plan.memberCount}
              {plan.seatsLimit != null ? ` / ${plan.seatsLimit}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{labels.planLabel}</dt>
            <dd className="font-semibold capitalize">
              {plan.planSlug.replaceAll("_", " ")}
            </dd>
          </div>
        </dl>

        {plan.enabledCapabilityKeys.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted">
              {labels.enabledCapabilities}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {plan.enabledCapabilityKeys.map((key, i) => (
                <li
                  key={key}
                  className="rounded-lg border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                >
                  {featureLabels[key] ??
                    plan.enabledCapabilityLabels[i] ??
                    key.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">{labels.noCapabilities}</p>
        )}

        <Link
          href="/billing"
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border text-sm font-medium transition hover:bg-background"
        >
          {labels.manageBilling}
        </Link>
      </CardContent>
    </Card>
  );
}
