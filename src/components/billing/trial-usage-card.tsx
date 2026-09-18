import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrialUsage } from "@/domain/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import Link from "next/link";

type BillingCopy = Dictionary["app"]["billing"];

interface TrialUsageCardProps {
  usage: TrialUsage;
  showUpgrade?: boolean;
  copy: BillingCopy;
  locale?: Locale;
}

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function TrialUsageCard({
  usage,
  showUpgrade,
  copy,
  locale = "en",
}: TrialUsageCardProps) {
  const unlimited = usage.isUnlimited === true;
  const pct = unlimited
    ? Math.min(100, usage.analysesUsed > 0 ? 8 : 0)
    : (usage.analysesUsed / Math.max(usage.analysesLimit, 1)) * 100;
  const nearLimit = !unlimited && usage.analysesRemaining <= 1;
  const planLabel = usage.plan
    ? String(usage.plan).replaceAll("_", " ")
    : copy.plan;
  const trialExpired = usage.isTrialExpired === true;
  const onTrial =
    !unlimited &&
    (usage.plan === "TRIAL" || usage.subscriptionStatus === "TRIALING");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{unlimited ? copy.usageTitle : copy.trialUsageTitle}</CardTitle>
        <CardDescription>
          {trialExpired
            ? copy.trialEndedDesc
            : unlimited
              ? fill(copy.unlimitedDesc, {
                  plan: planLabel,
                  status: usage.subscriptionStatus ?? "ACTIVE",
                })
              : fill(copy.remainingDesc, {
                  remaining: usage.analysesRemaining,
                  limit: usage.analysesLimit,
                })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onTrial && usage.trialEndsAt ? (
          <p className="text-sm text-muted">
            {fill(copy.trialEnds, { date: formatDate(usage.trialEndsAt, locale) })}
            {trialExpired ? (
              <span className="ms-1 font-medium text-danger">{copy.expired}</span>
            ) : null}
          </p>
        ) : null}

        {!unlimited ? <Progress value={pct} label={copy.analysesUsed} /> : null}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">{copy.used}</dt>
            <dd className="font-semibold">{usage.analysesUsed}</dd>
          </div>
          <div>
            <dt className="text-muted">{copy.remaining}</dt>
            <dd className="font-semibold">
              {unlimited ? copy.unlimited : usage.analysesRemaining}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{copy.hoursSaved}</dt>
            <dd className="font-semibold">{usage.estimatedHoursSaved}h</dd>
          </div>
          <div>
            <dt className="text-muted">{copy.risksDetected}</dt>
            <dd className="font-semibold">{usage.risksDetected}</dd>
          </div>
        </dl>
        {(trialExpired || (!unlimited && usage.analysesRemaining === 0)) &&
        (showUpgrade || nearLimit || trialExpired) ? (
          <Link
            href="/upgrade"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white hover:bg-primary-hover"
          >
            {copy.upgradeContinue}
          </Link>
        ) : !unlimited && nearLimit && !trialExpired ? (
          <p className="text-sm text-muted">
            {copy.runningLow}{" "}
            <Link href="/upgrade" className="font-medium text-primary hover:underline">
              {copy.seePlans}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
