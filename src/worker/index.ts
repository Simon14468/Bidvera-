import { processJobsOnce } from "@/services/jobs";
import { logInfo } from "@/services/observability";
import { notificationService } from "@/services/notifications";
import { processTenderAnalysis } from "@/modules/tender-analysis";

async function handleSendAlert(job: {
  payload: unknown;
  tenderId: string | null;
}) {
  const payload = job.payload as { alertId?: string };
  if (payload.alertId) {
    await notificationService.dispatchDueAlerts(20);
    return;
  }
  await notificationService.dispatchDueAlerts(40);
}

async function handleScheduleDeadlines(job: {
  payload: unknown;
  tenderId: string | null;
}) {
  const payload = job.payload as { tenderId?: string };
  if (payload.tenderId || job.tenderId) {
    const tenderId = payload.tenderId ?? job.tenderId;
    const { prisma } = await import("@/lib/db");
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId! },
      select: {
        id: true,
        companyId: true,
        title: true,
        deadline: true,
        deadlineTimezone: true,
      },
    });
    if (tender?.deadline) {
      await notificationService.scheduleDeadlineAlerts({
        companyId: tender.companyId,
        tenderId: tender.id,
        deadline: tender.deadline,
        title: tender.title,
        timezone: tender.deadlineTimezone,
      });
    }
    return;
  }
  await notificationService.reconcileDeadlineSchedules(40);
}

async function tick() {
  // Reclaim abandoned RUNNING jobs before claiming new work.
  try {
    const { releaseStaleJobLocks } = await import("@/services/jobs");
    await releaseStaleJobLocks();
  } catch {
    /* non-fatal */
  }

  // Always drain due alerts (idempotent) even when the job queue is idle.
  const delivered = await notificationService.dispatchDueAlerts(25);
  if (delivered > 0) {
    logInfo("notify.worker_dispatched", { delivered });
  }

  try {
    const { markOverdueTeamTasks } = await import("@/services/team-workflow");
    const overdue = await markOverdueTeamTasks(40);
    if (overdue > 0) {
      logInfo("team_workflow.overdue_marked", { overdue });
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { reconcileDueSubscriptions } = await import(
      "@/services/billing/reconcile"
    );
    const expired = await reconcileDueSubscriptions(40);
    if (expired > 0) {
      logInfo("billing.subscriptions_reconciled", { expired });
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { sendDueRenewalReminders } = await import(
      "@/services/billing/renewal-reminders"
    );
    const reminders = await sendDueRenewalReminders(40);
    if (reminders > 0) {
      logInfo("billing.renewal_reminders", { reminders });
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { reconcileDocumentCompliance } = await import(
      "@/modules/document-compliance"
    );
    const result = await reconcileDocumentCompliance(40);
    if (result.reminders > 0 || result.statusUpdates > 0) {
      logInfo("document_compliance.reconciled", result);
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { reconcileTenderCalendar } = await import("@/modules/tender-calendar");
    const result = await reconcileTenderCalendar(40);
    if (result.statusUpdates > 0) {
      logInfo("tender_calendar.reconciled", result);
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { reconcileClientRequestsModule } = await import(
      "@/modules/client-requests"
    );
    const result = await reconcileClientRequestsModule(40);
    if (result.overdueUpdated > 0) {
      logInfo("client_requests.reconciled", result);
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { reconcileMatchingOpportunityLifecycle } = await import(
      "@/modules/matching-engine"
    );
    const result = await reconcileMatchingOpportunityLifecycle(40);
    if (result.expired > 0) {
      logInfo("matching_engine.opportunities_expired", result);
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { reconcileMatchingSponsorshipLifecycle } = await import(
      "@/modules/matching-engine"
    );
    const result = await reconcileMatchingSponsorshipLifecycle(40);
    if (result.expired > 0) {
      logInfo("matching_engine.sponsorships_expired", result);
    }
  } catch {
    /* non-fatal */
  }

  // TED ingest: gated entry only (enabled + workerScheduleAllowed). Both default OFF.
  // Does not enable Matching Engine. No uncontrolled cron.
  try {
    const { runTedOpportunityIngestIfScheduled } = await import(
      "@/modules/matching-engine"
    );
    const ted = await runTedOpportunityIngestIfScheduled();
    if (ted?.ran) {
      logInfo("matching_engine.ted.ingest.worker", {
        upserted: ted.upserted,
        filteredOut: ted.filteredOut,
        fetched: ted.fetched,
      });
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { runScheduledPlatformBackup } = await import("@/services/backup");
    const backup = await runScheduledPlatformBackup();
    if (backup.ran) {
      logInfo("backup.scheduled_run", { id: backup.id });
    }
  } catch {
    /* non-fatal */
  }

  const did = await processJobsOnce({
    RUN_TENDER_ANALYSIS: async (job) => {
      const tenderId =
        (job.payload as { tenderId?: string })?.tenderId ?? job.tenderId;
      if (!tenderId) throw new Error("Missing tenderId");
      await processTenderAnalysis(tenderId);
    },
    PROCESS_TENDER_DOCUMENT: async (job) => {
      const tenderId =
        (job.payload as { tenderId?: string })?.tenderId ?? job.tenderId;
      if (!tenderId) throw new Error("Missing tenderId");
      await processTenderAnalysis(tenderId);
    },
    SEND_ALERT: async (job) => handleSendAlert(job),
    SCHEDULE_DEADLINE_ALERTS: async (job) => handleScheduleDeadlines(job),
    PROCESS_BILLING_WEBHOOK: async (job) => {
      const payload = job.payload as { webhookEventId?: string };
      if (!payload.webhookEventId) return;
      const { prisma } = await import("@/lib/db");
      const row = await prisma.webhookEvent.findUnique({
        where: { id: payload.webhookEventId },
      });
      if (!row || row.status === "PROCESSED" || row.status === "IGNORED") return;
    },
    SEND_EMAIL: async (job) => {
      const rawPayload = job.payload;
      const {
        isAuthMailJobPayload,
        materializeAuthMailJob,
      } = await import("@/services/auth/tokens");
      const { sendEmail } = await import("@/services/email");

      if (isAuthMailJobPayload(rawPayload)) {
        const template = await materializeAuthMailJob(rawPayload);
        const result = await sendEmail(template);
        if (!result.ok) {
          throw new Error(result.error ?? "Email delivery failed");
        }
        return;
      }

      const payload = rawPayload as {
        to?: string;
        subject?: string;
        html?: string;
        text?: string;
      };
      if (!payload.to || !payload.subject || !payload.html) {
        throw new Error("Invalid SEND_EMAIL payload");
      }
      // Legacy direct payloads must not carry auth bearer links.
      if (
        /[?&]token=/.test(payload.html) ||
        (payload.text && /[?&]token=/.test(payload.text))
      ) {
        throw new Error("Refusing SEND_EMAIL payload that embeds auth tokens");
      }
      const result = await sendEmail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Email delivery failed");
      }
    },
  });
  return did || delivered > 0;
}

async function main() {
  logInfo("worker.started", {});
  let reconcileAt = 0;
  let stopping = false;
  const requestStop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logInfo("worker.shutdown", { signal });
  };
  process.on("SIGTERM", () => requestStop("SIGTERM"));
  process.on("SIGINT", () => requestStop("SIGINT"));

  const { touchWorkerHeartbeat } = await import(
    "@/services/production-readiness/worker-heartbeat"
  );
  for (;;) {
    if (stopping) break;
    await touchWorkerHeartbeat().catch(() => undefined);
    const now = Date.now();
    if (now >= reconcileAt) {
      await notificationService.reconcileDeadlineSchedules(20).catch(() => 0);
      reconcileAt = now + 15 * 60 * 1000;
    }
    const did = await tick();
    if (stopping) break;
    if (!did) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  logInfo("worker.stopped", {});
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
