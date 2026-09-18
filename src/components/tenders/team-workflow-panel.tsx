"use client";

import {
  assignTeamTaskAction,
  createTeamTaskAction,
  respondTeamTaskAction,
  uploadTeamTaskEvidenceAction,
  verifyTeamTaskAction,
} from "@/app/actions/team-workflow";
import { buildUploadAcceptAttribute } from "@/domain/tender-package/extraction-capabilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileChooseField } from "@/components/ui/file-choose-field";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const TEAM_EVIDENCE_ACCEPT = buildUploadAcceptAttribute();

type Member = { id: string; name: string; email: string; role: string };

type Task = {
  id: string;
  title: string;
  description: string | null;
  requiredResponse: string | null;
  kind: string;
  department: string | null;
  priority: string;
  displayStatus: string;
  deadline: Date | string | null;
  responseText: string | null;
  evidenceNote: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  requirementId: string | null;
  riskId: string | null;
  missingDocId: string | null;
  verificationStatus?: string;
  verificationNote?: string | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
};

const DEPARTMENTS = [
  "FINANCE",
  "LEGAL",
  "TECHNICAL",
  "MANAGEMENT",
  "PROCUREMENT",
  "COMMERCIAL",
  "OPERATIONS",
  "OTHER",
] as const;

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "border-success/20 bg-success/10 text-success";
    case "OVERDUE":
      return "border-danger/20 bg-danger/10 text-danger";
    case "IN_PROGRESS":
      return "border-primary/20 bg-primary-muted text-primary";
    case "CANCELLED":
      return "border-border bg-muted/40 text-muted";
    default:
      return "border-warning/25 bg-warning/10 text-warning";
  }
}

function verificationClass(status: string) {
  switch (status) {
    case "VERIFIED":
      return "border-success/20 bg-success/10 text-success";
    case "REJECTED":
      return "border-danger/20 bg-danger/10 text-danger";
    case "PENDING":
      return "border-warning/25 bg-warning/10 text-warning";
    default:
      return "border-border bg-background text-muted";
  }
}

export function TeamWorkflowPanel({
  tenderId,
  tasks: initialTasks,
  members,
  summary,
  canMutate,
  canVerify = false,
  copy,
}: {
  tenderId: string;
  tasks: Task[];
  members: Member[];
  summary: {
    openCriticalCount: number;
    openCount: number;
    note: string | null;
  };
  canMutate: boolean;
  canVerify?: boolean;
  copy: {
    title: string;
    subtitle: string;
    empty: string;
    criticalBanner: string;
    assign: string;
    respond: string;
    complete: string;
    create: string;
    responsePlaceholder: string;
    evidencePlaceholder: string;
    department: string;
    assignee: string;
    requiredResponse: string;
    linkedItem: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>(
    {},
  );
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, string>>(
    {},
  );
  const [verifyNotes, setVerifyNotes] = useState<Record<string, string>>({});
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    requiredResponse: "",
    department: "TECHNICAL" as (typeof DEPARTMENTS)[number],
    assigneeUserId: "",
    kind: "CUSTOM" as const,
  });

  function refresh() {
    router.refresh();
  }

  return (
    <section id="team-workflow" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
          {summary.openCriticalCount > 0 ? (
            <p className="mt-2 text-sm font-medium text-danger">
              {copy.criticalBanner.replace(
                "{count}",
                String(summary.openCriticalCount),
              )}
            </p>
          ) : null}
        </div>
        {canMutate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            {copy.create}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showCreate && canMutate ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <input
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
              placeholder="Task title"
              value={createForm.title}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, title: e.target.value }))
              }
            />
            <textarea
              className="min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              placeholder="Context"
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <textarea
              className="min-h-16 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              placeholder={copy.requiredResponse}
              value={createForm.requiredResponse}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  requiredResponse: e.target.value,
                }))
              }
            />
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-xl border border-border bg-card px-2 text-sm"
                value={createForm.department}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    department: e.target
                      .value as (typeof DEPARTMENTS)[number],
                  }))
                }
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                className="h-9 min-w-40 flex-1 rounded-xl border border-border bg-card px-2 text-sm"
                value={createForm.assigneeUserId}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    assigneeUserId: e.target.value,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                loading={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await createTeamTaskAction({
                      tenderId,
                      kind: createForm.kind,
                      title: createForm.title,
                      description: createForm.description,
                      requiredResponse: createForm.requiredResponse,
                      department: createForm.department,
                      assigneeUserId: createForm.assigneeUserId || null,
                    });
                    if (!result.ok) {
                      setError(result.error.message);
                      return;
                    }
                    setShowCreate(false);
                    refresh();
                  });
                }}
              >
                {copy.create}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {initialTasks.length === 0 ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : (
        <div className="space-y-3">
          {initialTasks.map((task) => {
            const verification = task.verificationStatus ?? "NONE";
            const awaitingVerify =
              verification === "PENDING" && Boolean(task.responseText);
            return (
              <Card key={task.id}>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{task.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {task.kind.replaceAll("_", " ")}
                        {task.department ? ` · ${task.department}` : ""}
                        {task.assigneeName
                          ? ` · ${task.assigneeName}`
                          : " · Unassigned"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className={statusClass(task.displayStatus)}>
                        {task.displayStatus.replaceAll("_", " ")}
                      </Badge>
                      <Badge className={verificationClass(verification)}>
                        Evidence: {verification}
                      </Badge>
                      <Badge className="border-border bg-background text-muted">
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                  {task.description ? (
                    <p className="text-sm text-muted">{task.description}</p>
                  ) : null}
                  {task.requiredResponse ? (
                    <p className="text-sm">
                      <span className="font-medium">
                        {copy.requiredResponse}:{" "}
                      </span>
                      {task.requiredResponse}
                    </p>
                  ) : null}
                  {(task.requirementId ||
                    task.riskId ||
                    task.missingDocId) && (
                    <p className="text-xs text-muted">
                      {copy.linkedItem}:{" "}
                      {task.requirementId
                        ? `requirement ${task.requirementId.slice(0, 8)}…`
                        : task.riskId
                          ? `risk ${task.riskId.slice(0, 8)}…`
                          : `document ${task.missingDocId!.slice(0, 8)}…`}
                    </p>
                  )}
                  {task.responseText ? (
                    <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <p className="font-medium">
                        Response{" "}
                        {verification !== "VERIFIED" ? (
                          <span className="text-xs font-normal text-warning">
                            (unverified — does not affect decision)
                          </span>
                        ) : (
                          <span className="text-xs font-normal text-success">
                            (verified)
                          </span>
                        )}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-muted">
                        {task.responseText}
                      </p>
                      {task.evidenceNote ? (
                        <p className="mt-2 text-xs text-muted">
                          Evidence note: {task.evidenceNote}
                        </p>
                      ) : null}
                      {task.attachments && task.attachments.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-muted">
                          {task.attachments.map((a) => (
                            <li key={a.id}>📎 {a.fileName}</li>
                          ))}
                        </ul>
                      ) : null}
                      {task.verificationNote ? (
                        <p className="mt-2 text-xs">
                          Verifier note: {task.verificationNote}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {canVerify && awaitingVerify ? (
                    <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-3">
                      <p className="text-sm font-medium">
                        Verification required
                      </p>
                      <textarea
                        className="min-h-12 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        placeholder="Verification note (optional)"
                        value={verifyNotes[task.id] ?? ""}
                        onChange={(e) =>
                          setVerifyNotes((d) => ({
                            ...d,
                            [task.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          loading={pending}
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              const result = await verifyTeamTaskAction({
                                taskId: task.id,
                                verdict: "VERIFIED",
                                verificationNote: verifyNotes[task.id],
                                appliedRequirementStatus: task.requirementId
                                  ? "MATCHED"
                                  : null,
                              });
                              if (!result.ok) {
                                setError(result.error.message);
                                return;
                              }
                              refresh();
                            });
                          }}
                        >
                          Verify evidence
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={pending}
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              const result = await verifyTeamTaskAction({
                                taskId: task.id,
                                verdict: "REJECTED",
                                verificationNote: verifyNotes[task.id],
                              });
                              if (!result.ok) {
                                setError(result.error.message);
                                return;
                              }
                              refresh();
                            });
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {canMutate &&
                  task.displayStatus !== "COMPLETED" &&
                  verification !== "VERIFIED" ? (
                    <div className="space-y-2 border-t border-border pt-3">
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="h-9 min-w-40 flex-1 rounded-xl border border-border bg-card px-2 text-sm"
                          value={
                            assignDrafts[task.id] ?? task.assigneeUserId ?? ""
                          }
                          onChange={(e) =>
                            setAssignDrafts((d) => ({
                              ...d,
                              [task.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={pending}
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              const result = await assignTeamTaskAction({
                                taskId: task.id,
                                assigneeUserId:
                                  (assignDrafts[task.id] ??
                                    task.assigneeUserId) ||
                                  null,
                              });
                              if (!result.ok) {
                                setError(result.error.message);
                                return;
                              }
                              refresh();
                            });
                          }}
                        >
                          {copy.assign}
                        </Button>
                      </div>
                      <textarea
                        className="min-h-16 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        placeholder={copy.responsePlaceholder}
                        value={responseDrafts[task.id] ?? ""}
                        onChange={(e) =>
                          setResponseDrafts((d) => ({
                            ...d,
                            [task.id]: e.target.value,
                          }))
                        }
                      />
                      <textarea
                        className="min-h-12 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        placeholder={copy.evidencePlaceholder}
                        value={evidenceDrafts[task.id] ?? ""}
                        onChange={(e) =>
                          setEvidenceDrafts((d) => ({
                            ...d,
                            [task.id]: e.target.value,
                          }))
                        }
                      />
                      <FileChooseField
                        key={`${task.id}-${task.attachments?.length ?? 0}`}
                        accept={TEAM_EVIDENCE_ACCEPT}
                        variant="compact"
                        uploading={pending}
                        chooseLabel="Choose file"
                        uploadingLabel="Uploading…"
                        onFilesChange={(files) => {
                          const file = files[0];
                          if (!file) return;
                          setError(null);
                          startTransition(async () => {
                            const fd = new FormData();
                            fd.set("taskId", task.id);
                            fd.set("file", file);
                            const result =
                              await uploadTeamTaskEvidenceAction(fd);
                            if (!result.ok) {
                              setError(result.error.message);
                              return;
                            }
                            refresh();
                          });
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={pending}
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              const result = await respondTeamTaskAction({
                                taskId: task.id,
                                responseText: responseDrafts[task.id] ?? "",
                                evidenceNote: evidenceDrafts[task.id],
                                markCompleted: false,
                              });
                              if (!result.ok) {
                                setError(result.error.message);
                                return;
                              }
                              refresh();
                            });
                          }}
                        >
                          Submit for verification
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
