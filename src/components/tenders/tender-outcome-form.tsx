"use client";

import { recordTenderOutcomeAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  OUTCOME_LABELS,
  OUTCOME_REASON_CODES,
  RECOMMENDATION_EVALUATION_LABELS,
  isTerminalOutcome,
  lifecycleBucket,
  type DecisionOutcomeValue,
  type RecommendationEvaluation,
} from "@/domain/decision-outcome-learning";
import type { DecisionOutcomeView } from "@/domain/decision-outcome-learning";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const RECORDABLE_OUTCOMES: DecisionOutcomeValue[] = [
  "PENDING",
  "WON",
  "LOST",
  "WITHDRAWN",
  "CANCELLED",
  "NOT_SUBMITTED",
];

const REASON_OPTIONS = OUTCOME_REASON_CODES.map((code) => ({
  value: code,
  label: code.replace(/_/g, " "),
}));

const HUMAN_DECISIONS = [
  { value: "", label: "Not specified" },
  { value: "BID", label: "GO — Bid" },
  { value: "REVIEW", label: "Conditional GO — Review" },
  { value: "NO_BID", label: "NO-BID" },
];

export function TenderOutcomeForm({
  tenderId,
  current,
  canEdit,
  attachmentOptions = [],
}: {
  tenderId: string;
  current: DecisionOutcomeView | null;
  canEdit: boolean;
  attachmentOptions?: Array<{ id: string; fileName: string }>;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<DecisionOutcomeValue | "">(
    current?.outcome ?? "",
  );
  const [outcomeDate, setOutcomeDate] = useState(
    current?.outcomeDate ? current.outcomeDate.slice(0, 10) : "",
  );
  const [reasonCode, setReasonCode] = useState(current?.reasonCode ?? "");
  const [reasonDetail, setReasonDetail] = useState(current?.reasonDetail ?? "");
  const [humanFinalDecision, setHumanFinalDecision] = useState(
    current?.humanFinalDecision ?? "",
  );
  const [attachmentDocumentId, setAttachmentDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsDate = outcome === "WON" || outcome === "LOST";
  const showReason = outcome === "WON" || outcome === "LOST";
  const currentTerminal =
    current?.outcome != null && isTerminalOutcome(lifecycleBucket(current.outcome));

  const evaluationLabel = useMemo(() => {
    const ev = current?.recommendationEvaluation;
    if (!ev) return null;
    return RECOMMENDATION_EVALUATION_LABELS[ev as RecommendationEvaluation];
  }, [current?.recommendationEvaluation]);

  if (!canEdit && !current?.outcome) return null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Decision outcome</h2>
          <p className="mt-1 text-xs text-muted">
            Record the real-world result after your bid process completes. User notes
            and attachments are company-provided context only — never AI tender evidence.
            Outcomes enrich Decision Memory — advisory only; they never change scores.
          </p>
        </div>

        {current?.outcome && !canEdit ? (
          <OutcomeSummary view={current} evaluationLabel={evaluationLabel} />
        ) : null}

        {canEdit ? (
          <div className="space-y-3">
            <Select
              label="Actual outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as DecisionOutcomeValue)}
              disabled={pending}
              options={[
                { value: "", label: "Select outcome…" },
                ...RECORDABLE_OUTCOMES.map((v) => ({
                  value: v,
                  label: OUTCOME_LABELS[v],
                })),
              ]}
            />
            {currentTerminal && outcome === "PENDING" ? (
              <p className="text-xs text-warning">
                Reverting to Pending requires explicit confirmation below.
              </p>
            ) : null}
            <Select
              label="Human final decision (optional)"
              value={humanFinalDecision}
              onChange={(e) => setHumanFinalDecision(e.target.value)}
              disabled={pending}
              options={HUMAN_DECISIONS}
            />
            {needsDate ? (
              <Input
                label="Outcome date"
                type="date"
                value={outcomeDate}
                onChange={(e) => setOutcomeDate(e.target.value)}
                disabled={pending}
              />
            ) : null}
            {showReason ? (
              <>
                <Select
                  label="Reason category (optional)"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  disabled={pending}
                  options={[
                    { value: "", label: "Select reason…" },
                    ...REASON_OPTIONS,
                  ]}
                />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Notes (optional — user-provided)</span>
                  <textarea
                    className="min-h-[72px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    disabled={pending}
                    maxLength={2000}
                  />
                </label>
              </>
            ) : null}
            {attachmentOptions.length > 0 ? (
              <Select
                label="Supporting document (optional)"
                value={attachmentDocumentId}
                onChange={(e) => setAttachmentDocumentId(e.target.value)}
                disabled={pending}
                options={[
                  { value: "", label: "None" },
                  ...attachmentOptions.map((d) => ({
                    value: d.id,
                    label: d.fileName,
                  })),
                ]}
              />
            ) : null}
            <Button
              type="button"
              disabled={pending || !outcome || (needsDate && !outcomeDate)}
              onClick={() => {
                if (!outcome) return;
                setError(null);
                const allowReversal =
                  currentTerminal && lifecycleBucket(outcome) === "PENDING";
                startTransition(async () => {
                  const res = await recordTenderOutcomeAction({
                    tenderId,
                    outcome,
                    outcomeDate: needsDate ? outcomeDate : null,
                    reasonCode: reasonCode || null,
                    reasonDetail: reasonDetail.trim() || null,
                    humanFinalDecision:
                      (humanFinalDecision as "BID" | "REVIEW" | "NO_BID" | "") ||
                      null,
                    attachmentDocumentId: attachmentDocumentId || null,
                    idempotencyKey: `outcome:${tenderId}:${outcome}:${outcomeDate || "na"}`,
                    allowReversal,
                  });
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              {pending ? "Saving…" : current?.outcome ? "Update outcome" : "Save outcome"}
            </Button>
          </div>
        ) : current?.outcome ? (
          <OutcomeSummary view={current} evaluationLabel={evaluationLabel} />
        ) : null}

        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function OutcomeSummary({
  view,
  evaluationLabel,
}: {
  view: DecisionOutcomeView;
  evaluationLabel: string | null;
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted">Bidvera recommendation</dt>
        <dd className="font-medium">{view.bidveraDecisionLabel}</dd>
      </div>
      {view.humanFinalDecisionLabel ? (
        <div>
          <dt className="text-xs text-muted">Human final decision</dt>
          <dd className="font-medium">{view.humanFinalDecisionLabel}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs text-muted">Actual outcome</dt>
        <dd className="font-medium">{view.outcomeLabel}</dd>
      </div>
      {view.outcomeDate ? (
        <div>
          <dt className="text-xs text-muted">Outcome date</dt>
          <dd>{view.outcomeDate.slice(0, 10)}</dd>
        </div>
      ) : null}
      {view.reasonDetail || view.reasonCode ? (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted">Outcome reason / notes</dt>
          <dd>{view.reasonDetail ?? view.reasonCode}</dd>
        </div>
      ) : null}
      {view.attachmentFileName ? (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted">Supporting document</dt>
          <dd>{view.attachmentFileName}</dd>
        </div>
      ) : null}
      {evaluationLabel ? (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted">Recommendation vs outcome</dt>
          <dd>{evaluationLabel}</dd>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <p className="text-xs text-muted">{view.userEvidenceDisclaimer}</p>
      </div>
    </dl>
  );
}
