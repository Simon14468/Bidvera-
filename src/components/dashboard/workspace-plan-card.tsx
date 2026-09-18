import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspacePlanSummary } from "@/application/workspace-dashboard";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import Link from "next/link";

export function WorkspacePlanCard({
  plan,
  locale,
}: {
  plan: WorkspacePlanSummary;
  locale: Locale;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current plan</CardTitle>
        <CardDescription>
          Workspace subscription and enabled capabilities for your company.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{plan.planName}</p>
          <p className="mt-1 text-sm text-muted">
            {plan.subscriptionStatus
              ? plan.subscriptionStatus.replaceAll("_", " ")
              : "No active subscription row"}
            {plan.billingInterval ? ` · ${plan.billingInterval}` : ""}
          </p>
        </div>

        {plan.isTrialing && plan.trialEndsAt ? (
          <p className="text-sm text-muted">
            Trial ends {formatDate(plan.trialEndsAt, locale)}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">Team members</dt>
            <dd className="font-semibold tabular-nums">
              {plan.memberCount}
              {plan.seatsLimit != null ? ` / ${plan.seatsLimit}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Plan</dt>
            <dd className="font-semibold capitalize">{plan.planSlug.replaceAll("_", " ")}</dd>
          </div>
        </dl>

        {plan.enabledCapabilityLabels.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted">Enabled capabilities</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {plan.enabledCapabilityLabels.map((label) => (
                <li
                  key={label}
                  className="rounded-lg border border-border bg-background px-2 py-0.5 text-xs capitalize text-foreground"
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">No commercial capabilities enabled yet.</p>
        )}

        <Link
          href="/billing"
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border text-sm font-medium transition hover:bg-background"
        >
          Manage billing
        </Link>
      </CardContent>
    </Card>
  );
}
