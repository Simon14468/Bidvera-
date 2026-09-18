import type { TenderReport } from "@/services/reports/tender-report";
import {
  deriveCanonicalReportSections,
  formatDeadlineDisplay,
  type ReportFeatureAccess,
} from "@/services/reports/report-canonical-view";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { SourceViewerButton } from "@/components/tenders/source-viewer";
import {
  formatCompanyEvidenceDisplay,
  formatSourceLocation,
  TENDER_SOURCE_LABEL,
  COMPANY_EVIDENCE_LABEL,
} from "@/domain/provenance";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { formatDate, formatDateTime } from "@/lib/format";
import { getDecisionLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";

type ReportCopy = Dictionary["app"]["report"];

function basisLabel(status: string, t: ReportCopy): string {
  switch (status) {
    case "VERIFIED":
      return t.basisDirect;
    case "INFERRED":
      return t.basisAi;
    default:
      return t.basisUncertain;
  }
}

function verificationStatusLabel(status: string, t: ReportCopy): string {
  switch (status) {
    case "VERIFIED":
      return t.verificationStatusVerified;
    case "NEEDS_VERIFICATION":
      return t.verificationStatusNeedsVerification;
    case "MISSING_EVIDENCE":
      return t.verificationStatusMissingEvidence;
    case "NOT_APPLICABLE":
      return t.verificationStatusNotApplicable;
    default:
      return status;
  }
}

/**
 * Professional decision report for authorized users.
 * No ML lifecycle jargon — actionable sections only.
 */
export async function TenderReportView({
  report,
  className,
  featureAccess,
}: {
  report: TenderReport;
  className?: string;
  featureAccess?: ReportFeatureAccess;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale).app.report;
  const sections = deriveCanonicalReportSections(report, featureAccess);
  const matrix = sections.complianceMatrix;
  const missing = sections.missingRequirements;
  const verify = sections.verifyRequirements;
  const clarifications = sections.clarifications;
  const learning = sections.learningSignal;
  const decisionMemory = sections.decisionMemoryInsights;
  const outcomeLearning = sections.outcomeLearningInsights;
  const decisionOutcome = sections.decisionOutcome;
  const evidenceItems = sections.evidence;
  const verification = sections.verificationIntelligence;

  const decisionLabel = sections.decision
    ? getDecisionLabel(sections.decision, locale)
    : sections.companyKnowledgeOnly
      ? "—"
      : sections.fitBreakdown?.scoringAvailable === false
        ? "ANALYSIS INCOMPLETE"
        : "—";

  return (
    <article className={cn("space-y-8 text-foreground", className)}>
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {t.reportEyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {sections.title}
        </h1>
        <p className="text-sm text-muted">
          {sections.client ?? t.unknownClient}
          {" · "}
          {t.deadline}{" "}
          {formatDeadlineDisplay(
            sections.deadlineIso,
            sections.deadlineTimezone,
            sections.deadlineStatus ?? null,
            sections.deadlineIso
              ? sections.deadlineTimezone && sections.deadlineIso.includes("T")
                ? `${formatDateTime(sections.deadlineIso, locale)} (${sections.deadlineTimezone})`
                : formatDate(sections.deadlineIso, locale)
              : "",
          )}
          {" · "}
          {t.analyzed} {formatDateTime(sections.analyzedAt, locale)}
        </p>
      </header>

      {sections.companyKnowledgeOnly ? (
        <section className="rounded-xl border border-warning/30 bg-warning/[0.06] p-5">
          <p className="text-sm leading-relaxed text-foreground">
            {report.reasoning ?? t.unknownClient}
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <Stat
          label={t.recommendation}
          value={sections.companyKnowledgeOnly ? "—" : decisionLabel}
          strong
          tone={
            sections.decision === "BID"
              ? "positive"
              : sections.decision === "REVIEW"
                ? "medium"
                : sections.decision === "NO_BID"
                  ? "negative"
                  : undefined
          }
        />
        <Stat
          label={t.companyTenderFit}
          value={
            sections.fitScoreDisplay === "Not available"
              ? "UNAVAILABLE"
              : sections.fitScoreDisplay
          }
        />
        <Stat label={t.confidence} value={report.confidence ?? "—"} />
      </section>

      <Section title={t.whyTitle}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {report.reasoning ?? "—"}
        </p>
      </Section>

      {sections.bidScore && !sections.companyKnowledgeOnly ? (
        <Section title={t.bidScore}>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="inline-flex flex-wrap items-center gap-2 text-xl font-semibold tabular-nums">
              <StatusIndicator
                tone={
                  sections.bidScore.scoringAvailable === false
                    ? "neutral"
                    : reportPriorityTone(sections.bidScore.priority)
                }
                className="size-5"
              />
              <span>
                {sections.bidScoreDisplay === "Not available"
                  ? "UNAVAILABLE"
                  : t.bidScoreLine
                      .replace("{score}", String(sections.bidScore.score))
                      .replace("{priority}", sections.bidScore.priorityLabel)}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted">{sections.bidScore.interpretation}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <p className="inline-flex items-center gap-1.5">
                <span className="text-muted">{t.expectedValue} </span>
                <StatusIndicator
                  tone={qualitativeTone(sections.bidScore.expectedValue, "value")}
                  className="size-3"
                />
                {sections.bidScore.expectedValue}
              </p>
              <p className="inline-flex items-center gap-1.5">
                <span className="text-muted">{t.risk} </span>
                <StatusIndicator
                  tone={qualitativeTone(sections.bidScore.riskLevel, "risk")}
                  className="size-3"
                />
                {sections.bidScore.riskLevel}
              </p>
              <p className="inline-flex items-center gap-1.5">
                <span className="text-muted">{t.effort} </span>
                <StatusIndicator
                  tone={qualitativeTone(sections.bidScore.effort, "effort")}
                  className="size-3"
                />
                {sections.bidScore.effort}
              </p>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted">
              <p>{sections.bidScore.contractValueLabel}</p>
              <p>{sections.bidScore.pursuitCostLabel}</p>
              <p>{sections.bidScore.winProbabilityLabel}</p>
            </div>
            {(sections.bidScore.drivers.some((d) => d.direction === "positive") ||
              sections.bidScore.drivers.some((d) => d.direction === "negative")) && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t.positive}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {sections.bidScore.drivers
                      .filter((d) => d.direction === "positive")
                      .map((d) => (
                        <li key={d.label} className="flex items-start gap-1.5">
                          <StatusIndicator tone="positive" className="mt-0.5 size-3" />
                          {d.label}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t.negative}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {sections.bidScore.drivers
                      .filter((d) => d.direction === "negative")
                      .map((d) => (
                        <li key={d.label} className="flex items-start gap-1.5">
                          <StatusIndicator tone="negative" className="mt-0.5 size-3" />
                          {d.label}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
            {sections.bidScore.certaintyNote ? (
              <p className="mt-3 text-xs text-muted">{sections.bidScore.certaintyNote}</p>
            ) : null}
            <p className="mt-2 text-xs text-muted">{sections.bidScore.disclaimer}</p>
            <p className="mt-1 text-xs text-muted">{sections.bidScore.expectedValueNote}</p>
          </div>
        </Section>
      ) : null}

      {!sections.companyKnowledgeOnly && sections.fitBreakdown?.dimensions?.length ? (
        <Section title={t.companyTenderFit}>
          <ul className="space-y-2 text-sm">
            {sections.fitBreakdown.dimensions.map((dim) => (
              <li
                key={dim.key}
                className="flex justify-between gap-4 border-b border-border/60 pb-2"
              >
                <span className="font-medium">{dim.label}</span>
                <span className="tabular-nums text-muted">
                  {dim.status === "unknown" || dim.score == null
                    ? t.unknown
                    : `${dim.score}%`}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-4 pt-1 font-semibold">
              <span>{t.overall}</span>
              <span className="tabular-nums">
                {sections.fitBreakdown.scoringAvailable === false ||
                sections.fitBreakdown.overall == null
                  ? "UNAVAILABLE"
                  : `${sections.fitBreakdown.overall}%`}
              </span>
            </li>
          </ul>
          {sections.fitBreakdown.recommendation ? (
            <p className="mt-3 text-sm text-muted">
              {sections.fitBreakdown.recommendation}
            </p>
          ) : null}
        </Section>
      ) : null}

      {!sections.companyKnowledgeOnly && sections.readiness && sections.readinessCounts ? (
        <Section title={t.tenderReadiness}>
          <p className="text-sm text-foreground">
            {sections.readinessScoreDisplay === "Not available"
              ? "UNAVAILABLE"
              : sections.readinessScoreDisplay}
            {" · "}
            {t.readinessCounts
              .replace("{ready}", String(sections.readinessCounts.ready))
              .replace("{verify}", String(sections.readinessCounts.verify))
              .replace("{missing}", String(sections.readinessCounts.missing))}
          </p>
          {sections.readiness.attention.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {sections.readiness.attention.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            <span className="font-medium text-foreground">{t.nextStep} </span>
            {sections.readiness.recommendation}
          </p>
        </Section>
      ) : null}

      {!sections.companyKnowledgeOnly && sections.complianceSummary ? (
        <Section title={t.complianceMatrix}>
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat
              label={t.requirements}
              value={sections.complianceSummary.totalRequirements}
            />
            <MiniStat label={t.ready} value={sections.complianceSummary.ready} />
            <MiniStat label={t.missing} value={sections.complianceSummary.missing} />
            <MiniStat label={t.verify} value={sections.complianceSummary.verify} />
            <MiniStat
              label={t.notApplicable}
              value={sections.complianceSummary.notApplicable}
            />
            <MiniStat label={t.withSources} value={sections.complianceSummary.sources} />
          </div>
          {matrix.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {matrix.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{row.requirement}</p>
                    <p className="text-xs text-muted">
                      {row.mandatory ? t.mandatory : t.optional} · {row.status}
                    </p>
                  </div>
                  {row.evidence ? (
                    <p className="mt-2 text-xs text-muted">
                      {TENDER_SOURCE_LABEL}: &ldquo;{row.evidence.slice(0, 180)}
                      {row.evidence.length > 180 ? "…" : ""}&rdquo;
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted">{t.noExcerpt}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {formatSourceLocation(row.tenderSource ?? null) || t.sourceNotLocated}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {COMPANY_EVIDENCE_LABEL}:{" "}
                    {formatCompanyEvidenceDisplay(row.companyEvidence ?? null)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 print:hidden">
                    <SourceViewerButton
                      tenderId={report.tenderId}
                      requirementId={row.requirementId}
                      evidenceId={row.evidenceId}
                      view="tender"
                      label="View tender source"
                    />
                    <SourceViewerButton
                      tenderId={report.tenderId}
                      requirementId={row.requirementId}
                      evidenceId={row.evidenceId}
                      view="company"
                      label="View company evidence"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{t.noRequirements}</p>
          )}
        </Section>
      ) : null}

      {!sections.companyKnowledgeOnly && verification ? (
        <Section title={t.evidenceVerificationTitle}>
          <p className="text-sm text-muted">
            {verification.summary
              ? t.verificationSummary
                  .replace("{verified}", String(verification.summary.verified))
                  .replace(
                    "{needs}",
                    String(verification.summary.needsVerification),
                  )
                  .replace(
                    "{missing}",
                    String(verification.summary.missingEvidence),
                  )
                  .replace("{na}", String(verification.summary.notApplicable))
              : null}
          </p>
          <p className="mt-2 text-xs text-muted">{t.evidenceVerificationDisclaimer}</p>
          {verification.chains.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {verification.chains.map((chain) => (
                <li
                  key={chain.requirementId}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{chain.requirement}</p>
                    <p className="text-xs font-medium text-muted">
                      {verificationStatusLabel(chain.verificationStatus, t)}
                    </p>
                  </div>
                  {chain.verificationReason ? (
                    <p className="mt-2 text-xs text-muted">{chain.verificationReason}</p>
                  ) : null}
                  {chain.evidenceExcerpt ? (
                    <p className="mt-2 text-xs text-muted">
                      {t.evidenceLabel} &ldquo;{chain.evidenceExcerpt.slice(0, 180)}
                      {chain.evidenceExcerpt.length > 180 ? "…" : ""}&rdquo;
                    </p>
                  ) : null}
                  {chain.locationLabel ? (
                    <p className="mt-1 text-xs text-muted">{chain.locationLabel}</p>
                  ) : null}
                  {chain.verifierLabel || chain.verifiedAt ? (
                    <p className="mt-1 text-xs text-muted">
                      {chain.verifierLabel ? `${t.verifierLabel} ${chain.verifierLabel}` : null}
                      {chain.verifierLabel && chain.verifiedAt ? " · " : null}
                      {chain.verifiedAt
                        ? `${t.verifiedAtLabel} ${formatDateTime(chain.verifiedAt, locale)}`
                        : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{t.noVerificationChains}</p>
          )}
        </Section>
      ) : null}

      <Section title={t.missingRequirements}>
        <BulletList
          empty={t.noMissingRequirements}
          items={missing.map(
            (r) =>
              `${r.requirement}${r.mandatory ? t.mandatoryParen : ""}${
                r.requiredAction ? ` — ${r.requiredAction}` : ""
              }`,
          )}
          keys={missing.map((r) => r.id)}
        />
      </Section>

      <Section title={t.verificationItems}>
        <BulletList
          empty={t.nothingPendingVerify}
          items={verify.map(
            (r) =>
              `${r.requirement}${
                r.requiredAction ? ` — ${r.requiredAction}` : ""
              }`,
          )}
          keys={verify.map((r) => r.id)}
        />
      </Section>

      <Section title={t.risks}>
        <BulletList
          empty={t.noRisks}
          items={sections.risks.map((r) => {
            if ("explanation" in r) {
              return `${r.severity}: ${r.title} — ${r.explanation}`;
            }
            return `[${r.severity}] ${r.category}: ${r.description}`;
          })}
          keys={sections.risks.map((r) => r.id)}
        />
      </Section>

      <Section title={t.clarifications}>
        {clarifications.length === 0 ? (
          <p className="text-sm text-muted">{t.noClarifications}</p>
        ) : (
          <ul className="space-y-3">
            {clarifications.map((q) => (
              <li
                key={q.id}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium text-foreground">{t.reason} </span>
                  {q.reason}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t.source} {q.source}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.evidence}>
        {evidenceItems.length === 0 ? (
          <p className="text-sm text-muted">{t.noEvidence}</p>
        ) : (
          <ul className="space-y-3">
            {evidenceItems.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-sm leading-relaxed text-muted">
                  &ldquo;{e.text}&rdquo;
                </p>
                <p className="mt-2 text-xs text-muted">
                  {[
                    basisLabel(e.verificationStatus, t),
                    e.sourceSection,
                    e.sourcePage != null
                      ? t.page.replace("{n}", String(e.sourcePage))
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.historicalTitle}>
        {learning?.detected ? (
          <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-4">
            <p className="text-sm font-medium text-foreground">{learning.headline}</p>
            <p className="text-sm leading-relaxed text-muted">{t.historicalBody}</p>
            {!learning.influenceAllowed && learning.suppressedReason ? (
              <p className="text-sm text-muted">{learning.suppressedReason}</p>
            ) : null}
            <p className="text-xs text-muted">{t.historicalPriority}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t.historicalEmpty}</p>
        )}
      </Section>

      {decisionOutcome?.outcome ? (
        <Section title={t.decisionOutcomeTitle}>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{t.decisionOutcomeBidvera}</dt>
                <dd className="font-medium">{decisionOutcome.bidveraDecisionLabel}</dd>
              </div>
              {decisionOutcome.humanFinalDecisionLabel ? (
                <div>
                  <dt className="text-xs text-muted">{t.decisionOutcomeHuman}</dt>
                  <dd className="font-medium">{decisionOutcome.humanFinalDecisionLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-muted">{t.decisionOutcomeActual}</dt>
                <dd className="font-medium">{decisionOutcome.outcomeLabel}</dd>
              </div>
              {decisionOutcome.outcomeDate ? (
                <div>
                  <dt className="text-xs text-muted">{t.decisionOutcomeDate}</dt>
                  <dd>{formatDate(decisionOutcome.outcomeDate, locale)}</dd>
                </div>
              ) : null}
              {decisionOutcome.reasonDetail || decisionOutcome.reasonCode ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">{t.decisionOutcomeReason}</dt>
                  <dd>{decisionOutcome.reasonDetail ?? decisionOutcome.reasonCode}</dd>
                </div>
              ) : null}
              {decisionOutcome.recommendationEvaluation ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">{t.decisionOutcomeSuccess}</dt>
                  <dd>
                    {recommendationEvaluationLabel(decisionOutcome.recommendationEvaluation, t)}
                  </dd>
                </div>
              ) : null}
              {decisionOutcome.attachmentFileName ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">{t.decisionOutcomeAttachment}</dt>
                  <dd>{decisionOutcome.attachmentFileName}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 text-xs text-muted">{decisionOutcome.userEvidenceDisclaimer}</p>
            <p className="mt-3 text-xs text-muted">{decisionOutcome.disclaimer}</p>
          </div>
        </Section>
      ) : null}

      {outcomeLearning?.similarOutcomes?.length ||
      outcomeLearning?.statistics?.summary ? (
        <Section title={t.outcomeLearningTitle}>
          <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
            {outcomeLearning.statistics?.summary ? (
              <p className="text-sm font-medium text-foreground">
                {outcomeLearning.statistics.summary}
              </p>
            ) : outcomeLearning.winRateSummary ? (
              <p className="text-sm font-medium text-foreground">
                {outcomeLearning.winRateSummary}
              </p>
            ) : null}
            {outcomeLearning.statistics ? (
              <p className="text-xs text-muted">
                n={outcomeLearning.statistics.comparableCount} comparable ·{" "}
                {outcomeLearning.statistics.won} won · {outcomeLearning.statistics.lost} lost
              </p>
            ) : null}
            {outcomeLearning.similarOutcomes.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {outcomeLearning.similarOutcomes.map((p) => (
                  <li key={p.tenderId} className="text-muted">
                    <span className="font-medium text-foreground">{p.title}</span>
                    {" — "}
                    {p.decisionLabel} → {p.outcomeLabel}
                    {p.outcomeDate ? ` (${p.outcomeDate.slice(0, 10)})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted">{outcomeLearning.disclaimer}</p>
          </div>
        </Section>
      ) : null}

      <Section title={t.decisionMemoryTitle}>
        <div className="mb-3 rounded-lg border border-primary/20 bg-primary-muted/40 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t.currentAnalysisLabel}
          </p>
          <p className="mt-1 text-sm text-muted">{t.decisionMemoryCurrentNote}</p>
        </div>
        {decisionMemory?.matches?.length ? (
          <ul className="space-y-3">
            {decisionMemory.matches.map((m) => (
              <li
                key={m.memoryId}
                className="rounded-xl border border-border bg-card px-4 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.historicalDecisionLabel}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {m.decisionLabel} — {m.title}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {t.relevanceReasons}: {m.relevanceReasons.join(" · ")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {m.reasoning}
                </p>
                {m.recordedOutcome ? (
                  <p className="mt-2 text-xs text-muted">
                    {t.decisionOutcomeRecorded}: {m.outcomeLabel}
                    {m.outcomeDate
                      ? ` · ${formatDate(m.outcomeDate, locale)}`
                      : ""}
                    {m.recommendationEvaluation
                      ? ` · ${recommendationEvaluationLabel(m.recommendationEvaluation, t)}`
                      : m.decisionSuccess
                        ? ` · ${decisionSuccessLabel(m.decisionSuccess, t)}`
                        : ""}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted">{m.disclaimer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t.decisionMemoryEmpty}</p>
        )}
      </Section>

      {sections.missingDocuments.length > 0 ? (
        <Section title={t.missingDocuments}>
          <BulletList
            empty="—"
            items={sections.missingDocuments.map(
              (d) => `${d.documentName} — ${d.reason}`,
            )}
            keys={sections.missingDocuments.map((d) => d.id)}
          />
        </Section>
      ) : null}

      {sections.actionPlan?.computed && sections.actionPlan.items.filter((i) => !i.simulationOnly).length > 0 ? (
        <Section title="Action Plan">
          {sections.actionPlan.deadlineUrgency.tenderDeadline ? (
            <p className="text-sm text-muted">
              {sections.actionPlan.deadlineUrgency.daysRemaining != null
                ? `Deadline in ${sections.actionPlan.deadlineUrgency.daysRemaining} day(s)`
                : "Tender deadline set"}
            </p>
          ) : (
            <p className="text-sm text-muted">Deadline unavailable</p>
          )}
          <ol className="list-decimal space-y-2 ps-5 text-sm">
            {sections.actionPlan.items
              .filter((i) => !i.simulationOnly && i.status !== "COMPLETED" && i.status !== "CANCELLED")
              .slice(0, 10)
              .map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.title}</span>
                  <span className="text-muted">
                    {" "}
                    — {a.ownerLabel ?? "UNKNOWN"} — {a.status.replace(/_/g, " ")}
                    {a.blocking ? " · blocking" : ""}
                  </span>
                </li>
              ))}
          </ol>
        </Section>
      ) : (
        <Section title={t.nextActions}>
          {sections.nextActions.length === 0 ? (
            <p className="text-sm text-muted">{t.noNextActions}</p>
          ) : (
            <ol className="list-decimal space-y-2 ps-5 text-sm">
              {sections.nextActions.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.title}</span>
                  {a.description ? (
                    <span className="text-muted"> — {a.description}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function recommendationEvaluationLabel(
  value: import("@/domain/decision-outcome-learning").RecommendationEvaluation,
  t: ReportCopy,
): string {
  switch (value) {
    case "SUCCESSFUL":
      return t.decisionOutcomeEvalSuccessful;
    case "UNSUCCESSFUL":
      return t.decisionOutcomeEvalUnsuccessful;
    default:
      return t.decisionOutcomeEvalNotEvaluated;
  }
}

function decisionSuccessLabel(
  value: NonNullable<
    import("@/domain/decision-outcome-learning").DecisionSuccessEvaluation
  >,
  t: ReportCopy,
): string {
  switch (value) {
    case "successful":
      return t.decisionOutcomeSuccessAligned;
    case "unsuccessful":
      return t.decisionOutcomeSuccessMisaligned;
    case "pending":
      return t.decisionOutcomeSuccessPending;
    default:
      return t.decisionOutcomeSuccessNeutral;
  }
}

function Stat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: StatusTone;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums",
          !tone && strong && "text-primary",
          tone === "positive" && "text-success",
          tone === "medium" && "text-warning",
          tone === "negative" && "text-danger",
        )}
      >
        {tone ? <StatusIndicator tone={tone} className="size-4" /> : null}
        {value}
      </p>
    </div>
  );
}

function reportPriorityTone(
  priority: NonNullable<TenderReport["bidScore"]>["priority"],
): StatusTone {
  switch (priority) {
    case "VERY_HIGH":
    case "HIGH":
      return "positive";
    case "MEDIUM":
      return "medium";
    case "LOW":
    case "VERY_LOW":
      return "negative";
  }
}

function qualitativeTone(
  level: string,
  kind: "value" | "risk" | "effort",
): StatusTone {
  const u = level.toUpperCase();
  if (u === "UNKNOWN") return "neutral";
  if (kind === "value") {
    if (u === "HIGH") return "positive";
    if (u === "MEDIUM") return "medium";
    return "negative";
  }
  if (u === "LOW") return "positive";
  if (u === "MEDIUM") return "medium";
  return "negative";
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BulletList({
  items,
  empty,
  keys,
}: {
  items: string[];
  empty: string;
  keys?: string[];
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted">
      {items.map((item, i) => (
        <li key={keys?.[i] ?? `${i}-${item.slice(0, 40)}`}>{item}</li>
      ))}
    </ul>
  );
}
