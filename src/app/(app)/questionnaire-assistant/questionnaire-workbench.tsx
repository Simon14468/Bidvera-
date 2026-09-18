"use client";

import type {
  QuestionnairePackDto,
  QuestionnaireQuestionDto,
} from "@/modules/questionnaire-assistant";
import {
  DraftStatusBadge,
  MandatoryBadge,
  QuestionTypeBadge,
} from "@/modules/questionnaire-assistant/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

type TenderMeta = {
  id: string;
  title: string;
  client: string | null;
};

function provenanceLine(q: QuestionnaireQuestionDto): string {
  const bits = [q.sourceDocumentName];
  if (q.sourcePage != null) bits.push(`p.${q.sourcePage}`);
  if (q.sourceSheet) bits.push(`sheet: ${q.sourceSheet}`);
  if (q.sourceSlide != null) bits.push(`slide ${q.sourceSlide}`);
  if (q.sourceSection) bits.push(q.sourceSection);
  if (q.sourceCell) bits.push(q.sourceCell);
  return bits.join(" · ");
}

function displayAnswer(q: QuestionnaireQuestionDto): string | null {
  const d = q.draft;
  if (!d) return null;
  if (d.status === "EDITED" && d.editedText) return d.editedText;
  return d.draftText;
}

export function QuestionnaireWorkbench({
  tender,
  initialPack,
}: {
  tender: TenderMeta;
  initialPack: QuestionnairePackDto | null;
}) {
  const [pack, setPack] = useState(initialPack);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const questions = useMemo(() => {
    if (!pack) return [] as QuestionnaireQuestionDto[];
    if (pack.sections.length > 0) {
      const sectioned = pack.sections.flatMap((s) => s.questions);
      const sectionIds = new Set(sectioned.map((q) => q.id));
      const orphans = pack.questions.filter((q) => !sectionIds.has(q.id));
      return [...sectioned, ...orphans];
    }
    return pack.questions;
  }, [pack]);

  const stats = useMemo(() => {
    let verify = 0;
    let approved = 0;
    let drafted = 0;
    for (const q of questions) {
      const s = q.draft?.status;
      if (!s) continue;
      drafted += 1;
      if (s === "VERIFY") verify += 1;
      if (s === "APPROVED" || s === "EDITED") approved += 1;
    }
    return { verify, approved, drafted, total: questions.length };
  }, [questions]);

  async function extract(force = false) {
    setError(null);
    setBusyKey("extract");
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/questionnaire-assistant/tenders/${tender.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not extract questionnaires.");
          return;
        }
        setPack(data.pack);
      } finally {
        setBusyKey(null);
      }
    });
  }

  async function generateDrafts() {
    if (!pack) return;
    setError(null);
    setBusyKey("draft");
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/questionnaire-assistant/packs/${pack.id}/draft`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not generate draft answers.");
          return;
        }
        setPack(data.pack);
      } finally {
        setBusyKey(null);
      }
    });
  }

  async function review(
    questionId: string,
    action: "approve" | "reject" | "edit",
    editedText?: string,
  ) {
    setError(null);
    setBusyKey(questionId);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/questionnaire-assistant/questions/${questionId}/review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, editedText }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not update draft.");
          return;
        }
        const updated = data.question as QuestionnaireQuestionDto;
        setPack((prev) => {
          if (!prev) return prev;
          const mapQ = (q: QuestionnaireQuestionDto) =>
            q.id === updated.id ? updated : q;
          return {
            ...prev,
            questions: prev.questions.map(mapQ),
            sections: prev.sections.map((s) => ({
              ...s,
              questions: s.questions.map(mapQ),
            })),
          };
        });
        setEditingId(null);
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/questionnaire-assistant"
            className="text-sm text-primary hover:underline"
          >
            ← Questionnaire Assistant
          </Link>
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">
            Questionnaire Assistant
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{tender.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {tender.client ?? "Client unknown"} · AI drafts are suggestions only —
            never verified company evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/tenders/${tender.id}`}
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Tender analysis
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => extract(Boolean(pack))}
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
          >
            {busyKey === "extract"
              ? "Extracting…"
              : pack
                ? "Re-extract"
                : "Extract questionnaires"}
          </button>
          <button
            type="button"
            disabled={pending || !pack || pack.questionCount === 0}
            onClick={() => generateDrafts()}
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {busyKey === "draft"
              ? "Generating…"
              : stats.drafted > 0
                ? "Regenerate drafts"
                : "Generate drafts"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      {!pack ? (
        <EmptyState
          icon={ClipboardList}
          title="No questionnaire extracted yet"
          description="Scan this tender’s documents for questionnaires and forms. Extraction uses already stored document text — it does not re-run Tender Analysis."
          actionLabel={pending ? "Working…" : "Extract questionnaires"}
          onAction={() => extract(false)}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Questions", stats.total],
                ["Mandatory", pack.mandatoryCount],
                ["Needs VERIFY", stats.verify],
                ["Approved / edited", stats.approved],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted">
            Pack: {pack.title ?? pack.id.slice(0, 8)} · Extracted{" "}
            {pack.extractedAt.slice(0, 10)}
            {pack.lastDraftedAt
              ? ` · Drafts ${pack.lastDraftedAt.slice(0, 10)}`
              : ""}
          </p>

          {stats.total === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No questions detected"
              description="No questionnaire-style questions were found in the tender documents. Try re-extracting after documents finish processing."
              actionLabel="Re-extract"
              onAction={() => extract(true)}
            />
          ) : (
            <div className="space-y-8">
              {pack.sections.map((section) =>
                section.questions.length === 0 ? null : (
                  <section key={section.id} className="space-y-3">
                    <h2 className="text-base font-semibold">{section.title}</h2>
                    <ul className="space-y-3">
                      {section.questions.map((q) => (
                        <QuestionCard
                          key={q.id}
                          question={q}
                          pending={pending}
                          busy={busyKey === q.id}
                          editing={editingId === q.id}
                          editText={editText}
                          onStartEdit={() => {
                            setEditingId(q.id);
                            setEditText(displayAnswer(q) ?? "");
                          }}
                          onCancelEdit={() => setEditingId(null)}
                          onEditText={setEditText}
                          onApprove={() => review(q.id, "approve")}
                          onReject={() => {
                            if (
                              typeof window !== "undefined" &&
                              !window.confirm(
                                "Reject this AI draft? It will be marked rejected and should not be used as an answer.",
                              )
                            ) {
                              return;
                            }
                            void review(q.id, "reject");
                          }}
                          onSaveEdit={() => review(q.id, "edit", editText)}
                        />
                      ))}
                    </ul>
                  </section>
                ),
              )}

              {(() => {
                const inSection = new Set(
                  pack.sections.flatMap((s) => s.questions.map((q) => q.id)),
                );
                const orphans = pack.questions.filter((q) => !inSection.has(q.id));
                const list =
                  pack.sections.length === 0 ? pack.questions : orphans;
                if (list.length === 0) return null;
                return (
                  <section className="space-y-3">
                    {pack.sections.length > 0 ? (
                      <h2 className="text-base font-semibold">Other questions</h2>
                    ) : null}
                    <ul className="space-y-3">
                      {list.map((q) => (
                        <QuestionCard
                          key={q.id}
                          question={q}
                          pending={pending}
                          busy={busyKey === q.id}
                          editing={editingId === q.id}
                          editText={editText}
                          onStartEdit={() => {
                            setEditingId(q.id);
                            setEditText(displayAnswer(q) ?? "");
                          }}
                          onCancelEdit={() => setEditingId(null)}
                          onEditText={setEditText}
                          onApprove={() => review(q.id, "approve")}
                          onReject={() => {
                            if (
                              typeof window !== "undefined" &&
                              !window.confirm(
                                "Reject this AI draft? It will be marked rejected and should not be used as an answer.",
                              )
                            ) {
                              return;
                            }
                            void review(q.id, "reject");
                          }}
                          onSaveEdit={() => review(q.id, "edit", editText)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionCard({
  question: q,
  pending,
  busy,
  editing,
  editText,
  onStartEdit,
  onCancelEdit,
  onEditText,
  onApprove,
  onReject,
  onSaveEdit,
}: {
  question: QuestionnaireQuestionDto;
  pending: boolean;
  busy: boolean;
  editing: boolean;
  editText: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditText: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSaveEdit: () => void;
}) {
  const answer = displayAnswer(q);
  const draft = q.draft;
  const isVerify = !draft || draft.status === "VERIFY" || draft.status === "DRAFT_READY";
  const evidence = Array.isArray(draft?.evidenceRefs)
    ? (draft!.evidenceRefs as Array<{
        sourceDocument?: string;
        page?: number | string | null;
        section?: string | null;
        excerpt?: string | null;
      }>)
    : [];

  return (
    <li className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <MandatoryBadge status={q.mandatoryStatus} />
            <QuestionTypeBadge type={q.questionType} />
            {draft ? <DraftStatusBadge status={draft.status} /> : (
              <span className="inline-flex rounded-md bg-foreground/6 px-2 py-0.5 text-[11px] font-medium text-muted">
                No draft yet
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Question
            </p>
            <p className="mt-0.5 font-medium text-foreground">{q.prompt}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-foreground/[0.03] px-3 py-2 text-xs text-muted">
        <p className="font-semibold text-foreground/80">Source / provenance</p>
        <p className="mt-0.5">{provenanceLine(q)}</p>
        {q.originalText && q.originalText !== q.prompt ? (
          <p className="mt-1 italic">“{q.originalText}”</p>
        ) : null}
      </div>

      <div
        className={
          isVerify
            ? "rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3"
            : "rounded-lg border border-border px-3 py-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            AI draft answer
            {isVerify ? " · not verified evidence" : ""}
          </p>
          {draft ? <DraftStatusBadge status={draft.status} /> : null}
        </div>

        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            aria-label="Edit draft answer"
          />
        ) : answer ? (
          <p className="mt-2 whitespace-pre-wrap text-sm">{answer}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {draft?.rationale ??
              "No draft text — generate drafts or answer manually after verification."}
          </p>
        )}

        {draft?.rationale && answer ? (
          <p className="mt-2 text-xs text-muted">{draft.rationale}</p>
        ) : null}

        {evidence.length > 0 ? (
          <div className="mt-3 space-y-1 border-t border-border/70 pt-2">
            <p className="text-xs font-semibold text-muted">
              Supporting company knowledge cites
            </p>
            {evidence.map((ref, i) => (
              <p key={i} className="text-xs text-muted">
                {ref.sourceDocument ?? "Source"}
                {ref.page != null ? ` · p.${ref.page}` : ""}
                {ref.section ? ` · ${ref.section}` : ""}
                {ref.excerpt ? ` — ${ref.excerpt}` : ""}
              </p>
            ))}
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              These cites are for the AI draft only. They are not Decision Engine
              evidence and are not auto-verified.
            </p>
          </div>
        ) : null}

        {draft && draft.status !== "REJECTED" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={pending || busy || !editText.trim()}
                  onClick={onSaveEdit}
                  className="h-9 rounded-xl bg-primary px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save edit"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onCancelEdit}
                  className="h-9 rounded-xl border border-border px-3 text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {draft.status !== "APPROVED" && draft.status !== "EDITED" ? (
                  <button
                    type="button"
                    disabled={pending || busy || !answer}
                    onClick={onApprove}
                    className="h-9 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "…" : "Approve"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending || busy}
                  onClick={onStartEdit}
                  className="h-9 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending || busy}
                  onClick={onReject}
                  className="h-9 rounded-xl px-3 text-sm text-red-700 hover:underline disabled:opacity-60 dark:text-red-300"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
