/**
 * Executive summary view — concise decision-first slice of canonical analysis.
 * Presentation only; never recalculates scores or requirements.
 */

import type { TenderActionPlanBundle } from "@/domain/tender-action-plan";
import { selectTopActions } from "@/domain/tender-action-plan/presentation";
import type { DecisionType } from "@/domain/types";
import type { Locale } from "@/i18n/config";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getDecisionLabel } from "@/lib/labels";
import {
  assertCanonicalReportIntegrity,
  deriveCanonicalReportSections,
  NOT_AVAILABLE,
  type CanonicalReportSections,
} from "@/services/reports/report-canonical-view";
import {
  buildReportDisplayContent,
  type ReportDisplayContent,
} from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

export const EXECUTIVE_SUMMARY_LIMITS = {
  maxReasons: 3,
  maxActions: 3,
  shortExplanationMax: 220,
  criticalItemMax: 160,
} as const;

export type ExecutiveSummaryView = {
  /** Null when analysis is incomplete / scoring blocked — never invent BID/REVIEW/NO_BID. */
  decision: DecisionType | null;
  decisionLabel: string;
  fitScoreDisplay: string;
  confidenceDisplay: string;
  shortExplanation: string;
  /** Specific critical items that must be visible (deadline, mandatory gaps, serious risks). */
  criticalAlerts: string[];
  /** Up to 3 concise reasons supporting the recommendation. */
  topReasons: string[];
  /** Up to 3 recommended next actions from canonical nextActions. */
  nextActions: string[];
  disclaimer: string;
};

type TenderDetailCopy = ReturnType<typeof getDictionary>["app"]["tenderDetail"];

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function firstSentence(text: string, maxLen: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed === NOT_AVAILABLE) return trimmed;
  const sentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
  const base = sentence && sentence.length >= 24 ? sentence : trimmed;
  return truncate(base, maxLen);
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (!line.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function isExpiredDeadline(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function collectCriticalAlerts(
  sections: CanonicalReportSections,
  content: ReportDisplayContent,
  keyBlockers: string[],
  copy: TenderDetailCopy,
): string[] {
  const alerts: string[] = [];

  if (isExpiredDeadline(sections.deadlineIso)) {
    alerts.push(copy.expiredDeadlineAlert);
  } else if (!sections.deadlineIso && sections.deadlineStatus === "CONFLICT") {
    alerts.push(sections.deadlineReason ?? "Bid submission deadline conflict — Verify.");
  } else if (
    !sections.deadlineIso &&
    (sections.deadlineStatus === "INCOMPLETE" || sections.deadlineStatus === "UNKNOWN")
  ) {
    alerts.push(
      sections.deadlineReason ??
        "Bid submission deadline unavailable in the tender package.",
    );
  }

  for (const row of sections.missingRequirements.filter((r) => r.mandatory)) {
    alerts.push(
      truncate(
        `${copy.mandatoryGapAlert}: ${row.requirement}`,
        EXECUTIVE_SUMMARY_LIMITS.criticalItemMax,
      ),
    );
  }

  for (const doc of sections.missingDocuments.filter(
    (d) => d.severity === "HIGH" || d.severity === "CRITICAL",
  )) {
    alerts.push(
      truncate(
        `${copy.missingDocumentAlert}: ${doc.documentName}`,
        EXECUTIVE_SUMMARY_LIMITS.criticalItemMax,
      ),
    );
  }

  for (const risk of sections.risks) {
    const severity =
      "severity" in risk ? risk.severity : (risk as { severity: string }).severity;
    if (severity !== "HIGH" && severity !== "CRITICAL") continue;
    const label =
      "title" in risk
        ? `${risk.severity}: ${risk.title}`
        : `[${risk.severity}] ${risk.description}`;
    alerts.push(truncate(label, EXECUTIVE_SUMMARY_LIMITS.criticalItemMax));
  }

  for (const blocker of keyBlockers) {
    alerts.push(truncate(blocker, EXECUTIVE_SUMMARY_LIMITS.criticalItemMax));
  }

  if (
    sections.complianceSummary &&
    sections.complianceSummary.missing > 0 &&
    alerts.length === 0
  ) {
    alerts.push(
      content.executiveComplianceLine ??
        `${sections.complianceSummary.missing} ${copy.mandatoryGapAlert.toLowerCase()}`,
    );
  }

  return uniqueLines(alerts).slice(0, 6);
}

function collectTopReasons(
  sections: CanonicalReportSections,
  content: ReportDisplayContent,
  keyBlockers: string[],
  criticalAlerts: string[],
): string[] {
  const criticalKeys = new Set(criticalAlerts.map((a) => a.toLowerCase()));
  const candidates: string[] = [];

  for (const b of keyBlockers) candidates.push(b);
  for (const d of content.bidScoreNegativeDrivers) candidates.push(d);
  for (const a of content.readinessAttentionLines) candidates.push(a);
  for (const line of content.riskLines.slice(0, 4)) {
    candidates.push(truncate(line, EXECUTIVE_SUMMARY_LIMITS.criticalItemMax));
  }
  for (const line of content.missingRequirementLines.slice(0, 3)) {
    candidates.push(truncate(line, EXECUTIVE_SUMMARY_LIMITS.criticalItemMax));
  }
  if (content.fitRecommendation) candidates.push(content.fitRecommendation);

  const reasons = uniqueLines(candidates).filter(
    (r) => !criticalKeys.has(r.toLowerCase()),
  );

  if (reasons.length === 0 && content.reasoning !== NOT_AVAILABLE) {
    reasons.push(
      firstSentence(
        content.reasoning,
        EXECUTIVE_SUMMARY_LIMITS.shortExplanationMax,
      ),
    );
  }

  return reasons.slice(0, EXECUTIVE_SUMMARY_LIMITS.maxReasons);
}

/** Build executive summary from canonical sections + display content. */
export function buildExecutiveSummaryView(
  sections: CanonicalReportSections,
  content: ReportDisplayContent,
  options?: {
    locale?: Locale;
    keyBlockers?: string[];
    actionPlan?: TenderActionPlanBundle | null;
  },
): ExecutiveSummaryView {
  const locale = options?.locale ?? content.locale ?? defaultLocale;
  const copy = getDictionary(locale).app.tenderDetail;
  const keyBlockers = options?.keyBlockers ?? [];

  if (sections.companyKnowledgeOnly) {
    throw new Error("Executive summary is not used for company-knowledge-only ingest");
  }

  const decision = sections.decision;
  const criticalAlerts = collectCriticalAlerts(
    sections,
    content,
    keyBlockers,
    copy,
  );
  const topReasons = collectTopReasons(
    sections,
    content,
    keyBlockers,
    criticalAlerts,
  );
  const nextActions = (() => {
    const planItems = options?.actionPlan?.computed
      ? selectTopActions(
          options.actionPlan.items.filter((i) => !i.simulationOnly),
          EXECUTIVE_SUMMARY_LIMITS.maxActions,
        )
      : [];
    if (planItems.length > 0) {
      return planItems.map((a) => a.title);
    }
    return sections.nextActions
      .slice(0, EXECUTIVE_SUMMARY_LIMITS.maxActions)
      .map((a) =>
        a.description
          ? `${a.title} — ${truncate(a.description, 80)}`
          : a.title,
      );
  })();

  return {
    decision,
    decisionLabel: content.decisionLabel,
    fitScoreDisplay: content.fitScoreDisplay,
    confidenceDisplay: content.confidenceDisplay,
    shortExplanation: firstSentence(
      content.reasoning,
      EXECUTIVE_SUMMARY_LIMITS.shortExplanationMax,
    ),
    criticalAlerts,
    topReasons,
    nextActions,
    disclaimer: copy.decisionDisclaimer,
  };
}

/** Derive executive summary from the same TenderReport used by PDF and full report. */
export function buildExecutiveSummaryFromReport(
  report: TenderReport,
  locale: Locale = defaultLocale,
  access?: import("@/services/reports/report-canonical-view").ReportFeatureAccess,
): ExecutiveSummaryView {
  const sections = deriveCanonicalReportSections(report, access);
  assertCanonicalReportIntegrity(sections);
  const content = buildReportDisplayContent(sections, locale);
  return buildExecutiveSummaryView(sections, content, {
    locale,
    keyBlockers: report.intelligence?.keyBlockers ?? [],
    actionPlan: sections.actionPlan,
  });
}

/** Ensure summary decision matches canonical sections (regression guard). */
export function assertExecutiveSummaryConsistency(
  sections: CanonicalReportSections,
  summary: ExecutiveSummaryView,
  locale: Locale = defaultLocale,
  actionPlan?: TenderActionPlanBundle | null,
): void {
  if (sections.companyKnowledgeOnly) {
    throw new Error("Executive summary consistency: not applicable to company-knowledge-only");
  }
  if (summary.decision !== sections.decision) {
    throw new Error(
      `Executive summary decision ${summary.decision} ≠ canonical ${sections.decision}`,
    );
  }
  if (sections.decision) {
    if (summary.decisionLabel !== getDecisionLabel(sections.decision, locale)) {
      throw new Error("Executive summary decision label diverges from canonical decision");
    }
  } else if (
    summary.decisionLabel !== "ANALYSIS INCOMPLETE" &&
    summary.decisionLabel !== NOT_AVAILABLE
  ) {
    throw new Error(
      `Executive summary incomplete label unexpected: ${summary.decisionLabel}`,
    );
  }
  if (summary.fitScoreDisplay !== sections.fitScoreDisplay) {
    throw new Error("Executive summary fit display diverges from canonical sections");
  }
  if (summary.confidenceDisplay !== sections.confidenceDisplay) {
    throw new Error("Executive summary confidence diverges from canonical sections");
  }
  for (const action of summary.nextActions) {
    const fromPlan = actionPlan?.items.some((a) =>
      action.startsWith(a.title.slice(0, 40)),
    );
    const fromLegacy = sections.nextActions.some((a) => action.startsWith(a.title));
    if (!fromPlan && !fromLegacy) {
      throw new Error(`Executive summary action not in canonical sources: ${action}`);
    }
  }
}
