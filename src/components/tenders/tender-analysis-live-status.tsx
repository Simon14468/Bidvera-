"use client";

import { pollAnalysisStatusAction } from "@/app/actions";
import {
  canStartPollRequest,
  evaluateLiveStatusPollStep,
  shouldStartLiveStatusPolling,
} from "@/application/tender-live-status-poll";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type TenderAnalysisLiveStatusLabels = {
  backToTenders: string;
  unknownClient: string;
  analysisInProgressTitle: string;
  analysisInProgressBody: string;
};

type Props = {
  tenderId: string;
  initialStatus: string;
  title: string;
  clientName: string | null;
  labels: TenderAnalysisLiveStatusLabels;
};

/**
 * SSR renders the initial in-progress shell; this client layer polls the
 * authoritative analysis status and refreshes when a terminal state is reached.
 */
export function TenderAnalysisLiveStatus({
  tenderId,
  initialStatus,
  title,
  clientName,
  labels,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const statusRef = useRef(initialStatus);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const terminalReachedRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const timeoutRef = useRef<number>(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!shouldStartLiveStatusPolling("in_progress")) return;

    cancelledRef.current = false;
    terminalReachedRef.current = false;
    consecutiveErrorsRef.current = 0;
    startedAtRef.current = Date.now();

    const scheduleNext = (delayMs: number) => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        void runPoll();
      }, delayMs);
    };

    const runPoll = async () => {
      if (
        !canStartPollRequest({
          cancelled: cancelledRef.current,
          inFlight: inFlightRef.current,
          terminalReached: terminalReachedRef.current,
        })
      ) {
        return;
      }

      inFlightRef.current = true;
      const elapsedMs = Date.now() - startedAtRef.current;

      try {
        const result = await pollAnalysisStatusAction(tenderId);
        if (cancelledRef.current) return;

        const step = evaluateLiveStatusPollStep({
          elapsedMs,
          pollOk: result.ok,
          pollErrorMessage: result.ok ? undefined : result.error.message,
          consecutivePollErrors: consecutiveErrorsRef.current,
          previousStatus: statusRef.current,
          data: result.ok ? result.data : undefined,
        });

        if (step.kind === "terminal") {
          terminalReachedRef.current = true;
          consecutiveErrorsRef.current = 0;
          setStatus(step.status);
          statusRef.current = step.status;
          router.refresh();
          return;
        }

        if (step.kind === "poll_error") {
          consecutiveErrorsRef.current += 1;
          scheduleNext(step.intervalMs);
          return;
        }

        consecutiveErrorsRef.current = 0;
        if (step.status !== statusRef.current) {
          setStatus(step.status);
          statusRef.current = step.status;
        }
        scheduleNext(step.intervalMs);
      } finally {
        inFlightRef.current = false;
      }
    };

    void runPoll();

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(timeoutRef.current);
    };
  }, [tenderId, router]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <div>
        <Link
          href="/tenders"
          className="text-sm text-muted transition hover:text-foreground"
        >
          {labels.backToTenders}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {clientName ?? labels.unknownClient}
        </p>
      </div>
      <Alert variant="warning" title={labels.analysisInProgressTitle}>
        {labels.analysisInProgressBody.replaceAll("{status}", status)}
      </Alert>
    </div>
  );
}

/**
 * Headless poller for other in-progress surfaces (e.g. report not-ready).
 * Mount only while analysis is non-terminal.
 */
export function TenderAnalysisStatusRefresher({
  tenderId,
}: {
  tenderId: string;
}) {
  const router = useRouter();
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const terminalReachedRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const timeoutRef = useRef<number>(0);
  const startedAtRef = useRef(0);
  const previousStatusRef = useRef("PROCESSING");

  useEffect(() => {
    if (!shouldStartLiveStatusPolling("in_progress")) return;

    cancelledRef.current = false;
    terminalReachedRef.current = false;
    consecutiveErrorsRef.current = 0;
    startedAtRef.current = Date.now();

    const scheduleNext = (delayMs: number) => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        void runPoll();
      }, delayMs);
    };

    const runPoll = async () => {
      if (
        !canStartPollRequest({
          cancelled: cancelledRef.current,
          inFlight: inFlightRef.current,
          terminalReached: terminalReachedRef.current,
        })
      ) {
        return;
      }

      inFlightRef.current = true;
      const elapsedMs = Date.now() - startedAtRef.current;

      try {
        const result = await pollAnalysisStatusAction(tenderId);
        if (cancelledRef.current) return;

        const step = evaluateLiveStatusPollStep({
          elapsedMs,
          pollOk: result.ok,
          pollErrorMessage: result.ok ? undefined : result.error.message,
          consecutivePollErrors: consecutiveErrorsRef.current,
          previousStatus: previousStatusRef.current,
          data: result.ok ? result.data : undefined,
        });

        if (step.kind === "terminal") {
          terminalReachedRef.current = true;
          consecutiveErrorsRef.current = 0;
          previousStatusRef.current = step.status;
          router.refresh();
          return;
        }

        if (step.kind === "poll_error") {
          consecutiveErrorsRef.current += 1;
          scheduleNext(step.intervalMs);
          return;
        }

        consecutiveErrorsRef.current = 0;
        previousStatusRef.current = step.status;
        scheduleNext(step.intervalMs);
      } finally {
        inFlightRef.current = false;
      }
    };

    void runPoll();

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(timeoutRef.current);
    };
  }, [tenderId, router]);

  return null;
}
