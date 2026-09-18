"use client";

import { pollAnalysisStatusAction, unlockArchiveAction, uploadTenderAction } from "@/app/actions";
import {
  computeWaitBudget,
  evaluatePollStep,
  nextPollIntervalMs,
  SOFT_WAIT_MS,
} from "@/app/(app)/tenders/upload/poll-analysis";
import {
  markTenderNavigation,
  shouldNavigateToTender,
} from "@/app/(app)/tenders/upload/navigation-guard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  buildUploadAcceptAttribute,
} from "@/domain/tender-package/extraction-capabilities";
import type { UploadPhase } from "@/domain/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { FileUp, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UploadCopy = Dictionary["app"]["upload"];

export type UploadLimitHints = {
  maxFilesPerPackage: number;
  maxFileBytes: number;
  maxPackageBytes: number;
};

const ACCEPT_TYPES = buildUploadAcceptAttribute();

function phaseCopy(
  phase: UploadPhase,
  copy: UploadCopy,
): { title: string; body: string } {
  switch (phase) {
    case "idle":
      return { title: copy.phaseIdleTitle, body: copy.phaseIdleBody };
    case "uploading":
      return { title: copy.phaseUploadingTitle, body: copy.phaseUploadingBody };
    case "discovering":
      return { title: copy.phaseDiscoveringTitle, body: copy.phaseDiscoveringBody };
    case "extracting":
      return { title: copy.phaseExtractingTitle, body: copy.phaseExtractingBody };
    case "preparing":
      return { title: copy.phasePreparingTitle, body: copy.phasePreparingBody };
    case "processing":
      return { title: copy.phaseProcessingTitle, body: copy.phaseProcessingBody };
    case "analyzing":
      return { title: copy.phaseAnalyzingTitle, body: copy.phaseAnalyzingBody };
    case "still_processing":
      return { title: copy.phaseTimeoutTitle, body: copy.phaseTimeoutBody };
    case "success":
      return { title: copy.phaseSuccessTitle, body: copy.phaseSuccessBody };
    case "error":
      return { title: copy.phaseErrorTitle, body: copy.phaseErrorBody };
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileStatusLabel(phase: UploadPhase, copy: UploadCopy): string {
  switch (phase) {
    case "uploading":
      return copy.statusUploading;
    case "discovering":
      return copy.statusDiscovering;
    case "extracting":
      return copy.statusExtracting;
    case "preparing":
      return copy.statusPreparing;
    case "processing":
      return copy.statusProcessing;
    case "analyzing":
      return copy.statusAnalyzing;
    case "still_processing":
      return copy.phaseTimeoutTitle;
    case "success":
      return copy.phaseSuccessTitle;
    case "error":
      return copy.phaseErrorTitle;
    default:
      return copy.statusReady;
  }
}

function humanizeUploadError(message: string, copy: UploadCopy, code?: string): string {
  if (code === "ANALYSIS_FAILED" || /Decision Guardian|DEADLINE_/i.test(message)) {
    return message;
  }
  if (/body exceeded|body size limit|1\s*mb limit/i.test(message)) {
    return copy.bodyTooLarge;
  }
  return message;
}

function isAnalysisFailureMessage(message: string): boolean {
  return /Decision Guardian|analysis failed|DEADLINE_|REQUIREMENT_|FIT_|RISK_/i.test(
    message,
  );
}

function intakeUiBanner(
  uiState: string | undefined,
  notices: string[],
  copy: UploadCopy,
): { title: string; body: string; uiState: string } | null {
  if (!uiState && notices.length === 0) return null;
  const body = notices[0] ?? "";
  switch (uiState) {
    case "REPAIRED_AUTOMATICALLY":
      return {
        title: copy.intakeRepairedTitle,
        body: body || copy.intakeRepairedTitle,
        uiState: "REPAIRED_AUTOMATICALLY",
      };
    case "PASSWORD_REQUIRED":
      return {
        title: copy.passwordRequiredTitle,
        body: body || copy.passwordRequiredBody,
        uiState: "PASSWORD_REQUIRED",
      };
    case "USER_ACTION_REQUIRED":
      return {
        title: copy.intakeBlockedTitle,
        body: body || copy.intakeBlockedTitle,
        uiState: "USER_ACTION_REQUIRED",
      };
    case "PARTIALLY_READABLE":
      return {
        title: copy.intakePartiallyReadableTitle,
        body: body || copy.intakePartialTitle,
        uiState: "PARTIALLY_READABLE",
      };
    case "UNSUPPORTED":
      return {
        title: copy.intakeUnsupportedTitle,
        body: body || copy.intakeUnsupportedTitle,
        uiState: "UNSUPPORTED",
      };
    case "CORRUPTED":
      return {
        title: copy.intakeCorruptedTitle,
        body: body || copy.intakeCorruptedTitle,
        uiState: "CORRUPTED",
      };
    case "PACKAGE_INCOMPLETE":
      return {
        title: copy.intakeIncompleteTitle,
        body:
          body ||
          "Readable documents will be analyzed, but the tender package is incomplete.",
        uiState: "PACKAGE_INCOMPLETE",
      };
    case "ANALYSIS_BLOCKED":
      return {
        title: copy.intakeBlockedTitle,
        body: body || copy.intakeBlockedTitle,
        uiState: "ANALYSIS_BLOCKED",
      };
    case "READY_FOR_ANALYSIS":
      return notices.length
        ? { title: copy.intakeReadyTitle, body, uiState: "READY_FOR_ANALYSIS" }
        : null;
    case "PROCESSING":
      return {
        title: copy.phaseProcessingTitle,
        body: body || copy.phaseProcessingBody,
        uiState: "PROCESSING",
      };
    default:
      return notices.length
        ? { title: copy.intakePartialTitle, body, uiState: uiState ?? "UNKNOWN" }
        : null;
  }
}

export function TenderUploadPanel({
  canAnalyze,
  remaining,
  isUnlimited = false,
  copy,
  limits,
}: {
  canAnalyze: boolean;
  remaining: number | null;
  isUnlimited?: boolean;
  copy: UploadCopy;
  limits: UploadLimitHints;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorIsAnalysis, setErrorIsAnalysis] = useState(false);
  const [softNotice, setSoftNotice] = useState<string | null>(null);
  const [intakeBanner, setIntakeBanner] = useState<{
    title: string;
    body: string;
    uiState: string;
  } | null>(null);
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [discoveredFileCount, setDiscoveredFileCount] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileSizeBytes, setFileSizeBytes] = useState(0);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    pendingToken: string;
    fileName: string;
  } | null>(null);
  const [archivePassword, setArchivePassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const uploadInFlight = useRef(false);
  const pollErrorsRef = useRef(0);
  const navigatedRef = useRef(false);

  const fileTypesLabel = useMemo(
    () =>
      copy.fileTypes
        .replaceAll("{max}", String(limits.maxFilesPerPackage))
        .replaceAll("{maxFileMb}", String(Math.floor(limits.maxFileBytes / (1024 * 1024))))
        .replaceAll(
          "{maxPackageMb}",
          String(Math.floor(limits.maxPackageBytes / (1024 * 1024))),
        ),
    [copy.fileTypes, limits.maxFileBytes, limits.maxFilesPerPackage, limits.maxPackageBytes],
  );

  const navigateToTender = useCallback(
    (id: string) => {
      if (!shouldNavigateToTender(navigatedRef.current)) return;
      navigatedRef.current = markTenderNavigation();
      router.push(`/tenders/${id}`);
    },
    [router],
  );

  useEffect(() => {
    if (
      !tenderId ||
      phase === "success" ||
      phase === "error" ||
      phase === "idle"
    ) {
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();
    const waitBudget = computeWaitBudget(fileSizeBytes);
    let intervalId = 0;

    const scheduleNext = (delayMs: number) => {
      window.clearTimeout(intervalId);
      intervalId = window.setTimeout(() => void poll(), delayMs);
    };

    const poll = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > SOFT_WAIT_MS && phase !== "still_processing") {
        setSoftNotice(copy.phaseTimeoutBody);
      }

      const result = await pollAnalysisStatusAction(tenderId);
      if (cancelled) return;

      const step = evaluatePollStep({
        elapsedMs: elapsed,
        waitBudgetMs: waitBudget,
        pollOk: result.ok,
        pollErrorMessage: result.ok ? undefined : result.error.message,
        consecutivePollErrors: pollErrorsRef.current,
        data: result.ok ? result.data : undefined,
      });

      if (step.kind === "success") {
        pollErrorsRef.current = 0;
        setSoftNotice(null);
        setProgress(100);
        setPhase("success");
        navigateToTender(tenderId);
        return;
      }

      if (step.kind === "failed") {
        pollErrorsRef.current = 0;
        setSoftNotice(null);
        setPhase("error");
        setErrorIsAnalysis(true);
        const msg = humanizeUploadError(step.message, copy);
        setError(
          isAnalysisFailureMessage(msg)
            ? `${copy.phaseAnalysisErrorBody}\n\n${msg}`
            : `${copy.phaseAnalysisErrorBody}\n\n${msg}`,
        );
        return;
      }

      if (step.kind === "poll_error") {
        pollErrorsRef.current += 1;
        if (step.exhausted) {
          setPhase("still_processing");
          setSoftNotice(copy.phaseTimeoutBody);
        }
        scheduleNext(nextPollIntervalMs(phase === "still_processing" ? "still_processing" : phase));
        return;
      }

      pollErrorsRef.current = 0;

      if (step.kind === "still_processing") {
        setPhase("still_processing");
        setSoftNotice(copy.phaseTimeoutBody);
        scheduleNext(nextPollIntervalMs("still_processing"));
        return;
      }

      setProgress(step.progress);
      setPhase(step.phase);
      scheduleNext(nextPollIntervalMs(step.phase));
    };

    void poll();

    return () => {
      cancelled = true;
      window.clearTimeout(intervalId);
    };
  }, [tenderId, phase, copy, fileSizeBytes, navigateToTender]);

  const startUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || uploadInFlight.current) return;
      if (files.length > limits.maxFilesPerPackage) {
        setPhase("error");
        setErrorIsAnalysis(false);
        setError(
          copy.maxFilesReached.replaceAll("{max}", String(limits.maxFilesPerPackage)),
        );
        return;
      }
      const totalBytes = files.reduce((n, f) => n + f.size, 0);
      if (totalBytes > limits.maxPackageBytes) {
        setPhase("error");
        setErrorIsAnalysis(false);
        setError(copy.bodyTooLarge);
        return;
      }
      if (!canAnalyze) {
        setPhase("error");
        setErrorIsAnalysis(false);
        setError(copy.creditsExhausted);
        return;
      }

      uploadInFlight.current = true;
      navigatedRef.current = false;
      setError(null);
      setErrorIsAnalysis(false);
      setSoftNotice(null);
      setIntakeBanner(null);
      setDiscoveredFileCount(null);
      setFileSizeBytes(totalBytes);
      setPhase("uploading");
      setProgress(12);

      // Optimistic intake stages while the server discovers/expands the package.
      const stageTimers = [
        window.setTimeout(() => {
          setPhase("discovering");
          setProgress((p) => Math.max(p, 22));
        }, 600),
        window.setTimeout(() => {
          setPhase("extracting");
          setProgress((p) => Math.max(p, 34));
        }, 1400),
        window.setTimeout(() => {
          setPhase("preparing");
          setProgress((p) => Math.max(p, 44));
        }, 2400),
      ];
      const tick = window.setInterval(() => {
        setProgress((p) => (p < 48 ? p + 2 : p));
      }, 160);

      try {
        const fd = new FormData();
        for (const file of files) fd.append("files", file);
        fd.set("idempotencyKey", crypto.randomUUID());
        fd.set("clientFileCount", String(files.length));

        const result = await uploadTenderAction(fd);
        window.clearInterval(tick);
        for (const id of stageTimers) window.clearTimeout(id);
        if (!result.ok) {
          const err = result.error as {
            code?: string;
            message: string;
            userAction?: string;
            pendingToken?: string;
            fileName?: string;
          };
          if (
            (err.code === "ARCHIVE_PASSWORD_REQUIRED" ||
              err.userAction === "ENTER_ARCHIVE_PASSWORD") &&
            err.pendingToken
          ) {
            setPhase("idle");
            setProgress(0);
            setPasswordPrompt({
              pendingToken: err.pendingToken,
              fileName: err.fileName ?? files[0]?.name ?? "archive",
            });
            setArchivePassword("");
            setError(null);
            setErrorIsAnalysis(false);
            return;
          }
          setPhase("error");
          const code = err.code;
          setErrorIsAnalysis(code === "ANALYSIS_FAILED");
          setError(humanizeUploadError(err.message, copy, code));
          return;
        }

        setTenderId(result.data.tenderId);
        if (typeof result.data.discoveredFileCount === "number") {
          setDiscoveredFileCount(result.data.discoveredFileCount);
        }
        const data = result.data as {
          intakeUserNotices?: string[];
          intakeUiState?: string;
          intakeReport?: { userNotices?: string[]; uiState?: string; analysisIncompleteReason?: string | null };
        };
        const notices =
          Array.isArray(data.intakeUserNotices)
            ? data.intakeUserNotices
            : Array.isArray(data.intakeReport?.userNotices)
              ? data.intakeReport!.userNotices!
              : [];
        const uiState = data.intakeUiState ?? data.intakeReport?.uiState;
        const banner = intakeUiBanner(uiState, notices, copy);
        if (banner) {
          setIntakeBanner(banner);
          setSoftNotice(banner.body);
        } else if (notices.length > 0) {
          setSoftNotice(notices[0] ?? null);
        }
        setPhase("processing");
        setProgress(52);
      } catch (err) {
        window.clearInterval(tick);
        for (const id of stageTimers) window.clearTimeout(id);
        const raw = err instanceof Error ? err.message : copy.phaseErrorBody;
        setPhase("error");
        setErrorIsAnalysis(false);
        setError(humanizeUploadError(raw, copy));
      } finally {
        uploadInFlight.current = false;
      }
    },
    [canAnalyze, copy, limits.maxFilesPerPackage, limits.maxPackageBytes],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return;
      if (uploadInFlight.current || phase === "uploading" || phase === "discovering" || phase === "extracting" || phase === "preparing" || phase === "processing" || phase === "analyzing" || phase === "still_processing") {
        setError(copy.waitForUpload);
        setErrorIsAnalysis(false);
        return;
      }
      setError(null);
      setErrorIsAnalysis(false);
      const list = Array.from(incoming);
      setSelectedFiles((prev) => {
        const merged = [...prev];
        for (const file of list) {
          if (merged.length >= limits.maxFilesPerPackage) {
            setError(
              copy.maxFilesReached.replaceAll("{max}", String(limits.maxFilesPerPackage)),
            );
            break;
          }
          const dup = merged.some(
            (f) =>
              f.name === file.name &&
              f.size === file.size &&
              f.lastModified === file.lastModified,
          );
          if (!dup) merged.push(file);
        }
        return merged.slice(0, limits.maxFilesPerPackage);
      });
    },
    [copy.maxFilesReached, copy.waitForUpload, limits.maxFilesPerPackage, phase],
  );

  const removeFileAt = useCallback(
    (index: number) => {
      if (uploadInFlight.current || phase !== "idle") return;
      setError(null);
      setErrorIsAnalysis(false);
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    },
    [phase],
  );

  const submitArchivePassword = useCallback(async () => {
    if (!passwordPrompt || passwordBusy) return;
    setPasswordBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("pendingToken", passwordPrompt.pendingToken);
      fd.set("password", archivePassword);
      // Password stays in FormData only for this request — clear local state after send.
      const result = await unlockArchiveAction(fd);
      setArchivePassword("");
      if (!result.ok) {
        const err = result.error as {
          code?: string;
          message: string;
          retryable?: boolean;
          pendingToken?: string;
        };
        if (
          err.code === "ARCHIVE_WRONG_PASSWORD" ||
          err.retryable ||
          err.code === "ARCHIVE_PASSWORD_REQUIRED"
        ) {
          setError(copy.passwordWrong);
          if (err.pendingToken) {
            setPasswordPrompt((prev) =>
              prev ? { ...prev, pendingToken: err.pendingToken! } : prev,
            );
          }
          return;
        }
        setPasswordPrompt(null);
        setPhase("error");
        setError(humanizeUploadError(err.message, copy, err.code));
        return;
      }
      setPasswordPrompt(null);
      setTenderId(result.data.tenderId);
      if (typeof result.data.discoveredFileCount === "number") {
        setDiscoveredFileCount(result.data.discoveredFileCount);
      }
      const unlockData = result.data as {
        intakeUserNotices?: string[];
        intakeUiState?: string;
        intakeReport?: { userNotices?: string[]; uiState?: string };
      };
      const unlockNotices = Array.isArray(unlockData.intakeUserNotices)
        ? unlockData.intakeUserNotices
        : Array.isArray(unlockData.intakeReport?.userNotices)
          ? unlockData.intakeReport!.userNotices!
          : [];
      const unlockBanner = intakeUiBanner(
        unlockData.intakeUiState ?? unlockData.intakeReport?.uiState,
        unlockNotices,
        copy,
      );
      if (unlockBanner) {
        setIntakeBanner(unlockBanner);
        setSoftNotice(unlockBanner.body);
      }
      setPhase("processing");
      setProgress(52);
    } catch (err) {
      setArchivePassword("");
      setError(err instanceof Error ? err.message : copy.phaseErrorBody);
    } finally {
      setPasswordBusy(false);
    }
  }, [archivePassword, copy, passwordBusy, passwordPrompt]);

  const phaseUi = phaseCopy(phase, copy);
  const busy =
    phase === "uploading" ||
    phase === "discovering" ||
    phase === "extracting" ||
    phase === "preparing" ||
    phase === "processing" ||
    phase === "analyzing" ||
    phase === "still_processing";
  const atMax = selectedFiles.length >= limits.maxFilesPerPackage;
  const statusLabel = fileStatusLabel(phase, copy);
  const errorTitle = errorIsAnalysis || (phase === "error" && tenderId)
    ? copy.phaseAnalysisErrorTitle
    : copy.unableContinue;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{phaseUi.title}</CardTitle>
        <CardDescription>{phaseUi.body}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {passwordPrompt ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-password-title"
            className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
          >
            <h3 id="archive-password-title" className="text-sm font-semibold text-foreground">
              {copy.passwordRequiredTitle}
            </h3>
            <p className="mt-1 text-sm text-muted">{copy.passwordRequiredBody}</p>
            <p className="mt-2 truncate text-xs text-muted">{passwordPrompt.fileName}</p>
            <label className="mt-4 block text-sm font-medium text-foreground">
              {copy.passwordLabel}
              <input
                type="password"
                autoComplete="off"
                name="archive-password"
                value={archivePassword}
                onChange={(e) => setArchivePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitArchivePassword();
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                disabled={passwordBusy}
              />
            </label>
            {error ? (
              <p className="mt-2 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={passwordBusy || !archivePassword}
                onClick={() => void submitArchivePassword()}
              >
                {copy.passwordSubmit}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={passwordBusy}
                onClick={() => {
                  setPasswordPrompt(null);
                  setArchivePassword("");
                  setError(null);
                }}
              >
                {copy.passwordCancel}
              </Button>
            </div>
          </div>
        ) : null}

        {!canAnalyze ? (
          <Alert variant="warning" title={copy.trialUsedTitle}>
            {copy.trialUsedBody}{" "}
            <Link href="/upgrade" className="font-medium text-primary hover:underline">
              {copy.viewPlans}
            </Link>
          </Alert>
        ) : (
          <p className="text-sm text-muted">
            {isUnlimited
              ? copy.unlimitedPlan
              : copy.remainingAnalyses.replaceAll("{count}", String(remaining ?? 0))}
          </p>
        )}

        {!busy ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center transition-all duration-200 ${
              dragOver
                ? "border-primary bg-primary-muted scale-[1.01]"
                : "border-border bg-background"
            }`}
          >
            <UploadCloud className="size-8 text-primary" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">{copy.dragHere}</p>
            <p className="mt-1 text-sm text-muted">{fileTypesLabel}</p>
            <p className="mt-2 text-xs font-medium text-muted">
              {discoveredFileCount != null
                ? copy.filesDiscovered.replaceAll("{count}", String(discoveredFileCount))
                : copy.filesSelected.replaceAll("{count}", String(selectedFiles.length))}
            </p>
            <label className="mt-5">
              <input
                type="file"
                className="sr-only"
                multiple
                accept={ACCEPT_TYPES}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                disabled={!canAnalyze || atMax}
              />
              <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-card hover:shadow-[var(--shadow-soft)] active:scale-[0.98]">
                <UploadCloud className="size-4 text-primary" aria-hidden />
                {copy.chooseFile}
              </span>
            </label>
          </div>
        ) : null}

        {selectedFiles.length > 0 ? (
          <ul className="space-y-2 animate-fade-in">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm"
              >
                <FileUp className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted">
                    {formatBytes(file.size)}
                    {busy ? ` · ${statusLabel}` : ""}
                  </p>
                </div>
                {!busy ? (
                  <button
                    type="button"
                    className="rounded-lg p-1 text-muted hover:bg-background hover:text-foreground"
                    aria-label={copy.removeFile}
                    onClick={() => removeFileAt(index)}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {!busy && selectedFiles.length > 0 && canAnalyze ? (
          <Button
            onClick={() => void startUpload(selectedFiles)}
            className="w-full sm:w-auto"
          >
            {copy.startUpload}
          </Button>
        ) : null}

        {phase !== "idle" && phase !== "error" ? (
          <div className="animate-fade-in space-y-2">
            <Progress value={progress} label={phaseUi.title} />
            {phase === "success" ? (
              <p className="text-sm font-medium text-success">{copy.decisionReady}</p>
            ) : null}
          </div>
        ) : null}

        {phase === "still_processing" && tenderId ? (
          <Alert variant="warning" title={copy.phaseTimeoutTitle}>
            {copy.phaseTimeoutBody}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigateToTender(tenderId)}>
                {copy.openTender}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPhase("idle");
                  setProgress(0);
                  setSelectedFiles([]);
                  setError(null);
                  setErrorIsAnalysis(false);
                  setSoftNotice(null);
                  setIntakeBanner(null);
                  setTenderId(null);
                  setDiscoveredFileCount(null);
                  setFileSizeBytes(0);
                  pollErrorsRef.current = 0;
                }}
              >
                {copy.uploadAnother}
              </Button>
            </div>
          </Alert>
        ) : null}

        {(intakeBanner || softNotice) &&
        phase !== "success" &&
        phase !== "error" &&
        phase !== "still_processing" ? (
          <Alert
            variant={
              intakeBanner?.uiState === "ANALYSIS_BLOCKED" ||
              intakeBanner?.uiState === "CORRUPTED" ||
              intakeBanner?.uiState === "UNSUPPORTED"
                ? "danger"
                : "warning"
            }
            title={intakeBanner?.title ?? copy.intakePartialTitle}
            data-intake-ui-state={intakeBanner?.uiState ?? undefined}
          >
            {intakeBanner?.body ?? softNotice}
            {tenderId ? (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateToTender(tenderId)}
                >
                  {copy.openTender}
                </Button>
              </div>
            ) : null}
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="danger" title={errorTitle}>
            <span className="whitespace-pre-line">{error}</span>
          </Alert>
        ) : null}

        {phase === "success" && tenderId ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigateToTender(tenderId)}>
              {copy.openDecision}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPhase("idle");
                setProgress(0);
                setSelectedFiles([]);
                setError(null);
                setErrorIsAnalysis(false);
                setSoftNotice(null);
                setIntakeBanner(null);
                setTenderId(null);
                setFileSizeBytes(0);
              }}
            >
              {copy.uploadAnother}
            </Button>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="flex flex-wrap gap-3">
            {tenderId ? (
              <Button onClick={() => navigateToTender(tenderId)}>
                {copy.openTender}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                setPhase("idle");
                setError(null);
                setErrorIsAnalysis(false);
                setSoftNotice(null);
                setIntakeBanner(null);
                setProgress(0);
                setTenderId(null);
                setFileSizeBytes(0);
                uploadInFlight.current = false;
              }}
            >
              {copy.tryAgain}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
