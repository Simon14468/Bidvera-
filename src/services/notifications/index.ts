import { prisma } from "@/lib/db";
import { enqueueJob } from "@/services/jobs";
import { logError, logInfo } from "@/services/observability";
import { OUTBOUND_CHANNELS } from "@/services/notifications/channels";
import {
  getCompanyNotificationPrefs,
  prefersAlertType,
  type NotificationPrefs,
} from "@/services/notifications/prefs";
import type { AlertType } from "@prisma/client";
import { Prisma } from "@prisma/client";

export interface NotificationService {
  createInAppAlert(input: {
    companyId: string;
    tenderId?: string | null;
    type: AlertType;
    title: string;
    message: string;
    href?: string | null;
    scheduledFor?: Date | null;
    dedupeKey?: string | null;
    /** Optional primary recipient (assignee/verifier) — still tenant-scoped */
    targetUserId?: string | null;
  }): Promise<void>;
  scheduleDeadlineAlerts(input: {
    companyId: string;
    tenderId: string;
    deadline: Date;
    title: string;
    timezone?: string | null;
  }): Promise<void>;
  listCompanyAlerts(companyId: string): Promise<
    Array<{
      id: string;
      type: AlertType;
      title: string;
      message: string;
      href: string | null;
      status: string;
      createdAt: Date;
      scheduledFor: Date | null;
      tenderId: string | null;
      emailSentAt: Date | null;
    }>
  >;
  countUnread(companyId: string): Promise<number>;
  markRead(companyId: string, alertId: string): Promise<void>;
  markAllRead(companyId: string): Promise<number>;
  /** Deliver due SCHEDULED alerts (idempotent claim). */
  dispatchDueAlerts(limit?: number): Promise<number>;
  /** Reconcile deadline schedules for active tenders. */
  reconcileDeadlineSchedules(limit?: number): Promise<number>;
}

const DEADLINE_OFFSETS = [
  { key: "7d", ms: 7 * 24 * 60 * 60 * 1000, pref: "deadlineAlert7d" as const, label: "7 days" },
  { key: "3d", ms: 3 * 24 * 60 * 60 * 1000, pref: "deadlineAlert3d" as const, label: "3 days" },
  { key: "24h", ms: 24 * 60 * 60 * 1000, pref: "deadlineAlert24h" as const, label: "24 hours" },
  { key: "passed", ms: 0, pref: "deadlineAlertPassed" as const, label: "passed" },
];

class ModularNotificationService implements NotificationService {
  async createInAppAlert(input: {
    companyId: string;
    tenderId?: string | null;
    type: AlertType;
    title: string;
    message: string;
    href?: string | null;
    scheduledFor?: Date | null;
    dedupeKey?: string | null;
    targetUserId?: string | null;
  }) {
    const prefs = await getCompanyNotificationPrefs(input.companyId);
    if (!prefs.inAppEnabled && !prefs.emailEnabled) return;
    if (!prefersAlertType(prefs, input.type)) return;

    const now = new Date();
    const scheduledFor = input.scheduledFor ?? now;
    const isFuture = scheduledFor.getTime() > now.getTime() + 5_000;

    if (input.dedupeKey) {
      const existing = await prisma.alert.findUnique({
        where: { dedupeKey: input.dedupeKey },
      });
      if (existing) {
        // Already delivered or read — never duplicate
        if (existing.status === "SENT" || existing.status === "READ") {
          return;
        }
        // Still scheduled — refresh canonical copy (same source facts)
        if (existing.status === "SCHEDULED") {
          await prisma.alert.update({
            where: { id: existing.id },
            data: {
              title: input.title,
              message: input.message,
              href: input.href ?? null,
              scheduledFor,
              type: input.type,
              targetUserId: input.targetUserId ?? existing.targetUserId,
              lastError: null,
            },
          });
          return;
        }
        // CANCELLED / DISMISSED — re-arm only if prefs now allow (anti-spam: same key)
        if (existing.status === "CANCELLED" || existing.status === "DISMISSED") {
          await prisma.alert.update({
            where: { id: existing.id },
            data: {
              title: input.title,
              message: input.message,
              href: input.href ?? null,
              scheduledFor,
              type: input.type,
              targetUserId: input.targetUserId ?? null,
              status: "SCHEDULED",
              sentAt: null,
              readAt: null,
              emailSentAt: null,
              lastError: null,
              attemptCount: 0,
            },
          });
          if (!isFuture) {
            await this.deliverAlert(existing.id, prefs);
          } else {
            await enqueueJob({
              companyId: input.companyId,
              tenderId: input.tenderId ?? null,
              type: "SEND_ALERT",
              payload: { alertId: existing.id },
              idempotencyKey: `send-alert:${existing.id}`,
              availableAt: scheduledFor,
            });
          }
          return;
        }
      }
    }

    let alert;
    try {
      alert = await prisma.alert.create({
        data: {
          companyId: input.companyId,
          tenderId: input.tenderId ?? null,
          type: input.type,
          title: input.title,
          message: input.message,
          href: input.href ?? null,
          dedupeKey: input.dedupeKey ?? null,
          targetUserId: input.targetUserId ?? null,
          scheduledFor,
          status: "SCHEDULED",
          sentAt: null,
        },
      });
    } catch (error) {
      // Concurrent create with same dedupeKey — treat as idempotent success
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        input.dedupeKey
      ) {
        logInfo("notify.dedupe_race", { dedupeKey: input.dedupeKey });
        return;
      }
      throw error;
    }

    if (!isFuture) {
      await this.deliverAlert(alert.id, prefs);
    } else {
      await enqueueJob({
        companyId: input.companyId,
        tenderId: input.tenderId ?? null,
        type: "SEND_ALERT",
        payload: { alertId: alert.id },
        idempotencyKey: `send-alert:${alert.id}`,
        availableAt: scheduledFor,
      });
    }
  }

  async scheduleDeadlineAlerts(input: {
    companyId: string;
    tenderId: string;
    deadline: Date;
    title: string;
    timezone?: string | null;
  }) {
    const prefs = await getCompanyNotificationPrefs(input.companyId);
    const tz = input.timezone?.trim() || prefs.timezone || "UTC";
    const now = Date.now();
    const deadlineMs = input.deadline.getTime();

    for (const offset of DEADLINE_OFFSETS) {
      if (!prefs[offset.pref]) continue;

      const whenMs = deadlineMs - offset.ms;
      const when = new Date(offset.key === "passed" ? deadlineMs : whenMs);
      if (offset.key !== "passed" && when.getTime() <= now) continue;

      const isPassed = offset.key === "passed";
      const title = isPassed
        ? "Deadline passed"
        : `Deadline in ${offset.label}`;
      const message = isPassed
        ? `"${input.title}" deadline has passed (${formatInTimezone(input.deadline, tz)}).`
        : `"${input.title}" closes in ${offset.label} (${formatInTimezone(input.deadline, tz)}).`;

      await this.createInAppAlert({
        companyId: input.companyId,
        tenderId: input.tenderId,
        type: isPassed ? "DEADLINE_PASSED" : "DEADLINE_APPROACHING",
        title,
        message,
        href: `/tenders/${input.tenderId}`,
        scheduledFor: when,
        dedupeKey: `${input.companyId}:${input.tenderId}:deadline:${offset.key}`,
      });
    }

    await enqueueJob({
      companyId: input.companyId,
      tenderId: input.tenderId,
      type: "SCHEDULE_DEADLINE_ALERTS",
      payload: { tenderId: input.tenderId },
      idempotencyKey: `reconcile-deadline:${input.tenderId}:${deadlineMs}`,
      availableAt: new Date(deadlineMs + 60_000),
    });
  }

  async listCompanyAlerts(companyId: string) {
    const prefs = await getCompanyNotificationPrefs(companyId);
    if (!prefs.inAppEnabled) return [];

    return prisma.alert.findMany({
      where: {
        companyId,
        status: { in: ["SENT", "READ"] },
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        href: true,
        status: true,
        createdAt: true,
        scheduledFor: true,
        tenderId: true,
        emailSentAt: true,
      },
    });
  }

  async countUnread(companyId: string): Promise<number> {
    const prefs = await getCompanyNotificationPrefs(companyId);
    if (!prefs.inAppEnabled) return 0;
    return prisma.alert.count({
      where: { companyId, status: "SENT" },
    });
  }

  async markRead(companyId: string, alertId: string) {
    await prisma.alert.updateMany({
      where: { id: alertId, companyId, status: { in: ["SENT", "SCHEDULED"] } },
      data: { status: "READ", readAt: new Date() },
    });
  }

  async markAllRead(companyId: string): Promise<number> {
    const result = await prisma.alert.updateMany({
      where: { companyId, status: "SENT" },
      data: { status: "READ", readAt: new Date() },
    });
    return result.count;
  }

  async dispatchDueAlerts(limit = 40): Promise<number> {
    const now = new Date();
    const due = await prisma.alert.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    let delivered = 0;
    for (const alert of due) {
      try {
        const prefs = await getCompanyNotificationPrefs(alert.companyId);
        const ok = await this.deliverAlert(alert.id, prefs);
        if (ok) delivered += 1;
      } catch (error) {
        logError("notify.dispatch_failed", {
          alertId: alert.id,
          message: error instanceof Error ? error.message : String(error),
        });
        const nextAttempt = alert.attemptCount + 1;
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            attemptCount: { increment: 1 },
            lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
            // Exponential backoff; stop pushing schedule after 5 attempts
            scheduledFor:
              nextAttempt >= 5
                ? alert.scheduledFor
                : new Date(Date.now() + Math.min(300_000, 2 ** alert.attemptCount * 2000)),
          },
        });
      }
    }
    return delivered;
  }

  async reconcileDeadlineSchedules(limit = 30): Promise<number> {
    const tenders = await prisma.tender.findMany({
      where: {
        deadline: { not: null },
        analysisStatus: "COMPLETED",
        status: { in: ["ACTIVE", "DRAFT"] },
      },
      select: {
        id: true,
        companyId: true,
        title: true,
        deadline: true,
        deadlineTimezone: true,
      },
      orderBy: { deadline: "asc" },
      take: limit,
    });

    for (const t of tenders) {
      if (!t.deadline) continue;
      await this.scheduleDeadlineAlerts({
        companyId: t.companyId,
        tenderId: t.id,
        deadline: t.deadline,
        title: t.title,
        timezone: t.deadlineTimezone,
      });
    }
    return tenders.length;
  }

  private async deliverAlert(
    alertId: string,
    prefs: NotificationPrefs,
  ): Promise<boolean> {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert || alert.status !== "SCHEDULED") return false;

    if (!prefersAlertType(prefs, alert.type)) {
      await prisma.alert.updateMany({
        where: { id: alertId, status: "SCHEDULED" },
        data: { status: "CANCELLED", sentAt: new Date() },
      });
      return true;
    }

    // In-app only: mark SENT without outbound channels
    if (!prefs.inAppEnabled && !prefs.emailEnabled) {
      await prisma.alert.updateMany({
        where: { id: alertId, status: "SCHEDULED" },
        data: { status: "CANCELLED", sentAt: new Date() },
      });
      return true;
    }

    const stakeholders = await prisma.user.findMany({
      where: { companyId: alert.companyId, role: { in: ["OWNER", "ADMIN"] } },
      select: { id: true, email: true, name: true },
      take: 10,
    });

    const recipients = [...stakeholders];
    if (alert.targetUserId) {
      const target = await prisma.user.findFirst({
        where: {
          id: alert.targetUserId,
          companyId: alert.companyId,
          role: { in: ["OWNER", "ADMIN", "MEMBER"] },
        },
        select: { id: true, email: true, name: true },
      });
      if (target && !recipients.some((r) => r.id === target.id)) {
        recipients.push(target);
      }
    }

    // Canonical payload — same title/message/href shown in the dashboard
    const message = {
      title: alert.title,
      message: alert.message,
      href: alert.href,
      companyId: alert.companyId,
      recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
      alertType: alert.type,
    };

    const enabled = OUTBOUND_CHANNELS.filter((c) => c.isEnabled(prefs));
    let emailDelivered = false;
    for (const channel of enabled) {
      try {
        const result = await channel.deliver(message, prefs);
        if (channel.key === "email") {
          // Channel may return void or a result — treat throw as failure
          emailDelivered = result === undefined ? true : Boolean(result);
        }
      } catch (error) {
        logError("notify.channel_failed", {
          channel: channel.key,
          alertId,
          message: error instanceof Error ? error.message.slice(0, 200) : String(error),
        });
        if (channel.key === "email") emailDelivered = false;
      }
    }

    const claimed = await prisma.alert.updateMany({
      where: { id: alertId, status: "SCHEDULED" },
      data: {
        // If in-app disabled but email sent, still mark SENT so state is consistent
        // and listCompanyAlerts can hide when in-app off (list checks prefs).
        status: prefs.inAppEnabled || emailDelivered ? "SENT" : "CANCELLED",
        sentAt: new Date(),
        emailSentAt: emailDelivered ? new Date() : null,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count !== 1) return false;

    logInfo("notify.delivered", {
      alertId,
      channels: enabled.map((c) => c.key),
      emailSent: emailDelivered,
    });
    return true;
  }
}

function formatInTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export const notificationService: NotificationService = new ModularNotificationService();
