/**
 * Team Decision Workflow — pure helpers.
 * Never invents responses/evidence. Never changes Decision Engine scores.
 */

import type {
  RiskSeverity,
  TeamWorkflowDepartment,
  TeamWorkflowTaskKind,
  TeamWorkflowTaskStatus,
} from "@prisma/client";

export type DisplayTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE"
  | "CANCELLED";

/** Effective status: OVERDUE when past deadline and not completed/cancelled. */
export function effectiveTaskStatus(input: {
  status: TeamWorkflowTaskStatus;
  deadline: Date | null;
  asOf?: Date;
}): DisplayTaskStatus {
  if (input.status === "COMPLETED" || input.status === "CANCELLED") {
    return input.status;
  }
  if (
    input.deadline &&
    !Number.isNaN(input.deadline.getTime()) &&
    input.deadline.getTime() < (input.asOf ?? new Date()).getTime()
  ) {
    return "OVERDUE";
  }
  if (input.status === "OVERDUE") return "OVERDUE";
  return input.status;
}

export function isOpenTaskStatus(status: DisplayTaskStatus): boolean {
  return (
    status === "PENDING" ||
    status === "IN_PROGRESS" ||
    status === "OVERDUE"
  );
}

export function isCriticalPriority(priority: RiskSeverity): boolean {
  return priority === "HIGH" || priority === "CRITICAL";
}

export function buildTaskDedupeKey(input: {
  companyId: string;
  tenderId: string;
  kind: TeamWorkflowTaskKind;
  sourceId: string;
}): string {
  return `${input.companyId}:${input.tenderId}:${input.kind}:${input.sourceId}`;
}

export function suggestDepartmentForKind(
  kind: TeamWorkflowTaskKind,
  categoryHint?: string | null,
): TeamWorkflowDepartment {
  const cat = (categoryHint ?? "").toLowerCase();
  if (kind === "MISSING_DOCUMENT") {
    if (/financ|bank|guarant|bond|turnover|revenue/.test(cat)) return "FINANCE";
    if (/legal|contract|liab/.test(cat)) return "LEGAL";
    if (/procure|supplier/.test(cat)) return "PROCUREMENT";
    return "MANAGEMENT";
  }
  if (kind === "RISK_MITIGATION") {
    if (/legal|compliance|gdpr|liab/.test(cat)) return "LEGAL";
    if (/financ|price|cost/.test(cat)) return "FINANCE";
    if (/tech|security|iso|cert/.test(cat)) return "TECHNICAL";
    return "MANAGEMENT";
  }
  if (kind === "REQUIREMENT_GAP" || kind === "EVIDENCE_REQUEST") {
    if (/financ|turnover|bank|guarant/.test(cat)) return "FINANCE";
    if (/legal|indemn/.test(cat)) return "LEGAL";
    if (/procure/.test(cat)) return "PROCUREMENT";
    return "TECHNICAL";
  }
  if (kind === "CLARIFICATION") return "MANAGEMENT";
  return "OTHER";
}

export type SeedTaskCandidate = {
  kind: TeamWorkflowTaskKind;
  title: string;
  description: string;
  requiredResponse: string;
  department: TeamWorkflowDepartment;
  priority: RiskSeverity;
  deadline: Date | null;
  dedupeKey: string;
  requirementId?: string | null;
  riskId?: string | null;
  missingDocId?: string | null;
  clarificationId?: string | null;
};

/**
 * Build seed candidates from real tender gaps only — never invents items.
 */
export function buildSeedTaskCandidates(input: {
  companyId: string;
  tenderId: string;
  tenderDeadline: Date | null;
  requirements: Array<{
    id: string;
    description: string;
    category: string;
    mandatory: boolean;
    status: string;
  }>;
  risks: Array<{
    id: string;
    description: string;
    category: string;
    severity: RiskSeverity;
    status: string;
  }>;
  missingDocs: Array<{
    id: string;
    documentName: string;
    reason: string;
    severity: RiskSeverity;
    status: string;
  }>;
  clarifications?: Array<{
    id: string;
    question: string;
    reason: string;
    category: string;
    priority: string;
  }>;
}): SeedTaskCandidate[] {
  const out: SeedTaskCandidate[] = [];
  const defaultDeadline = input.tenderDeadline;

  for (const r of input.requirements) {
    if (!r.mandatory) continue;
    if (r.status !== "MISSING" && r.status !== "UNCERTAIN" && r.status !== "FAILED") {
      continue;
    }
    const kind: TeamWorkflowTaskKind =
      r.status === "FAILED" ? "REQUIREMENT_GAP" : "EVIDENCE_REQUEST";
    out.push({
      kind,
      title: `Verify requirement: ${r.description.slice(0, 120)}`,
      description: `Mandatory requirement status is ${r.status}. Category: ${r.category}. Provide verified evidence or a clear blocker note — do not invent facts.`,
      requiredResponse:
        "Confirm company capability with evidence, or document why this cannot be met.",
      department: suggestDepartmentForKind(kind, r.category + " " + r.description),
      priority: r.status === "FAILED" ? "CRITICAL" : "HIGH",
      deadline: defaultDeadline,
      dedupeKey: buildTaskDedupeKey({
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind,
        sourceId: r.id,
      }),
      requirementId: r.id,
    });
  }

  for (const risk of input.risks) {
    if (risk.status !== "OPEN") continue;
    if (risk.severity !== "HIGH" && risk.severity !== "CRITICAL") continue;
    out.push({
      kind: "RISK_MITIGATION",
      title: `Mitigate risk: ${risk.description.slice(0, 120)}`,
      description: `Open ${risk.severity} risk (${risk.category}). Provide mitigation plan or acceptance rationale with evidence.`,
      requiredResponse: "Mitigation steps, owner, and supporting evidence (or formal acceptance).",
      department: suggestDepartmentForKind("RISK_MITIGATION", risk.category),
      priority: risk.severity,
      deadline: defaultDeadline,
      dedupeKey: buildTaskDedupeKey({
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind: "RISK_MITIGATION",
        sourceId: risk.id,
      }),
      riskId: risk.id,
    });
  }

  for (const doc of input.missingDocs) {
    if (doc.status !== "OPEN") continue;
    out.push({
      kind: "MISSING_DOCUMENT",
      title: `Provide document: ${doc.documentName.slice(0, 120)}`,
      description: doc.reason,
      requiredResponse: "Upload or confirm the document, or explain why it is unavailable.",
      department: suggestDepartmentForKind(
        "MISSING_DOCUMENT",
        doc.documentName + " " + doc.reason,
      ),
      priority: doc.severity,
      deadline: defaultDeadline,
      dedupeKey: buildTaskDedupeKey({
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind: "MISSING_DOCUMENT",
        sourceId: doc.id,
      }),
      missingDocId: doc.id,
    });
  }

  for (const q of input.clarifications ?? []) {
    const p = (q.priority ?? "").toUpperCase();
    if (p !== "HIGH" && p !== "CRITICAL" && p !== "MUST") continue;
    out.push({
      kind: "CLARIFICATION",
      title: `Clarify: ${q.question.slice(0, 120)}`,
      description: q.reason,
      requiredResponse: "Answer with verified facts from company or tender sources only.",
      department: suggestDepartmentForKind("CLARIFICATION", q.category),
      priority: "HIGH",
      deadline: defaultDeadline,
      dedupeKey: buildTaskDedupeKey({
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind: "CLARIFICATION",
        sourceId: q.id,
      }),
      clarificationId: q.id,
    });
  }

  return out;
}

/** Summary for Decision Engine finalize — reference only, never changes scores. */
export function summarizeUnresolvedCriticalTasks(
  tasks: Array<{
    status: TeamWorkflowTaskStatus;
    deadline: Date | null;
    priority: RiskSeverity;
    title: string;
  }>,
  asOf = new Date(),
): {
  openCriticalCount: number;
  openCount: number;
  titles: string[];
  note: string | null;
} {
  const open = tasks.filter((t) =>
    isOpenTaskStatus(effectiveTaskStatus(t)),
  );
  const critical = open.filter((t) => isCriticalPriority(t.priority));
  if (critical.length === 0) {
    return {
      openCriticalCount: 0,
      openCount: open.length,
      titles: [],
      note:
        open.length > 0
          ? `${open.length} open team workflow task(s) remain (none critical). Team input is evidence only — Decision Engine rules still apply.`
          : null,
    };
  }
  const titles = critical.map((t) => t.title).slice(0, 5);
  return {
    openCriticalCount: critical.length,
    openCount: open.length,
    titles,
    note: `${critical.length} unresolved critical team task(s) before final decision. Team responses are evidence/context only and do not automatically change GO / CONDITIONAL GO / NO-BID without Decision Engine rules. As of ${asOf.toISOString()}.`,
  };
}

export {
  buildClosedLoopHash,
  buildVerifiedRequirementEvidenceText,
  canVerifyTeamEvidence,
  defaultAppliedRequirementStatus,
  isVerifiedEvidence,
  meaningfulDecisionChange,
  requiresVerificationBeforeComplete,
} from "./closed-loop";

export function canAssignTeamTasks(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

export function canRespondToTeamTask(input: {
  role: string;
  userId: string;
  assigneeUserId: string | null;
}): boolean {
  if (input.role === "VIEWER") return false;
  if (input.role === "OWNER" || input.role === "ADMIN") return true;
  if (!input.assigneeUserId) return input.role === "MEMBER";
  return input.assigneeUserId === input.userId;
}
