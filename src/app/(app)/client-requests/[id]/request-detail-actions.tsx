"use client";

import type { ClientRequestDto } from "@/modules/client-requests";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type PickerDoc = { id: string; name: string };
type PickerEvidence = { id: string; title: string; hasFile?: boolean };

export function RequestDetailActions({ request }: { request: ClientRequestDto }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [docs, setDocs] = useState<PickerDoc[]>([]);
  const [evidence, setEvidence] = useState<PickerEvidence[]>([]);
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const [dRes, eRes] = await Promise.all([
        fetch("/api/document-compliance/documents").catch(() => null),
        fetch("/api/supplier-qualification/evidence").catch(() => null),
      ]);
      if (dRes?.ok) {
        const data = await dRes.json();
        setDocs(
          (data.documents ?? data.items ?? []).map(
            (d: { id: string; name: string }) => ({
              id: d.id,
              name: d.name,
            }),
          ),
        );
      }
      if (eRes?.ok) {
        const data = await eRes.json();
        setEvidence(
          (data.evidence ?? data.items ?? []).map(
            (e: { id: string; title: string; hasFile?: boolean }) => ({
              id: e.id,
              title: e.title,
              hasFile: e.hasFile,
            }),
          ),
        );
      }
    })();
  }, []);

  function refresh() {
    router.refresh();
  }

  async function patchItem(itemId: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(
      `/api/client-requests/${request.id}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Action failed.");
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Requested items</h2>
        <ul className="space-y-3">
          {(request.items ?? []).map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {item.status === "COMPLETED" ? "✓ " : "○ "}
                    {item.label}
                  </p>
                  <p className="text-xs text-muted">
                    {item.type === "DOCUMENT" ? "Document" : "Information"}
                    {item.complianceDocumentName
                      ? ` · Linked: ${item.complianceDocumentName}`
                      : ""}
                    {item.supplierEvidenceTitle
                      ? ` · Linked: ${item.supplierEvidenceTitle}`
                      : ""}
                    {item.linkSource === "COMPANY_PROFILE"
                      ? " · Linked: Company Profile"
                      : ""}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                  ) : null}
                  {item.informationValue ? (
                    <p className="mt-1 text-sm">{item.informationValue}</p>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-muted">
                  {item.status === "COMPLETED" ? "Completed" : "Pending"}
                </span>
              </div>

              {item.status === "PENDING" && item.type === "INFORMATION" ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Answer / note (optional)"
                    className="h-9 min-w-[14rem] flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                    value={linkDraft[item.id] ?? ""}
                    onChange={(e) =>
                      setLinkDraft((d) => ({ ...d, [item.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() =>
                        patchItem(item.id, {
                          action: "complete_information",
                          informationValue: linkDraft[item.id] || null,
                        }),
                      )
                    }
                    className="h-9 rounded-xl bg-primary px-3 text-sm font-medium text-white"
                  >
                    Mark complete
                  </button>
                </div>
              ) : null}

              {item.status === "PENDING" && item.type === "DOCUMENT" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    Link existing Bidvera data (no duplicate upload):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-9 max-w-xs rounded-xl border border-border bg-background px-2 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        startTransition(() =>
                          patchItem(item.id, {
                            action: "link",
                            linkSource: "COMPLIANCE_DOCUMENT",
                            complianceDocumentId: v,
                          }),
                        );
                      }}
                    >
                      <option value="">Document Compliance…</option>
                      {docs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 max-w-xs rounded-xl border border-border bg-background px-2 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        startTransition(() =>
                          patchItem(item.id, {
                            action: "link",
                            linkSource: "SUPPLIER_EVIDENCE",
                            supplierEvidenceId: v,
                          }),
                        );
                      }}
                    >
                      <option value="">Supplier evidence…</option>
                      {evidence.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          patchItem(item.id, {
                            action: "link",
                            linkSource: "COMPANY_PROFILE",
                          }),
                        )
                      }
                      className="h-9 rounded-xl border border-border px-3 text-sm font-medium"
                    >
                      Link Company Profile
                    </button>
                  </div>
                </div>
              ) : null}

              {item.status === "COMPLETED" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() =>
                      patchItem(item.id, { action: "reopen" }),
                    )
                  }
                  className="text-sm text-muted hover:underline"
                >
                  Reopen
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Share dossier</h2>
        <p className="text-sm text-muted">
          Generate a secure link showing only selected items. You can revoke
          access at any time.
        </p>
        <button
          type="button"
          disabled={pending || request.status === "CANCELLED"}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setShareUrl(null);
              const itemIds = (request.items ?? []).map((i) => i.id);
              const res = await fetch(
                `/api/client-requests/${request.id}/share`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ itemIds }),
                },
              );
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setError(data.error || "Could not create share link.");
                return;
              }
              const path = data.share?.url as string;
              setShareUrl(
                typeof window !== "undefined"
                  ? `${window.location.origin}${path}`
                  : path,
              );
              refresh();
            })
          }
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          Create share link
        </button>
        {shareUrl ? (
          <p className="break-all rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm">
            {shareUrl}
          </p>
        ) : null}
        <ul className="space-y-2 text-sm">
          {(request.shares ?? []).map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
            >
              <span className="text-muted">
                {s.tokenPrefix}… ·{" "}
                {s.revokedAt
                  ? "Revoked"
                  : s.expiresAt
                    ? `Expires ${s.expiresAt.slice(0, 10)}`
                    : "Active"}
              </span>
              {!s.revokedAt ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await fetch(
                        `/api/client-requests/${request.id}/share?shareId=${s.id}`,
                        { method: "DELETE" },
                      );
                      refresh();
                    })
                  }
                  className="text-sm text-red-600 hover:underline"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {request.status !== "CANCELLED" ? (
        <section>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await fetch(`/api/client-requests/${request.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "cancel" }),
                });
                refresh();
              })
            }
            className="text-sm text-muted hover:text-red-600 hover:underline"
          >
            Cancel request
          </button>
        </section>
      ) : null}
    </div>
  );
}
