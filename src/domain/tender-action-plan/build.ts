/**
 * Build Tender Action Plan from canonical tender state only.
 * Never fabricates actions — every item maps to an unresolved source.
 */

import type { EvidenceIntelligenceState } from "@/domain/evidence-intelligence";
import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import {
  buildActionPlanContentHash,
  buildActionStableId,
  mergeActionPlanItems,
  sortActions,
} from "./dedupe";
import { deriveRequirementActionTitle } from "./action-title";
import {
  collapsePrimaryActionsPerRequirement,
  dedupeByCanonicalActionIdentity,
  isGenericVerificationText,
} from "./canonical-dedupe";
import {
  daysUntilDeadline,
  deriveActionStatus,
  mapTeamTaskToOwner,
  priorityFromSignals,
  teamTaskByRequirement,
  teamTaskByRisk,
  isOpenTeamStatus,
} from "./states";
import type {
  BuildTenderActionPlanInput,
  TenderActionCategory,
  TenderActionItem,
  TenderActionPlanBundle,
  TenderActionSourceType,
  TenderActionStatus,
} from "./types";
import {
  AFTER_COMPLETION_STANDARD,
  TENDER_ACTION_PLAN_DISCLAIMER,
} from "./types";

function formatSourceTrace(input: {
  requirement?: string | null;
  document?: string | null;
  page?: number | null;
  section?: string | null;
  riskTitle?: string | null;
}): string {
  const parts: string[] = [];
  if (input.requirement) parts.push(`Requirement: ${input.requirement}`);
  if (input.riskTitle) parts.push(`Risk: ${input.riskTitle}`);
  if (input.document) {
    let loc = input.document;
    if (input.page != null) loc += ` → Page ${input.page}`;
    if (input.section) loc += ` → ${input.section}`;
    parts.push(`Source: ${loc}`);
  }
  return parts.join(" · ") || "Source trace unavailable";
}

function categoryForSource(sourceType: TenderActionSourceType): TenderActionCategory {
  switch (sourceType) {
    case "MISSING_MANDATORY_REQUIREMENT":
      return "REQUIREMENT";
    case "MISSING_EVIDENCE":
    case "EXPIRED_EVIDENCE":
      return "EVIDENCE";
    case "UNVERIFIED_EVIDENCE":
    case "FAILED_VERIFICATION":
      return "VERIFICATION";
    case "UNRESOLVED_RISK":
      return "RISK";
    case "READINESS_BLOCKER":
      return "READINESS";
    case "COMPANY_FIT_GAP":
      return "COMPANY_FIT";
    case "TEAM_VERIFICATION_TASK":
      return "TEAM";
    case "APPROACHING_DEADLINE":
      return "DEADLINE";
    case "DECISION_BLOCKER":
      return "DECISION";
    case "DECISION_SIMULATOR":
      return "SIMULATION";
    default:
      return "REQUIREMENT";
  }
}

function evidenceSourceType(state: EvidenceIntelligenceState): TenderActionSourceType | null {
  switch (state) {
    case "MISSING":
      return "MISSING_EVIDENCE";
    case "FOUND_UNVERIFIED":
      return "UNVERIFIED_EVIDENCE";
    case "EXPIRED":
      return "EXPIRED_EVIDENCE";
    case "INVALID":
      return "FAILED_VERIFICATION";
    case "VERIFIED":
    case "UNKNOWN":
      return null;
    default:
      return null;
  }
}

function createAction(
  input: BuildTenderActionPlanInput,
  partial: Omit<
    TenderActionItem,
    | "id"
    | "category"
    | "createdAt"
    | "updatedAt"
    | "simulationOnly"
    | "afterCompletion"
    | "requirementText"
  > & {
    simulationOnly?: boolean;
    afterCompletion?: string;
    requirementText?: string | null;
  },
): TenderActionItem {
  const asOf = input.asOf ?? new Date();
  const sourceType = partial.sourceType;
  return {
    ...partial,
    requirementText: partial.requirementText ?? null,
    id: buildActionStableId({
      tenderId: input.tenderId,
      sourceType,
      sourceId: partial.sourceId,
    }),
    category: categoryForSource(sourceType),
    simulationOnly: partial.simulationOnly ?? false,
    afterCompletion: partial.afterCompletion ?? AFTER_COMPLETION_STANDARD,
    createdAt: asOf.toISOString(),
    updatedAt: asOf.toISOString(),
  };
}

function shouldSkipResolvedStatus(status: TenderActionStatus | ReadinessStatus): boolean {
  return status === "READY" || status === "NOT_APPLICABLE";
}

function isVerificationOnlyRow(input: {
  status?: ReadinessStatus | null;
  evidenceState?: string | null;
  verificationStatus?: string | null;
}): boolean {
  if (input.evidenceState === "CONFIRMED_NON_COMPLIANT" || input.evidenceState === "MISSING") {
    return false;
  }
  if (input.status === "MISSING") return false;
  if (input.status === "VERIFY") return true;
  if (input.verificationStatus === "NEEDS_VERIFICATION") return true;
  if (input.evidenceState === "NEEDS_VERIFICATION" || input.evidenceState === "FOUND_UNVERIFIED") {
    return true;
  }
  return false;
}

function isConfirmedGapRow(input: {
  status?: ReadinessStatus | null;
  evidenceState?: string | null;
}): boolean {
  return (
    input.evidenceState === "CONFIRMED_NON_COMPLIANT"
  );
}

function generateRawActions(input: BuildTenderActionPlanInput): TenderActionItem[] {
  const asOf = input.asOf ?? new Date();
  const daysRemaining = daysUntilDeadline(input.tenderDeadline, asOf);
  const deadlineIso =
    input.tenderDeadline && !Number.isNaN(input.tenderDeadline.getTime())
      ? input.tenderDeadline.toISOString()
      : null;

  const tasksByReq = teamTaskByRequirement(input.teamTasks);
  const tasksByRisk = teamTaskByRisk(input.teamTasks);
  const linkedTeamTaskIds = new Set<string>();
  const out: TenderActionItem[] = [];
  const coveredRequirements = new Set<string>();

  // —— Evidence intelligence rows ——
  for (const row of input.evidenceIntelligence?.rows ?? []) {
    const sourceType = evidenceSourceType(row.evidenceState);
    if (!sourceType) continue;
    if (shouldSkipResolvedStatus(row.readinessImpact)) continue;

    const teamTask = row.teamTaskId
      ? input.teamTasks.find((t) => t.id === row.teamTaskId) ?? tasksByReq.get(row.requirementId) ?? null
      : tasksByReq.get(row.requirementId) ?? null;

    const status = deriveActionStatus({
      sourceType,
      readinessStatus: row.readinessImpact,
      evidenceState: row.evidenceState,
      teamTask,
    });
    if (status === "COMPLETED") continue;

    const derived = deriveRequirementActionTitle({
      requirementText: row.requirement,
      requirementType: row.requirementType,
      sourceType,
    });
    const title = derived.title;

    const verifyOnly = isVerificationOnlyRow({
      status: row.readinessImpact,
      evidenceState: row.evidenceState,
    });
    const confirmedGap = isConfirmedGapRow({
      status: row.readinessImpact,
      evidenceState: row.evidenceState,
    });

    out.push(
      createAction(input, {
        title,
        description: row.requirement,
        requirementText: row.requirement,
        sourceType,
        sourceId: `${row.requirementId}:${sourceType}`,
        priority: priorityFromSignals({
          mandatory: row.mandatory,
          readinessStatus: row.readinessImpact,
          evidenceState: row.evidenceState,
          blocking: confirmedGap && row.mandatory,
          daysRemaining,
        }),
        linkedRequirementId: row.requirementId,
        linkedEvidenceId: row.evidence?.evidenceId ?? null,
        linkedRiskId: null,
        linkedTeamTaskId: teamTask?.id ?? row.teamTaskId,
        ownerLabel: row.evidence?.ownerLabel ?? mapTeamTaskToOwner(teamTask),
        dueDate: deadlineIso,
        status,
        blocking: confirmedGap && row.mandatory && !verifyOnly,
        expectedOutcome: derived.expectedOutcome,
        verificationRequired: sourceType !== "MISSING_EVIDENCE",
        whyNeeded: row.mandatory
          ? verifyOnly
            ? `Mandatory requirement evidence needs verification (${row.evidenceState.replace(/_/g, " ").toLowerCase()}).`
            : `Mandatory requirement evidence is ${row.evidenceState.replace(/_/g, " ").toLowerCase()}.`
          : `Requirement evidence is ${row.evidenceState.replace(/_/g, " ").toLowerCase()}.`,
        sourceTrace: formatSourceTrace({
          requirement: row.requirement,
          document: row.sourceBasis === "DIRECT_SOURCE" ? row.locationLabel : null,
          page: row.evidence?.pageNumber,
          section: row.evidence?.section,
        }),
      }),
    );
    coveredRequirements.add(row.requirementId);
    if (teamTask) linkedTeamTaskIds.add(teamTask.id);
  }

  // —— Compliance matrix mandatory gaps with requiredAction ——
  for (const row of input.complianceMatrix) {
    if (!row.requiredAction?.trim()) continue;
    if (shouldSkipResolvedStatus(row.status)) continue;
    if (coveredRequirements.has(row.requirementId)) continue;

    const teamTask = tasksByReq.get(row.requirementId) ?? null;
    const status = deriveActionStatus({
      sourceType: "MISSING_MANDATORY_REQUIREMENT",
      readinessStatus: row.status,
      evidenceState: undefined,
      teamTask,
      requirementResolved: row.status === "READY" || row.status === "NOT_APPLICABLE",
    });
    if (status === "COMPLETED") continue;

    const sourceType: TenderActionSourceType =
      row.mandatory && (row.status === "MISSING" || row.status === "UNKNOWN")
        ? "MISSING_MANDATORY_REQUIREMENT"
        : "READINESS_BLOCKER";

    const confirmedGap = isConfirmedGapRow({
      status: row.status,
      evidenceState: row.evidenceState ?? null,
    });

    const derived = deriveRequirementActionTitle({
      requirementText: row.requirement,
      requirementType: row.requirementType,
      requiredAction: row.requiredAction,
      sourceType,
    });

    out.push(
      createAction(input, {
        title: derived.title,
        description: row.requirement,
        requirementText: row.requirement,
        sourceType,
        sourceId: `req:${row.requirementId}`,
        priority: priorityFromSignals({
          mandatory: row.mandatory,
          readinessStatus: row.status,
          blocking: confirmedGap && row.mandatory,
          daysRemaining,
        }),
        linkedRequirementId: row.requirementId,
        linkedEvidenceId: row.evidenceId ?? null,
        linkedRiskId: null,
        linkedTeamTaskId: teamTask?.id ?? null,
        ownerLabel: mapTeamTaskToOwner(teamTask),
        dueDate: deadlineIso,
        status,
        blocking: confirmedGap && row.mandatory,
        expectedOutcome: derived.expectedOutcome,
        verificationRequired: row.status === "VERIFY" || row.verificationStatus === "NEEDS_VERIFICATION",
        whyNeeded: row.requiredAction || (row.mandatory
          ? `Mandatory requirement is currently ${row.status}.`
          : `Requirement needs attention (${row.status}).`),
        sourceTrace: formatSourceTrace({
          requirement: row.requirement,
          document: row.sourceDocument,
          page: row.pageNumber,
          section: row.section,
        }),
      }),
    );
    coveredRequirements.add(row.requirementId);
    if (teamTask) linkedTeamTaskIds.add(teamTask.id);
  }

  // —— Structured risks ——
  for (const risk of input.risks) {
    if (!risk.recommendedAction?.trim()) continue;
    const sev = risk.severityCanonical ?? risk.severity;
    if (sev !== "CRITICAL" && sev !== "HIGH" && sev !== "MEDIUM") continue;
    if (risk.fitStatus === "NEEDS_VERIFICATION" || risk.fitStatus === "NOT_APPLICABLE") {
      continue;
    }
    if (
      risk.evidenceState === "NEEDS_VERIFICATION" ||
      isGenericVerificationText(risk.recommendedAction)
    ) {
      continue;
    }
    if (risk.requirementId && coveredRequirements.has(risk.requirementId)) continue;

    const teamTask = risk.requirementId
      ? tasksByReq.get(risk.requirementId) ?? tasksByRisk.get(risk.id) ?? null
      : tasksByRisk.get(risk.id) ?? null;

    out.push(
      createAction(input, {
        title: risk.recommendedAction,
        description: risk.explanation || risk.whyRisky || risk.recommendedAction,
        requirementText: risk.requirementId
          ? input.complianceMatrix.find((r) => r.requirementId === risk.requirementId)?.requirement ??
            null
          : null,
        sourceType: "UNRESOLVED_RISK",
        sourceId: `risk:${risk.id}`,
        priority: priorityFromSignals({
          severity: sev === "HIGH" ? "HIGH" : sev,
          blocking: sev === "CRITICAL" || sev === "HIGH",
          daysRemaining,
        }),
        linkedRequirementId: risk.requirementId ?? null,
        linkedEvidenceId: null,
        linkedRiskId: risk.id,
        linkedTeamTaskId: teamTask?.id ?? null,
        ownerLabel: mapTeamTaskToOwner(teamTask),
        dueDate: deadlineIso,
        status: deriveActionStatus({
          sourceType: "UNRESOLVED_RISK",
          teamTask,
        }),
        blocking: sev === "CRITICAL" || sev === "HIGH",
        expectedOutcome: "Risk mitigated or formally accepted with documented evidence.",
        verificationRequired: true,
        whyNeeded: `${sev} risk: ${risk.title}`,
        sourceTrace: formatSourceTrace({
          riskTitle: risk.title,
          document: risk.source.document,
          page: risk.source.page,
          section: risk.source.section,
        }),
      }),
    );
    if (teamTask) linkedTeamTaskIds.add(teamTask.id);
  }

  // —— Key blockers (confirmed hard blockers only) ——
  for (let i = 0; i < input.keyBlockers.length; i++) {
    const blocker = input.keyBlockers[i]!.trim();
    if (!blocker) continue;
    out.push(
      createAction(input, {
        title: blocker.length <= 110 ? blocker : `${blocker.slice(0, 109).trim()}…`,
        description: blocker,
        sourceType: "READINESS_BLOCKER",
        sourceId: `blocker:${i}:${blocker.slice(0, 40)}`,
        priority: priorityFromSignals({ blocking: true, daysRemaining }),
        linkedRequirementId: null,
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: "Management",
        dueDate: deadlineIso,
        status: "OPEN",
        blocking: true,
        expectedOutcome: "Blocker removed from readiness and compliance assessment.",
        verificationRequired: true,
        whyNeeded: "Listed as a key blocker in tender intelligence.",
        sourceTrace: `Key blocker: ${blocker}`,
      }),
    );
  }

  // —— Readiness attention items ——
  for (let i = 0; i < input.readiness.attention.length; i++) {
    const note = input.readiness.attention[i]!.trim();
    if (!note) continue;
    if (
      /^\d+\s+mandatory requirements? could not be verified/i.test(note) &&
      out.some((a) => a.linkedRequirementId)
    ) {
      continue;
    }
    const alreadyCovered = out.some(
      (a) => a.title.includes(note.slice(0, 40)) || a.description.includes(note.slice(0, 40)),
    );
    if (alreadyCovered) continue;

    out.push(
      createAction(input, {
        title: note.length <= 110 ? note : `${note.slice(0, 109).trim()}…`,
        description: note,
        sourceType: "READINESS_BLOCKER",
        sourceId: `readiness-attention:${i}:${note.slice(0, 30)}`,
        priority: priorityFromSignals({ blocking: false, daysRemaining }),
        linkedRequirementId: null,
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: "Technical / Management",
        dueDate: deadlineIso,
        status: "OPEN",
        blocking: false,
        expectedOutcome: "Readiness gap addressed with verified evidence.",
        verificationRequired: true,
        whyNeeded: "Flagged in readiness attention list.",
        sourceTrace: `Readiness: ${note}`,
      }),
    );
  }

  // —— Company fit gaps ——
  for (let i = 0; i < (input.fitBreakdown?.gaps ?? []).length; i++) {
    const gap = input.fitBreakdown!.gaps[i]!.trim();
    if (!gap) continue;
    out.push(
      createAction(input, {
        title: gap.length <= 110 ? gap : `${gap.slice(0, 109).trim()}…`,
        description: gap,
        sourceType: "COMPANY_FIT_GAP",
        sourceId: `fit-gap:${i}:${gap.slice(0, 30)}`,
        priority: "MEDIUM",
        linkedRequirementId: null,
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: "Management",
        dueDate: deadlineIso,
        status: "OPEN",
        blocking: false,
        expectedOutcome: "Gap closed with profile evidence or documented mitigation.",
        verificationRequired: true,
        whyNeeded: "Company fit analysis identified a capability or profile gap.",
        sourceTrace: `Company fit gap: ${gap}`,
      }),
    );
  }

  // —— Decision critical blockers ——
  for (let i = 0; i < (input.recommendation?.criticalBlockers ?? []).length; i++) {
    const blocker = input.recommendation!.criticalBlockers[i]!.trim();
    if (!blocker) continue;
    const dup = out.some((a) => a.title.includes(blocker.slice(0, 40)));
    if (dup) continue;

    out.push(
      createAction(input, {
        title: blocker.length <= 110 ? blocker : `${blocker.slice(0, 109).trim()}…`,
        description: blocker,
        sourceType: "DECISION_BLOCKER",
        sourceId: `decision-blocker:${i}:${blocker.slice(0, 30)}`,
        priority: "CRITICAL",
        linkedRequirementId: null,
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: "Management",
        dueDate: deadlineIso,
        status: "OPEN",
        blocking: true,
        expectedOutcome: "Blocker resolved; Decision Engine re-evaluates on next analysis.",
        verificationRequired: true,
        whyNeeded: `Critical blocker in ${input.recommendation!.displayLabel} recommendation.`,
        sourceTrace: `Decision Engine: ${blocker}`,
      }),
    );
  }

  // —— Open team tasks not already linked ——
  for (const task of input.teamTasks) {
    if (!isOpenTeamStatus(task.status)) continue;
    if (linkedTeamTaskIds.has(task.id)) continue;

    out.push(
      createAction(input, {
        title: task.title,
        description: `Open team workflow task (${task.status}). Complete verification through the Team Decision Workflow.`,
        requirementText: task.requirementId
          ? input.complianceMatrix.find((r) => r.requirementId === task.requirementId)?.requirement ??
            null
          : null,
        sourceType: "TEAM_VERIFICATION_TASK",
        sourceId: `team:${task.id}`,
        priority: priorityFromSignals({
          severity:
            task.priority === "CRITICAL"
              ? "CRITICAL"
              : task.priority === "HIGH"
                ? "HIGH"
                : "MEDIUM",
          daysRemaining,
        }),
        linkedRequirementId: task.requirementId,
        linkedEvidenceId: null,
        linkedRiskId: task.riskId ?? null,
        linkedTeamTaskId: task.id,
        ownerLabel: mapTeamTaskToOwner(task),
        dueDate: deadlineIso,
        status: deriveActionStatus({
          sourceType: "TEAM_VERIFICATION_TASK",
          readinessStatus: undefined,
          evidenceState: undefined,
          teamTask: task,
        }),
        blocking: task.priority === "CRITICAL" || task.priority === "HIGH",
        expectedOutcome: "Team task completed with verified evidence.",
        verificationRequired: true,
        whyNeeded: "Open team verification task.",
        sourceTrace: `Team workflow task: ${task.title}`,
      }),
    );
  }

  // —— Approaching deadline (only when real deadline + open blocking items) ——
  const openBlocking = out.filter(
    (a) => a.blocking && a.status !== "COMPLETED" && a.status !== "CANCELLED" && !a.simulationOnly,
  );
  if (
    daysRemaining != null &&
    daysRemaining >= 0 &&
    daysRemaining <= 14 &&
    openBlocking.length > 0
  ) {
    out.push(
      createAction(input, {
        title: `Prioritize ${openBlocking.length} blocking item(s) before tender deadline`,
        description: `${openBlocking.length} blocking action(s) remain with ${daysRemaining} day(s) until the tender deadline.`,
        sourceType: "APPROACHING_DEADLINE",
        sourceId: `deadline:${deadlineIso ?? "unknown"}`,
        priority: daysRemaining <= 7 ? "CRITICAL" : "HIGH",
        linkedRequirementId: null,
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: "Management",
        dueDate: deadlineIso,
        status: "OPEN",
        blocking: true,
        expectedOutcome: "Blocking gaps addressed before submission deadline.",
        verificationRequired: false,
        whyNeeded: `Tender deadline in ${daysRemaining} day(s) with unresolved blockers.`,
        sourceTrace: deadlineIso ? `Tender deadline: ${deadlineIso}` : "Tender deadline unknown",
      }),
    );
  }

  // —— Decision Simulator hints (SIMULATION ONLY) ——
  for (const hint of input.simulationHints ?? []) {
    out.push(
      createAction(input, {
        title: `[SIMULATION ONLY] ${hint.label}`,
        description: `Hypothetical: if resolved, decision may move from ${hint.currentDecisionLabel} to ${hint.projectedDecisionLabel}. This is not the actual decision.`,
        sourceType: "DECISION_SIMULATOR",
        sourceId: `sim:${hint.id}`,
        priority: "LOW",
        linkedRequirementId: hint.requirementId ?? null,
        linkedEvidenceId: hint.evidenceId ?? null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: null,
        dueDate: null,
        status: "OPEN",
        blocking: false,
        expectedOutcome: `Projected ${hint.projectedDecisionLabel} in simulation only.`,
        verificationRequired: false,
        whyNeeded: "Decision Simulator identified a hypothetical improvement path.",
        sourceTrace: `Simulation: ${hint.currentDecisionLabel} → ${hint.projectedDecisionLabel}`,
        simulationOnly: true,
        afterCompletion:
          "Simulation only — real change requires evidence submission, verification, and canonical re-analysis.",
      }),
    );
  }

  return sortActions(
    dedupeByCanonicalActionIdentity(collapsePrimaryActionsPerRequirement(out)),
  );
}

function buildSummary(items: TenderActionItem[]): TenderActionPlanBundle["summary"] {
  const byCategory: Partial<Record<TenderActionCategory, number>> = {};
  let open = 0;
  let critical = 0;
  let blocking = 0;
  let simulationOnly = 0;

  for (const item of items) {
    if (item.status !== "COMPLETED" && item.status !== "CANCELLED") open++;
    if (item.priority === "CRITICAL") critical++;
    if (item.blocking) blocking++;
    if (item.simulationOnly) simulationOnly++;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return {
    total: items.length,
    open,
    critical,
    blocking,
    simulationOnly,
    byCategory,
  };
}

export function buildTenderActionPlan(input: BuildTenderActionPlanInput): TenderActionPlanBundle {
  const asOf = input.asOf ?? new Date();
  const generated = generateRawActions(input);
  const items = input.previousPlan?.items?.length
    ? mergeActionPlanItems({
        tenderId: input.tenderId,
        generated,
        previous: input.previousPlan.items,
        asOf,
      })
    : generated;

  const daysRemaining = daysUntilDeadline(input.tenderDeadline, asOf);
  const deadlineIso =
    input.tenderDeadline && !Number.isNaN(input.tenderDeadline.getTime())
      ? input.tenderDeadline.toISOString()
      : null;

  let urgencyNote: string | null = null;
  if (daysRemaining == null) {
    urgencyNote = null;
  } else if (daysRemaining < 0) {
    urgencyNote = "Tender deadline has passed.";
  } else if (daysRemaining <= 7) {
    urgencyNote = `Deadline in ${daysRemaining} day(s) — prioritize blocking actions.`;
  } else if (daysRemaining <= 14) {
    urgencyNote = `Deadline in ${daysRemaining} day(s).`;
  }

  return {
    computed: true,
    items,
    summary: buildSummary(items),
    deadlineUrgency: {
      tenderDeadline: deadlineIso,
      daysRemaining,
      urgencyNote,
    },
    disclaimer: TENDER_ACTION_PLAN_DISCLAIMER,
    contentHash: buildActionPlanContentHash(items),
  };
}

export type { BuildTenderActionPlanInput };
