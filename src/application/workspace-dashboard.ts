/**
 * Company-scoped workspace dashboard aggregation.
 * All queries require companyId from the authenticated session — never client-supplied.
 * Metrics are live DB snapshots; no fabricated historical series.
 */
import { prisma } from "@/lib/db";
import { hasFeature, getEffectiveEntitlements } from "@/services/entitlements";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import type { ComplianceStatus } from "@prisma/client";

export type WorkspaceKpiId =
  | "document_compliance"
  | "expiring_documents"
  | "supplier_qualification"
  | "client_requests"
  | "questionnaires"
  | "evidence_intelligence"
  | "decision_activity"
  | "upcoming_deadlines";

export type WorkspaceKpi = {
  id: WorkspaceKpiId;
  enabled: boolean;
  href: string;
  /** Primary display value (number or percent string) */
  value: number;
  /** Optional secondary count */
  secondary: number | null;
  /** Unit: "percent" | "count" */
  unit: "percent" | "count";
  empty: boolean;
};

export type WorkspaceChartSeries = {
  id: string;
  label: string;
  value: number;
};

export type WorkspaceActivityItem = {
  id: string;
  kind: string;
  title: string;
  at: string;
  href: string | null;
};

export type WorkspacePlanSummary = {
  planName: string;
  planSlug: string;
  billingInterval: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  isTrialing: boolean;
  seatsLimit: number;
  memberCount: number;
  enabledCapabilityLabels: string[];
  enabledCapabilityKeys: string[];
};

export type WorkspaceDashboardData = {
  companyId: string;
  kpis: WorkspaceKpi[];
  complianceStatusSeries: WorkspaceChartSeries[];
  activitySeries: WorkspaceChartSeries[];
  deadlineSeries: WorkspaceChartSeries[];
  hasComplianceHistory: boolean;
  hasActivityHistory: boolean;
  plan: WorkspacePlanSummary;
  quickActions: Array<{ id: string; href: string; labelKey: string }>;
  recentActivity: WorkspaceActivityItem[];
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayKey(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

async function featureOn(
  companyId: string,
  key: Parameters<typeof hasFeature>[1],
): Promise<boolean> {
  if (!isCommerciallyAvailableFeature(key)) return false;
  try {
    return await hasFeature(companyId, key);
  } catch {
    return false;
  }
}

/**
 * Build workspace dashboard for one company. Call only with session companyId.
 */
export async function getWorkspaceDashboard(
  companyId: string,
): Promise<WorkspaceDashboardData> {
  if (!companyId) {
    throw new Error("companyId required");
  }

  const [
    complianceOn,
    supplierOn,
    clientOn,
    questionnaireOn,
    evidenceOn,
    decisionOn,
    calendarOn,
    entitlements,
  ] = await Promise.all([
    featureOn(companyId, "document_compliance"),
    featureOn(companyId, "supplier_qualification"),
    featureOn(companyId, "client_requests"),
    featureOn(companyId, "questionnaire_assistant"),
    featureOn(companyId, "evidence_intelligence"),
    featureOn(companyId, "decision_memory"),
    featureOn(companyId, "tender_calendar"),
    getEffectiveEntitlements(companyId),
  ]);

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ACTIVITY_SAMPLE_LIMIT = 500;

  const [
    complianceByStatus,
    supplierProfile,
    supplierEvidence,
    clientByStatus,
    questionnaireDrafts,
    questionnairePacks,
    evidenceVerified,
    evidenceTotal,
    missingOpen,
    decisionCount,
    decisionRecent,
    calendarUpcoming,
    memberCount,
    subscription,
    requestActivities,
    draftUpdates,
    complianceUpdateCount,
    recentDocs,
    recentReq,
    recentMem,
  ] = await Promise.all([
    complianceOn
      ? prisma.complianceDocument.groupBy({
          by: ["status"],
          where: { companyId },
          _count: true,
        })
      : Promise.resolve([]),
    supplierOn
      ? prisma.supplierQualificationProfile.findUnique({
          where: { companyId },
          select: { completenessPercent: true, updatedAt: true },
        })
      : Promise.resolve(null),
    supplierOn
      ? prisma.supplierQualificationEvidence.groupBy({
          by: ["verified"],
          where: { companyId },
          _count: true,
        })
      : Promise.resolve([]),
    clientOn
      ? prisma.clientRequest.groupBy({
          by: ["status"],
          where: { companyId },
          _count: true,
        })
      : Promise.resolve([]),
    questionnaireOn
      ? prisma.questionnaireDraftAnswer.groupBy({
          by: ["status"],
          where: { companyId },
          _count: true,
        })
      : Promise.resolve([]),
    questionnaireOn
      ? prisma.questionnairePack.count({ where: { companyId } })
      : Promise.resolve(0),
    evidenceOn
      ? prisma.tenderEvidence.count({
          where: {
            tender: { companyId },
            verificationStatus: "VERIFIED",
          },
        })
      : Promise.resolve(0),
    evidenceOn
      ? prisma.tenderEvidence.count({
          where: { tender: { companyId } },
        })
      : Promise.resolve(0),
    evidenceOn
      ? prisma.missingDocument.count({
          where: { tender: { companyId }, status: "OPEN" },
        })
      : Promise.resolve(0),
    decisionOn
      ? prisma.decisionMemory.count({ where: { companyId } })
      : Promise.resolve(0),
    decisionOn
      ? prisma.decisionMemory.count({
          where: {
            companyId,
            updatedAt: { gte: since30d },
          },
        })
      : Promise.resolve(0),
    calendarOn
      ? prisma.calendarTenderDeadline.findMany({
          where: {
            companyId,
            occursAt: { gte: startOfUtcDay(new Date()) },
          },
          select: { occursAt: true, status: true, dateOnly: true },
          orderBy: { occursAt: "asc" },
          take: 200,
        })
      : Promise.resolve([]),
    prisma.user.count({ where: { companyId } }),
    prisma.subscription.findUnique({
      where: { companyId },
      select: {
        status: true,
        currentPeriodEnd: true,
        billingInterval: true,
      },
    }),
    clientOn
      ? prisma.clientRequestActivity.findMany({
          where: {
            companyId,
            createdAt: { gte: since30d },
          },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: ACTIVITY_SAMPLE_LIMIT,
        })
      : Promise.resolve([]),
    questionnaireOn
      ? prisma.questionnaireDraftAnswer.findMany({
          where: {
            companyId,
            updatedAt: { gte: since30d },
          },
          select: { updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: ACTIVITY_SAMPLE_LIMIT,
        })
      : Promise.resolve([]),
    complianceOn
      ? prisma.complianceDocument.count({
          where: {
            companyId,
            updatedAt: { gte: since30d },
          },
        })
      : Promise.resolve(0),
    // Recent activity streams — same barrier as KPI aggregates (no second round-trip).
    complianceOn
      ? prisma.complianceDocument.findMany({
          where: { companyId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, name: true, updatedAt: true, status: true },
        })
      : Promise.resolve([]),
    clientOn
      ? prisma.clientRequest.findMany({
          where: { companyId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, title: true, updatedAt: true, status: true },
        })
      : Promise.resolve([]),
    decisionOn
      ? prisma.decisionMemory.findMany({
          where: { companyId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, title: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const byStatus: Record<ComplianceStatus, number> = {
    VALID: 0,
    EXPIRING_SOON: 0,
    EXPIRED: 0,
    NO_EXPIRY: 0,
    UNKNOWN: 0,
  };
  for (const row of complianceByStatus) {
    byStatus[row.status] = row._count;
  }
  const complianceTotal =
    byStatus.VALID +
    byStatus.EXPIRING_SOON +
    byStatus.EXPIRED +
    byStatus.NO_EXPIRY +
    byStatus.UNKNOWN;
  const validLike = byStatus.VALID + byStatus.NO_EXPIRY;
  const compliancePercent =
    complianceTotal === 0 ? 0 : Math.round((validLike / complianceTotal) * 100);
  const expiringCount = byStatus.EXPIRING_SOON;

  const completenessPercent = supplierProfile?.completenessPercent ?? 0;

  const clientOpen =
    (clientByStatus.find((s) => s.status === "PENDING")?._count ?? 0) +
    (clientByStatus.find((s) => s.status === "IN_PROGRESS")?._count ?? 0) +
    (clientByStatus.find((s) => s.status === "OVERDUE")?._count ?? 0);
  const clientCompleted =
    clientByStatus.find((s) => s.status === "COMPLETED")?._count ?? 0;

  const qPending =
    (questionnaireDrafts.find((s) => s.status === "VERIFY")?._count ?? 0) +
    (questionnaireDrafts.find((s) => s.status === "DRAFT_READY")?._count ?? 0);
  const qCompleted =
    (questionnaireDrafts.find((s) => s.status === "APPROVED")?._count ?? 0) +
    (questionnaireDrafts.find((s) => s.status === "EDITED")?._count ?? 0);

  const supplierVerified =
    supplierEvidence.find((g) => g.verified === true)?._count ?? 0;
  const supplierUnverified =
    supplierEvidence.find((g) => g.verified === false)?._count ?? 0;

  // Evidence Intelligence: tender-scoped evidence rows for this company.
  // When feature off, KPI hidden. Prefer TenderEvidence; fall back to supplier evidence counts when EI on but zero tender rows and supplier on.
  const evidenceVerifiedCount = evidenceTotal > 0 ? evidenceVerified : supplierOn ? supplierVerified : 0;
  const evidenceMissingCount =
    evidenceTotal > 0 ? missingOpen : supplierOn ? supplierUnverified : missingOpen;

  const upcomingDeadlines = calendarUpcoming.length;

  const kpis: WorkspaceKpi[] = [
    {
      id: "document_compliance",
      enabled: complianceOn,
      href: "/document-compliance",
      value: compliancePercent,
      secondary: complianceTotal,
      unit: "percent",
      empty: complianceTotal === 0,
    },
    {
      id: "expiring_documents",
      enabled: complianceOn,
      href: "/document-compliance",
      value: expiringCount,
      secondary: byStatus.EXPIRED,
      unit: "count",
      empty: complianceTotal === 0,
    },
    {
      id: "supplier_qualification",
      enabled: supplierOn,
      href: "/supplier-qualification",
      value: completenessPercent,
      secondary: supplierVerified + supplierUnverified,
      unit: "percent",
      empty: !supplierProfile,
    },
    {
      id: "client_requests",
      enabled: clientOn,
      href: "/client-requests",
      value: clientOpen,
      secondary: clientCompleted,
      unit: "count",
      empty: clientOpen + clientCompleted === 0,
    },
    {
      id: "questionnaires",
      enabled: questionnaireOn,
      href: "/questionnaire-assistant",
      value: qPending,
      secondary: qCompleted || questionnairePacks,
      unit: "count",
      empty: questionnairePacks === 0 && qPending + qCompleted === 0,
    },
    {
      id: "evidence_intelligence",
      enabled: evidenceOn,
      href: "/supplier-qualification/evidence",
      value: evidenceVerifiedCount,
      secondary: evidenceMissingCount,
      unit: "count",
      empty: evidenceVerifiedCount + evidenceMissingCount === 0 && evidenceTotal === 0,
    },
    {
      id: "decision_activity",
      enabled: decisionOn,
      href: "/decision-memory",
      value: decisionCount,
      secondary: decisionRecent,
      unit: "count",
      empty: decisionCount === 0,
    },
    {
      id: "upcoming_deadlines",
      enabled: calendarOn,
      href: "/tender-calendar",
      value: upcomingDeadlines,
      secondary: null,
      unit: "count",
      empty: upcomingDeadlines === 0,
    },
  ];

  const complianceStatusSeries: WorkspaceChartSeries[] = [
    { id: "VALID", label: "Valid", value: byStatus.VALID },
    { id: "EXPIRING_SOON", label: "Expiring soon", value: byStatus.EXPIRING_SOON },
    { id: "EXPIRED", label: "Expired", value: byStatus.EXPIRED },
    { id: "NO_EXPIRY", label: "No expiry", value: byStatus.NO_EXPIRY },
    { id: "UNKNOWN", label: "Unknown", value: byStatus.UNKNOWN },
  ].filter(() => complianceOn);

  // Activity buckets from real timestamps only (last 30 days) — empty if none.
  const activityBuckets = new Map<string, number>();
  for (const row of requestActivities) {
    const k = dayKey(row.createdAt);
    activityBuckets.set(k, (activityBuckets.get(k) ?? 0) + 1);
  }
  for (const row of draftUpdates) {
    const k = dayKey(row.updatedAt);
    activityBuckets.set(k, (activityBuckets.get(k) ?? 0) + 1);
  }
  const activitySeries: WorkspaceChartSeries[] = [...activityBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ id: label, label, value }));

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const deadlineBuckets = [
    { id: "7d", label: "Next 7 days", value: 0 },
    { id: "30d", label: "8–30 days", value: 0 },
    { id: "90d", label: "31–90 days", value: 0 },
    { id: "later", label: "Later", value: 0 },
  ];
  for (const d of calendarUpcoming) {
    const delta = d.occursAt.getTime() - now;
    if (delta <= weekMs) deadlineBuckets[0]!.value += 1;
    else if (delta <= 30 * 24 * 60 * 60 * 1000) deadlineBuckets[1]!.value += 1;
    else if (delta <= 90 * 24 * 60 * 60 * 1000) deadlineBuckets[2]!.value += 1;
    else deadlineBuckets[3]!.value += 1;
  }
  const deadlineSeries = calendarOn ? deadlineBuckets : [];

  const enabledKeys = Object.entries(entitlements.features)
    .filter(([key, on]) => on && isCommerciallyAvailableFeature(key as never))
    .map(([key]) => key)
    .slice(0, 8);
  const enabledLabels = enabledKeys.map((key) => key.replaceAll("_", " "));

  const plan: WorkspacePlanSummary = {
    planName: entitlements.planName,
    planSlug: entitlements.planSlug,
    billingInterval: entitlements.billingInterval,
    subscriptionStatus: subscription?.status ?? null,
    trialEndsAt:
      subscription?.status === "TRIALING"
        ? (subscription.currentPeriodEnd?.toISOString() ?? null)
        : null,
    isTrialing: subscription?.status === "TRIALING",
    seatsLimit: entitlements.seatsLimit,
    memberCount,
    enabledCapabilityLabels: enabledLabels,
    enabledCapabilityKeys: enabledKeys,
  };

  const quickActions: Array<{ id: string; href: string; labelKey: string }> = [];
  if (complianceOn) {
    quickActions.push({
      id: "add_document",
      href: "/document-compliance/upload",
      labelKey: "addDocument",
    });
  }
  if (supplierOn) {
    quickActions.push({
      id: "supplier",
      href: "/supplier-qualification/profile",
      labelKey: "completeQualification",
    });
  }
  if (clientOn) {
    quickActions.push({
      id: "client_request",
      href: "/client-requests/new",
      labelKey: "createClientRequest",
    });
  }
  if (questionnaireOn) {
    quickActions.push({
      id: "questionnaire",
      href: "/questionnaire-assistant",
      labelKey: "openQuestionnaire",
    });
  }
  if (evidenceOn || supplierOn) {
    quickActions.push({
      id: "evidence",
      href: "/supplier-qualification/evidence",
      labelKey: "reviewEvidence",
    });
  }
  if (calendarOn) {
    quickActions.push({
      id: "deadlines",
      href: "/tender-calendar",
      labelKey: "reviewDeadlines",
    });
  }

  // Recent activity from real rows only (no cross-tenant) — loaded in the KPI Promise.all above.
  const recentActivity: WorkspaceActivityItem[] = [];
  for (const doc of recentDocs) {
    recentActivity.push({
      id: `compliance-${doc.id}`,
      kind: "document",
      title: doc.name,
      at: doc.updatedAt.toISOString(),
      href: `/document-compliance/${doc.id}`,
    });
  }
  for (const req of recentReq) {
    recentActivity.push({
      id: `request-${req.id}`,
      kind: "client_request",
      title: req.title,
      at: req.updatedAt.toISOString(),
      href: `/client-requests/${req.id}`,
    });
  }
  for (const m of recentMem) {
    recentActivity.push({
      id: `decision-${m.id}`,
      kind: "decision",
      title: m.title,
      at: m.updatedAt.toISOString(),
      href: `/decision-memory`,
    });
  }
  recentActivity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    companyId,
    kpis,
    complianceStatusSeries,
    activitySeries,
    deadlineSeries,
    hasComplianceHistory: complianceUpdateCount > 1,
    hasActivityHistory: activitySeries.length > 0,
    plan,
    quickActions,
    recentActivity: recentActivity.slice(0, 10),
  };
}
