import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { DecisionType } from "@/domain/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import {
  decisionBadgeClass,
  getDecisionLabel,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

type Confidence = "LOW" | "MEDIUM" | "HIGH" | number;
type TenderDetailCopy = Dictionary["app"]["tenderDetail"];

interface DecisionCardProps {
  decision: DecisionType;
  fitScore: number | null;
  confidence: Confidence;
  why: string;
  fitBreakdown?: CompanyTenderFitBreakdown | null;
  readiness?: {
    score: number | null;
    attention: string[];
    recommendation: string;
    counts: { ready: number; missing: number; verify: number; unknown: number };
  } | null;
  keyBlockers?: string[];
  reviewItems?: string[];
  className?: string;
  copy?: TenderDetailCopy;
}

function resolveConfidenceLabel(
  confidence: Confidence,
  copy: TenderDetailCopy,
): string {
  const level =
    typeof confidence === "number"
      ? confidence >= 75
        ? "HIGH"
        : confidence >= 45
          ? "MEDIUM"
          : "LOW"
      : confidence;
  if (level === "HIGH") return copy.confidenceHigh;
  if (level === "MEDIUM") return copy.confidenceMedium;
  return copy.confidenceLow;
}

function heroFor(decision: DecisionType, copy: TenderDetailCopy) {
  if (decision === "BID") {
    return {
      label: copy.heroBidLabel,
      hint: copy.heroBidHint,
      bar: "bg-success",
      ring: "ring-success/25",
    };
  }
  if (decision === "REVIEW") {
    return {
      label: copy.heroReviewLabel,
      hint: copy.heroReviewHint,
      bar: "bg-warning",
      ring: "ring-warning/25",
    };
  }
  return {
    label: copy.heroNoBidLabel,
    hint: copy.heroNoBidHint,
    bar: "bg-danger",
    ring: "ring-danger/25",
  };
}

export async function DecisionCard({
  decision,
  fitScore,
  confidence,
  why,
  fitBreakdown,
  readiness,
  keyBlockers,
  reviewItems,
  className,
  copy: copyProp,
}: DecisionCardProps) {
  const locale = await getLocale();
  const copy = copyProp ?? getDictionary(locale).app.tenderDetail;
  const level = resolveConfidenceLabel(confidence, copy);
  const hero = heroFor(decision, copy);
  const scoringUnavailable = fitBreakdown?.scoringAvailable === false || fitScore == null;
  const clamped =
    fitScore == null ? 0 : Math.max(0, Math.min(100, fitScore));
  const dimensions = fitBreakdown?.dimensions ?? [];
  const readinessUnavailable = readiness?.score == null && fitBreakdown?.scoringAvailable === false;
  const readinessLabel =
    readinessUnavailable
      ? "UNAVAILABLE"
      : readiness?.score == null
        ? null
        : formatPercent(readiness.score);
  const fitDisplay = scoringUnavailable ? "UNAVAILABLE" : formatPercent(fitScore ?? 0);
  const decisionText = getDecisionLabel(decision, locale);

  return (
    <Card
      className={cn(
        "animate-scale-in overflow-hidden ring-1",
        hero.ring,
        decision === "BID" && "border-success/30",
        decision === "REVIEW" && "border-warning/30",
        decision === "NO_BID" && "border-danger/30",
        className,
      )}
    >
      <div
        className={cn(
          "border-b border-border px-5 py-5 sm:px-6",
          decision === "BID" && "bg-success/[0.06]",
          decision === "REVIEW" && "bg-warning/[0.07]",
          decision === "NO_BID" && "bg-danger/[0.06]",
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {copy.decisionSupport}
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge
              statusIcon
              className={cn(
                "px-3 py-1 text-base font-semibold tracking-tight",
                decisionBadgeClass(decision),
              )}
            >
              {decisionText}
              {` — ${fitDisplay} ${copy.fitSuffix}`}
            </Badge>
            <p className="mt-3 text-lg font-semibold text-foreground">{hero.label}</p>
            <p className="mt-1 text-sm text-muted">{hero.hint}</p>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {copy.overallFit}
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                {fitDisplay}
              </p>
              {!scoringUnavailable ? (
              <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-border">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", hero.bar)}
                  style={{ width: `${clamped}%` }}
                />
              </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {copy.confidence}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{level}</p>
            </div>
          </div>
        </div>
      </div>

      {dimensions.length > 0 ? (
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {copy.companyTenderFit}
          </p>
          <ul className="mt-4 space-y-3">
            {dimensions.map((dim) => {
              const score = dim.score;
              const unknown = dim.status === "unknown" || score == null;
              return (
                <li key={dim.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{dim.label}</span>
                    <span className="tabular-nums text-muted">
                      {unknown ? copy.unknown : formatPercent(score)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        unknown ? "bg-border" : hero.bar,
                      )}
                      style={{
                        width: unknown
                          ? "8%"
                          : `${Math.max(0, Math.min(100, score))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {dim.note}
                    {dim.basis === "ai_assessment" ? copy.basisAi : null}
                    {dim.basis === "unknown" ? copy.basisNotProvided : null}
                    {dim.basis === "confirmed_from_profile"
                      ? copy.basisFromProfile
                      : null}
                    {dim.basis === "confirmed_from_tender"
                      ? copy.basisFromTender
                      : null}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {readiness ? (
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {copy.tenderReadiness}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {readinessLabel ?? "—"}
            </p>
          </div>
          {readiness.attention.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {readiness.attention.slice(0, 3).map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {copy.readinessCounts
                .replaceAll("{ready}", String(readiness.counts.ready))
                .replaceAll("{verify}", String(readiness.counts.verify))
                .replaceAll("{missing}", String(readiness.counts.missing))}
            </p>
          )}
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-foreground">{copy.recommendation} </span>
            {readiness.recommendation}
          </p>
        </div>
      ) : null}

      {keyBlockers && keyBlockers.length > 0 ? (
        <div className="border-b border-border bg-danger/[0.04] px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Hard blockers
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {keyBlockers.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">{copy.keyBlockersNext}</p>
        </div>
      ) : null}

      {reviewItems && reviewItems.length > 0 ? (
        <div className="border-b border-border bg-warning/[0.04] px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Items requiring verification
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {reviewItems.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <CardContent className="space-y-4 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {copy.whyTitle}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {why}
          </p>
        </div>
        {fitBreakdown?.recommendation ? (
          <p className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted">
            <span className="font-medium text-foreground">{copy.recommendation} </span>
            {fitBreakdown.recommendation}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
