/**
 * Closed-loop re-analysis after VERIFIED team evidence.
 * Updates canonical requirements → readiness → Decision Engine → Memory → Alerts.
 * Never invents evidence; never auto-verifies; never creates a second scoring system.
 */

import { buildBidScoreFromAnalysis } from "@/domain/bid-score";
import { isProfileSparse } from "@/domain/decision/company-fit";
import { runDecisionEngine } from "@/domain/decision/engine";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { toRuleProfile } from "@/domain/decision/types";
import {
  buildClosedLoopHash,
  buildVerifiedRequirementEvidenceText,
  canVerifyTeamEvidence,
  defaultAppliedRequirementStatus,
  meaningfulDecisionChange,
} from "@/domain/team-workflow/closed-loop";
import { buildTenderIntelligence } from "@/domain/tender-intelligence/build";
import { readCanonicalDeadlineIso } from "@/domain/tender-requirements";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { logInfo, trackEvent } from "@/services/observability";
import type { RequirementMatchStatus, UserRole } from "@prisma/client";

async function assertTeamFeature(companyId: string) {
  const { hasFeature } = await import("@/services/entitlements");
  await prisma.feature.upsert({
    where: { key: "team_collaboration" },
    create: {
      key: "team_collaboration",
      name: "Team Collaboration",
      enabledGlobal: true,
    },
    update: {},
  });
  const ok = await hasFeature(companyId, "team_collaboration");
  if (!ok) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Team collaboration is not enabled for this workspace.",
      403,
    );
  }
}

export async function verifyTeamWorkflowEvidence(input: {
  companyId: string;
  userId: string;
  role: UserRole;
  taskId: string;
  verdict: "VERIFIED" | "REJECTED";
  verificationNote?: string | null;
  /** Only applied when VERIFIED and a requirement is linked */
  appliedRequirementStatus?: RequirementMatchStatus | null;
}) {
  await assertTeamFeature(input.companyId);
  if (!canVerifyTeamEvidence(input.role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Only OWNER or ADMIN may verify team evidence.",
      403,
    );
  }

  const task = await prisma.teamWorkflowTask.findFirst({
    where: { id: input.taskId, companyId: input.companyId },
    include: {
      attachments: { select: { fileName: true, checksumSha256: true } },
      requirement: { select: { id: true, status: true, description: true } },
      assigneeUser: { select: { id: true, name: true, email: true } },
      tender: { select: { id: true, title: true } },
    },
  });
  if (!task) throw new AppError(ErrorCode.NOT_FOUND, "Task not found.", 404);

  if (!task.responseText?.trim()) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Cannot verify without a team response — never invent a response.",
      400,
    );
  }
  if (
    task.verificationStatus === "VERIFIED" &&
    input.verdict === "VERIFIED" &&
    task.closedLoopHash
  ) {
    return {
      taskId: task.id,
      verificationStatus: "VERIFIED" as const,
      closedLoop: { skipped: true, reason: "already_verified" as const },
    };
  }
  if (task.status === "CANCELLED") {
    throw new AppError(ErrorCode.CONFLICT, "Task is cancelled.", 409);
  }

  const note = input.verificationNote?.trim() || null;

  if (input.verdict === "REJECTED") {
    const updated = await prisma.teamWorkflowTask.update({
      where: { id: task.id },
      data: {
        verificationStatus: "REJECTED",
        verifiedAt: new Date(),
        verifiedById: input.userId,
        verificationNote: note,
        status: "IN_PROGRESS",
        completedAt: null,
        completedById: null,
        closedLoopHash: null,
        appliedRequirementStatus: null,
      },
    });

    await prisma.teamWorkflowEvent.create({
      data: {
        companyId: input.companyId,
        taskId: task.id,
        actorUserId: input.userId,
        eventType: "REJECTED",
        fromStatus: task.status,
        toStatus: "IN_PROGRESS",
        message:
          note ?? "Evidence rejected — requirement and decision unchanged",
        metadata: { verdict: "REJECTED" },
      },
    });

    await trackEvent({
      action: "TEAM_TASK_REJECTED",
      companyId: input.companyId,
      userId: input.userId,
      metadata: { taskId: task.id, tenderId: task.tenderId },
    });

    if (task.requirementId) {
      const { recordVerificationAudit } = await import(
        "@/services/evidence-verification"
      );
      await recordVerificationAudit({
        companyId: input.companyId,
        tenderId: task.tenderId,
        requirementId: task.requirementId,
        userId: input.userId,
        action: "VERIFICATION_REJECTED",
        snapshot: { taskId: task.id, note },
      });
    }

    const { notifyWorkflowStakeholders } = await import(
      "@/services/team-workflow/alerts"
    );
    await notifyWorkflowStakeholders({
      companyId: input.companyId,
      tenderId: task.tenderId,
      tenderTitle: task.tender?.title ?? "Tender",
      kind: "EVIDENCE_REJECTED",
      taskId: task.id,
      taskTitle: task.title,
      targetUserId: task.assigneeUserId,
      message: `Evidence for "${task.title}" was rejected. ${note ?? "Please revise and resubmit."}`,
    });

    return {
      taskId: updated.id,
      verificationStatus: "REJECTED" as const,
      closedLoop: { skipped: true, reason: "rejected" as const },
    };
  }

  const appliedStatus =
    input.appliedRequirementStatus ??
    defaultAppliedRequirementStatus({
      kind: task.kind,
      currentStatus: task.requirement?.status ?? null,
      verdict: "VERIFIED",
    });

  const closedLoopHash = buildClosedLoopHash({
    taskId: task.id,
    responseText: task.responseText,
    evidenceNote: task.evidenceNote,
    appliedRequirementStatus: appliedStatus,
    attachmentChecksums: task.attachments
      .map((a) => a.checksumSha256)
      .filter((c): c is string => Boolean(c)),
  });

  if (
    task.closedLoopHash === closedLoopHash &&
    task.verificationStatus === "VERIFIED"
  ) {
    return {
      taskId: task.id,
      verificationStatus: "VERIFIED" as const,
      closedLoop: { skipped: true, reason: "noop_same_hash" as const },
    };
  }

  const verifiedAt = new Date();
  const evidenceText = buildVerifiedRequirementEvidenceText({
    responseText: task.responseText,
    evidenceNote: task.evidenceNote,
    taskId: task.id,
    verifiedById: input.userId,
    verifiedAt,
    attachmentNames: task.attachments.map((a) => a.fileName),
  });

  let evidenceId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (task.requirementId && appliedStatus) {
      const existing = await tx.tenderRequirement.findFirst({
        where: { id: task.requirementId, tenderId: task.tenderId },
      });
      if (!existing) {
        throw new AppError(
          ErrorCode.NOT_FOUND,
          "Linked requirement not found for this tender.",
          404,
        );
      }
      await tx.tenderRequirement.update({
        where: { id: existing.id },
        data: {
          status: appliedStatus,
          evidence: evidenceText.slice(0, 4000),
        },
      });

      const ev = await tx.tenderEvidence.create({
        data: {
          tenderId: task.tenderId,
          requirementId: existing.id,
          evidenceText: evidenceText.slice(0, 8000),
          verificationStatus: "VERIFIED",
          teamTaskId: task.id,
          sourceSection: `team-workflow:${task.id}`,
          verifiedById: input.userId,
          verifiedAt,
          verificationReason: note ?? "Team evidence verified by authorized reviewer.",
        },
      });
      evidenceId = ev.id;

      await tx.teamWorkflowEvent.create({
        data: {
          companyId: input.companyId,
          taskId: task.id,
          actorUserId: input.userId,
          eventType: "REQUIREMENT_UPDATED",
          message: `Requirement ${existing.id} status → ${appliedStatus}`,
          metadata: {
            requirementId: existing.id,
            fromStatus: existing.status,
            toStatus: appliedStatus,
            evidenceId: ev.id,
          },
        },
      });
    }

    if (task.missingDocId) {
      await tx.missingDocument.updateMany({
        where: {
          id: task.missingDocId,
          tenderId: task.tenderId,
          status: "OPEN",
        },
        data: { status: "RESOLVED" },
      });
    }

    if (task.riskId) {
      await tx.tenderRisk.updateMany({
        where: { id: task.riskId, tenderId: task.tenderId, status: "OPEN" },
        data: {
          status: "MITIGATED",
          mitigation: task.responseText!.slice(0, 2000),
        },
      });
    }

    await tx.teamWorkflowTask.update({
      where: { id: task.id },
      data: {
        verificationStatus: "VERIFIED",
        verifiedAt,
        verifiedById: input.userId,
        verificationNote: note,
        appliedRequirementStatus: appliedStatus,
        verifiedEvidenceId: evidenceId,
        closedLoopHash,
        status: "COMPLETED",
        completedAt: verifiedAt,
        completedById: input.userId,
      },
    });

    await tx.teamWorkflowEvent.create({
      data: {
        companyId: input.companyId,
        taskId: task.id,
        actorUserId: input.userId,
        eventType: "VERIFIED",
        fromStatus: task.status,
        toStatus: "COMPLETED",
        message:
          note ??
          "Evidence verified — closed loop will recalculate decision",
        metadata: {
          verdict: "VERIFIED",
          appliedRequirementStatus: appliedStatus,
          evidenceId,
          closedLoopHash,
        },
      },
    });
  });

  await trackEvent({
    action: "TEAM_TASK_VERIFIED",
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      taskId: task.id,
      tenderId: task.tenderId,
      appliedRequirementStatus: appliedStatus,
      evidenceId,
    },
  });

  if (task.requirementId) {
    const { recordVerificationAudit } = await import(
      "@/services/evidence-verification"
    );
    await recordVerificationAudit({
      companyId: input.companyId,
      tenderId: task.tenderId,
      requirementId: task.requirementId,
      evidenceId,
      userId: input.userId,
      action: "VERIFIED",
      snapshot: {
        taskId: task.id,
        appliedRequirementStatus: appliedStatus,
        closedLoopHash,
      },
    });
  }

  const { notifyWorkflowStakeholders } = await import(
    "@/services/team-workflow/alerts"
  );
  await notifyWorkflowStakeholders({
    companyId: input.companyId,
    tenderId: task.tenderId,
    tenderTitle: task.tender?.title ?? "Tender",
    kind: "EVIDENCE_VERIFIED",
    taskId: task.id,
    taskTitle: task.title,
    targetUserId: task.assigneeUserId,
    message: `Evidence for "${task.title}" was verified. Readiness and decision will be recalculated.`,
  });

  const closedLoop = await reanalyzeTenderAfterVerifiedEvidence({
    companyId: input.companyId,
    tenderId: task.tenderId,
    triggerTaskId: task.id,
    userId: input.userId,
    closedLoopHash,
  });

  return {
    taskId: task.id,
    verificationStatus: "VERIFIED" as const,
    closedLoop,
  };
}

/**
 * Re-run readiness + Decision Engine from canonical DB after verified evidence.
 * Explicit trigger only — not a background re-analysis loop.
 */
export async function reanalyzeTenderAfterVerifiedEvidence(input: {
  companyId: string;
  tenderId: string;
  triggerTaskId: string;
  userId: string;
  closedLoopHash: string;
}): Promise<{
  skipped: boolean;
  reason?: string;
  decisionChanged?: boolean;
  priorDecision?: string;
  nextDecision?: string;
}> {
  const tender = await prisma.tender.findFirst({
    where: { id: input.tenderId, companyId: input.companyId },
    include: {
      company: { include: { profile: true } },
      decision: true,
      requirements: { orderBy: { sortOrder: "asc" } },
      risks: { orderBy: { sortOrder: "asc" } },
      missingDocs: { orderBy: { sortOrder: "asc" } },
      evidence: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!tender) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
  if (!tender.decision) {
    return { skipped: true, reason: "no_prior_decision" };
  }

  const { assertFeature } = await import("@/services/entitlements");
  await assertFeature(input.companyId, "advanced_decision_engine");

  const profile = toRuleProfile(tender.company.profile, tender.company.name);

  const ruleRequirements = tender.requirements.map((r) => ({
    id: r.id,
    category: r.category,
    description: r.description,
    mandatory: r.mandatory,
    value: r.value,
    status: r.status,
    evidence: r.evidence,
  }));

  const engine = runDecisionEngine({
    profile,
    requirements: ruleRequirements,
    estimatedValue: tender.estimatedValue,
    tenderContext: {
      title: tender.title,
      client: tender.client,
      country: tender.country,
      industry: tender.industry,
      tenderText: ruleRequirements
        .map((r) => `${r.category} ${r.description}`)
        .join("\n"),
    },
    ai: {
      suggestedDecision: tender.decision.decision,
      fitScore: tender.decision.fitScore,
      confidence: tender.decision.confidence,
      reasoning: tender.decision.reasoning,
    },
  });

  // Never silently undo a team-VERIFIED requirement status
  const verifiedRequirementIds = new Set(
    tender.evidence
      .filter(
        (e) => e.verificationStatus === "VERIFIED" && e.requirementId,
      )
      .map((e) => e.requirementId as string),
  );

  for (const req of engine.requirements) {
    if (!req.id) continue;
    const row = tender.requirements.find((r) => r.id === req.id);
    if (!row || row.status === req.status) continue;
    if (verifiedRequirementIds.has(req.id)) continue;
    await prisma.tenderRequirement.update({
      where: { id: req.id },
      data: { status: req.status },
    });
  }

  const freshReqs = await prisma.tenderRequirement.findMany({
    where: { tenderId: tender.id },
    orderBy: { sortOrder: "asc" },
  });

  const readiness = computeTenderReadiness({
    requirements: freshReqs.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence,
    })),
    missingDocuments: tender.missingDocs
      .filter((d) => d.status === "OPEN")
      .map((d) => ({
        id: d.id,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
    fit: engine.fitBreakdown,
    profileHasAnyCapability: !isProfileSparse(profile),
  });

  const evidenceRows = await prisma.tenderEvidence.findMany({
    where: { tenderId: tender.id },
    orderBy: { createdAt: "asc" },
  });
  const riskRows = await prisma.tenderRisk.findMany({
    where: { tenderId: tender.id },
    orderBy: { sortOrder: "asc" },
  });

  const intelligence = buildTenderIntelligence({
    tenderId: tender.id,
    documentName: tender.title,
    tenderDeadline: tender.deadline,
    extractedText: "",
    requirements: freshReqs.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: r.sourcePage,
      sourceSection: r.sourceSection,
      evidence: r.evidence,
    })),
    evidence: evidenceRows.map((e) => ({
      id: e.id,
      requirementId: e.requirementId,
      sourcePage: e.sourcePage,
      sourceSection: e.sourceSection,
      evidenceText: e.evidenceText,
      verificationStatus: e.verificationStatus,
      teamTaskId: e.teamTaskId,
      documentId: e.documentId,
      verificationReason: e.verificationReason,
      verifiedById: e.verifiedById,
      verifiedAt: e.verifiedAt,
    })),
    readiness,
    findings: engine.findings,
    existingRisks: riskRows.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      severity: r.severity,
      sourcePage: r.sourcePage,
      mitigation: r.mitigation,
    })),
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  const { assertCanonicalRequirementInvariants } = await import(
    "@/domain/tender-requirements"
  );
  assertCanonicalRequirementInvariants({
    canonicalRequirementCount: freshReqs.length,
    readiness,
    intelligence,
  });

  const priorBreakdown = tender.decision.intelligenceBreakdown as Record<
    string,
    unknown
  > | null;
  if (priorBreakdown?.learningSignal) {
    intelligence.learningSignal =
      priorBreakdown.learningSignal as typeof intelligence.learningSignal;
  }
  if (priorBreakdown?.decisionMemoryInsights) {
    (
      intelligence as { decisionMemoryInsights?: unknown }
    ).decisionMemoryInsights = priorBreakdown.decisionMemoryInsights;
  }
  if (priorBreakdown?.canonicalSnapshot) {
    intelligence.canonicalSnapshot =
      priorBreakdown.canonicalSnapshot as typeof intelligence.canonicalSnapshot;
  }
  if (priorBreakdown?.analysisIntegrity) {
    intelligence.analysisIntegrity =
      priorBreakdown.analysisIntegrity as typeof intelligence.analysisIntegrity;
  }
  if (priorBreakdown?.tenderCertification) {
    intelligence.tenderCertification =
      priorBreakdown.tenderCertification as typeof intelligence.tenderCertification;
  }
  if (priorBreakdown?.universalTenderIntelligence) {
    intelligence.universalTenderIntelligence =
      priorBreakdown.universalTenderIntelligence as typeof intelligence.universalTenderIntelligence;
  }

  const { findRelevantDecisionMemories, recordDecisionMemory } = await import(
    "@/services/decision-memory"
  );
  const { buildFeaturesForTender } = await import("@/services/learning");
  const missingMandatory = freshReqs.filter(
    (r) => r.mandatory && (r.status === "FAILED" || r.status === "MISSING"),
  ).length;

  const { features, featureKey } = buildFeaturesForTender({
    industry: tender.industry ?? tender.company.profile?.industry ?? null,
    country: tender.country ?? tender.company.profile?.country ?? null,
    companySize: tender.company.companySize,
    employeeRange: tender.company.profile?.employeeRange ?? null,
    fitScore: engine.fitScore,
    readinessScore: readiness.score,
    decision: engine.decision,
    missingMandatoryCount: missingMandatory,
    estimatedValue: tender.estimatedValue,
  });

  const memoryInsights = await findRelevantDecisionMemories({
    companyId: input.companyId,
    currentFeatures: features,
    excludeTenderId: tender.id,
  });
  intelligence.decisionMemoryInsights = memoryInsights;

  const { getTenderWorkflowSummary } = await import("@/services/team-workflow");
  const teamWorkflow = await getTenderWorkflowSummary({
    companyId: input.companyId,
    tenderId: tender.id,
  }).catch(() => null);

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: true,
    readiness: {
      score: readiness.score,
      counts: readiness.counts,
      attention: readiness.attention,
      recommendation: readiness.recommendation,
    },
    compliance: intelligence.complianceSummary,
    complianceMatrix: intelligence.complianceMatrix,
    keyBlockers: intelligence.keyBlockers,
    structuredRiskTitles: intelligence.risks.map((r) => ({
      title: r.title,
      severity: r.severityCanonical ?? r.severity,
      evidenceState: r.evidenceState ?? null,
      fitStatus: r.fitStatus ?? null,
    })),
    deadline: tender.deadline,
    asOf: new Date(),
    memoryInsights,
    teamWorkflow,
  });

  engine.decision = finalized.decision;
  engine.confidence = finalized.confidence;
  engine.reasoning = finalized.reasoning;
  intelligence.tenderDecisionRecommendation = finalized.recommendation;
  intelligence.decisionContext = [
    finalized.recommendation.summary,
    "",
    intelligence.decisionContext,
  ].join("\n");

  const analyzedAt = new Date();

  try {
    const { buildTenderActionPlan } = await import("@/domain/tender-action-plan");
    const { hasFeature } = await import("@/services/entitlements");
    const teamTasksForPlan = await prisma.teamWorkflowTask.findMany({
      where: {
        companyId: input.companyId,
        tenderId: tender.id,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        requirementId: true,
        riskId: true,
        missingDocId: true,
        department: true,
        deadline: true,
      },
    });
    const priorPlan = priorBreakdown?.actionPlan as
      | import("@/domain/tender-action-plan").TenderActionPlanBundle
      | null
      | undefined;
    const actionPlanAllowed = await hasFeature(input.companyId, "tender_action_plan");
    if (actionPlanAllowed) {
    intelligence.actionPlan = buildTenderActionPlan({
      tenderId: tender.id,
      companyId: input.companyId,
      tenderDeadline: tender.deadline,
      complianceMatrix: intelligence.complianceMatrix,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      risks: intelligence.risks,
      keyBlockers: intelligence.keyBlockers,
      readiness,
      fitBreakdown: engine.fitBreakdown,
      recommendation: intelligence.tenderDecisionRecommendation,
      teamTasks: teamTasksForPlan.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        requirementId: t.requirementId,
        riskId: t.riskId,
        missingDocId: t.missingDocId,
        department: t.department,
        deadline: t.deadline,
      })),
      previousPlan: priorPlan ?? null,
      asOf: analyzedAt,
    });
    }
  } catch (error) {
    logInfo("action_plan.closed_loop_skipped", {
      tenderId: tender.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const bidScore = buildBidScoreFromAnalysis({
    fitScore: engine.fitScore,
    fitBreakdown: engine.fitBreakdown,
    readiness,
    intelligence,
    estimatedValue: tender.estimatedValue,
    deadline: tender.deadline,
    decision: engine.decision,
    asOf: analyzedAt,
  });

  // Decision Validation Guardian — closed-loop is a second writer; must fail-closed
  // before overwriting the Guardian-stamped release (no OCR / LLM re-run).
  {
    const {
      assertFinalReleaseIntegrity,
      buildDecisionGuardianInput,
      hashCanonicalReleasePayload,
      DecisionGuardianError,
    } = await import("@/domain/decision-validation");
    const docText = await prisma.tenderDocument.findFirst({
      where: { tenderId: tender.id },
      orderBy: { createdAt: "asc" },
      select: { extractedText: true, fileName: true },
    });
    const sourceText = docText?.extractedText ?? "";
    const guardianReqs = engine.requirements.map((r, i) => {
      const row = freshReqs[i] ?? freshReqs.find((x) => x.id === r.id);
      const fit = r.fitStatus ?? null;
      return {
        id: r.id ?? row?.id ?? `req-${i + 1}`,
        requirement: r.description,
        description: r.description,
        category: r.category,
        semanticKind: r.semanticKind ?? null,
        obligationStrength: r.mandatory ? "MANDATORY" : "CONDITIONAL",
        mandatory: r.mandatory,
        sourceSection:
          (typeof r.section === "string" ? r.section : null) ??
          row?.sourceSection ??
          null,
        page: (typeof r.page === "number" ? r.page : null) ?? row?.sourcePage ?? null,
        evidenceText: row?.evidence ?? r.evidence ?? null,
        companyEvidenceText:
          fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP" ? r.evidence ?? null : null,
        hasCompanyEvidence:
          fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP"
            ? Boolean(r.evidence?.trim())
            : false,
        value: r.value ?? null,
        fitStatus: fit ?? r.status ?? null,
        status: r.status ?? null,
      };
    });
    const contentHash = hashCanonicalReleasePayload(
      guardianReqs.map((r) => ({ id: r.id, text: r.requirement })),
    );
    const actionItems = intelligence.actionPlan?.items ?? [];
    try {
      const release = assertFinalReleaseIntegrity(
        buildDecisionGuardianInput({
          textLength: sourceText.trim().length,
          readable: sourceText.trim().length >= 80,
          validityPassed: true,
          fileName: docText?.fileName ?? tender.title,
          requirements: guardianReqs,
          matrix: intelligence.complianceMatrix.map((row) => ({
            requirementId: row.requirementId,
          })),
          readinessItems: readiness.items.map((item) => ({ id: item.id })),
          actions: actionItems.map((a) => ({
            linkedRequirementId: a.linkedRequirementId,
            blocking: a.blocking,
            sourceType: a.sourceType,
            title: a.title,
            simulationOnly: a.simulationOnly,
          })),
          decision: {
            decision: engine.decision,
            hardFailure: Boolean(intelligence.tenderDecisionRecommendation?.hardFailure),
            hardBlockerCount: intelligence.keyBlockers.length,
            aiSuggestedDecision: tender.decision.decision,
            aiOverrodeCanonical: false,
          },
          deadline: {
            deadlineIso: readCanonicalDeadlineIso({
              snapshotIso:
                intelligence.canonicalSnapshot?.metadata.deadlineIso ?? null,
              persistedInstant: tender.deadline,
              timezone:
                intelligence.canonicalSnapshot?.metadata.deadlineTimezone ??
                tender.deadlineTimezone,
            }),
            deadlineTimezone:
              intelligence.canonicalSnapshot?.metadata.deadlineTimezone ??
              tender.deadlineTimezone ??
              null,
            sourceEvidence:
              intelligence.canonicalSnapshot?.metadata.packageIdentity?.deadline
                .evidence ?? (tender.deadline ? "tender.deadline" : null),
          },
          fitScore: engine.fitScore,
          fitBreakdownOverall: engine.fitBreakdown?.overall ?? null,
          reasoning: engine.reasoning,
          complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
          tenderSourceText: sourceText,
          risks: intelligence.risks.map((risk) => ({
            id: risk.id,
            requirementId: risk.requirementId ?? null,
            severity: risk.severityCanonical ?? risk.severity,
            fitStatus: risk.fitStatus ?? null,
            evidenceState: risk.evidenceState ?? null,
            title: risk.title,
          })),
          derivedDeadline: (() => {
            const iso = readCanonicalDeadlineIso({
              snapshotIso:
                intelligence.canonicalSnapshot?.metadata.deadlineIso ?? null,
              persistedInstant: tender.deadline,
              timezone:
                intelligence.canonicalSnapshot?.metadata.deadlineTimezone ??
                tender.deadlineTimezone,
            });
            const tz =
              intelligence.canonicalSnapshot?.metadata.deadlineTimezone ??
              tender.deadlineTimezone ??
              null;
            if (!iso) return null;
            return {
              canonicalIso: iso,
              canonicalTimezone: tz,
              representations: [
                { channel: "WEB" as const, iso, timezone: tz },
                { channel: "PDF" as const, iso, timezone: tz },
              ],
            };
          })(),
          staleResult: {
            canonicalContentHash: contentHash,
            projectedContentHash: contentHash,
            analyzedAt: analyzedAt.toISOString(),
            projectedAnalyzedAt: analyzedAt.toISOString(),
          },
        }),
        contentHash,
      );
      intelligence.decisionGuardian = release.snapshot;
    } catch (err) {
      if (err instanceof DecisionGuardianError) {
        logInfo("closed_loop.guardian_blocked", {
          tenderId: tender.id,
          blocking: err.result.blockingFailures.map((f) => f.validationCode),
        });
      }
      throw err;
    }
  }

  const priorDecision = tender.decision.decision;
  const priorReadiness =
    (tender.decision.readinessBreakdown as { score?: number | null } | null)
      ?.score ?? null;
  const changed = meaningfulDecisionChange({
    priorDecision,
    nextDecision: engine.decision,
    priorReadiness,
    nextReadiness: readiness.score,
    priorFit: tender.decision.fitScore,
    nextFit: engine.fitScore,
  });

  await prisma.tenderDecision.update({
    where: { tenderId: tender.id },
    data: {
      decision: engine.decision,
      fitScore: engine.fitScore,
      confidence: engine.confidence,
      reasoning: engine.reasoning,
      fitBreakdown: engine.fitBreakdown as object,
      readinessBreakdown: readiness as object,
      intelligenceBreakdown: intelligence as object,
      bidScoreBreakdown: bidScore as object,
      isAiSuggested: true,
    },
  });

  try {
    await recordDecisionMemory({
      companyId: input.companyId,
      tenderId: tender.id,
      title: tender.title,
      client: tender.client,
      country: tender.country,
      industry: tender.industry,
      decision: engine.decision,
      fitScore: engine.fitScore,
      readinessScore: readiness.score,
      bidScore: bidScore.scoringAvailable ? bidScore.score : null,
      confidence: engine.confidence,
      reasoning: engine.reasoning,
      requirementsSnapshot: {
        totalRequirements: intelligence.complianceSummary.totalRequirements,
        ready: intelligence.complianceSummary.ready,
        missing: intelligence.complianceSummary.missing,
        verify: intelligence.complianceSummary.verify,
        lines: intelligence.complianceMatrix
          .slice(0, 40)
          .map((r) => r.requirement)
          .filter(Boolean),
      },
      risksSnapshot: intelligence.risks.map((r) => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
      })),
      scoresSnapshot: {
        fitScore: engine.fitScore,
        readinessScore: readiness.score,
        bidScore: bidScore.scoringAvailable ? bidScore.score : null,
        confidence: engine.confidence,
      },
      features,
      featureKey,
      analyzedAt,
      userId: input.userId,
      revisionSource: "TEAM_VERIFIED_EVIDENCE",
      triggerTaskId: input.triggerTaskId,
    });
  } catch (error) {
    logInfo("closed_loop.memory_skipped", {
      tenderId: tender.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await prisma.teamWorkflowEvent.create({
    data: {
      companyId: input.companyId,
      taskId: input.triggerTaskId,
      actorUserId: input.userId,
      eventType: "DECISION_RERUN",
      message: changed
        ? `Decision updated ${priorDecision} → ${engine.decision}`
        : "Decision re-run completed — no material change",
      metadata: {
        priorDecision,
        nextDecision: engine.decision,
        closedLoopHash: input.closedLoopHash,
        readinessScore: readiness.score,
        fitScore: engine.fitScore,
        changed,
      },
    },
  });

  await trackEvent({
    action: "TEAM_CLOSED_LOOP_RERUN",
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      tenderId: tender.id,
      taskId: input.triggerTaskId,
      priorDecision,
      nextDecision: engine.decision,
      changed,
      closedLoopHash: input.closedLoopHash,
    },
  });

  const { notifyWorkflowStakeholders } = await import(
    "@/services/team-workflow/alerts"
  );
  if (changed) {
    await notifyWorkflowStakeholders({
      companyId: input.companyId,
      tenderId: tender.id,
      tenderTitle: tender.title,
      kind: "DECISION_CHANGED",
      taskId: input.triggerTaskId,
      taskTitle: tender.title,
      message: `Decision for "${tender.title}" changed from ${priorDecision} to ${engine.decision} after verified team evidence.`,
      dedupeKey: `${input.companyId}:${tender.id}:decision-change:${priorDecision}:${engine.decision}:${input.closedLoopHash.slice(0, 16)}`,
    });

    const {
      emitPostAnalysisSmartAlerts,
      priorSnapshotFromStored,
    } = await import("@/services/smart-alerts");
    const missingCount = await prisma.missingDocument.count({
      where: { tenderId: tender.id, status: "OPEN" },
    });
    await emitPostAnalysisSmartAlerts({
      companyId: input.companyId,
      tenderId: tender.id,
      title: tender.title,
      decision: engine.decision,
      fitScore: engine.fitScore,
      bidScore: bidScore.scoringAvailable ? bidScore.score : null,
      scoringAvailable: bidScore.scoringAvailable !== false,
      hasHighOrCriticalRisk: riskRows.some(
        (r) =>
          r.status === "OPEN" &&
          (r.severity === "HIGH" || r.severity === "CRITICAL"),
      ),
      missingDocumentCount: missingCount,
      compliance: {
        totalRequirements: intelligence.complianceSummary.totalRequirements,
        ready: intelligence.complianceSummary.ready,
        missing: intelligence.complianceSummary.missing,
        verify: intelligence.complianceSummary.verify,
      },
      decisionMemoryMatchIds: memoryInsights.matches.map((m) => m.memoryId),
      decisionMemoryTopTitle: memoryInsights.matches[0]?.title ?? null,
      decisionMemoryTopLabel: memoryInsights.matches[0]?.decisionLabel ?? null,
      prior: priorSnapshotFromStored({
        decision: priorDecision,
        fitScore: tender.decision.fitScore,
        bidScoreBreakdown: tender.decision.bidScoreBreakdown,
        intelligenceBreakdown: tender.decision.intelligenceBreakdown,
      }),
      actionPlan: intelligence.actionPlan?.computed
        ? {
            openCritical: intelligence.actionPlan.summary.critical,
            openBlocking: intelligence.actionPlan.summary.blocking,
            deadlineDays: intelligence.actionPlan.deadlineUrgency.daysRemaining,
          }
        : null,
    });
  }

  logInfo("closed_loop.rerun_complete", {
    tenderId: tender.id,
    taskId: input.triggerTaskId,
    priorDecision,
    nextDecision: engine.decision,
    changed,
  });

  return {
    skipped: false,
    decisionChanged: changed,
    priorDecision,
    nextDecision: engine.decision,
  };
}
