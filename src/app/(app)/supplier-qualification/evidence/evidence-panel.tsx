"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { SupplierQualificationEvidenceDto } from "@/modules/supplier-qualification";
import { EVIDENCE_KIND_SUGGESTIONS } from "@/modules/supplier-qualification/constants";
import { FileChooseField } from "@/components/ui/file-choose-field";

export function EvidencePanel({
  initial,
}: {
  initial: SupplierQualificationEvidenceDto[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    // Capture the live form before any await — React nulls event.currentTarget
    // after the synchronous handler returns.
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/supplier-qualification/evidence", {
        method: "POST",
        body: data,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        evidence?: SupplierQualificationEvidenceDto;
      };
      if (!res.ok) {
        // Keep the selected file + fields so the user can retry.
        setError(json.error ?? "Upload failed.");
        return;
      }

      // Canonical list refresh (not only the POST payload).
      const listRes = await fetch("/api/supplier-qualification/evidence");
      const listJson = (await listRes.json().catch(() => ({}))) as {
        evidence?: SupplierQualificationEvidenceDto[];
        error?: string;
      };
      if (listRes.ok && Array.isArray(listJson.evidence)) {
        setItems(listJson.evidence);
      } else if (json.evidence) {
        setItems((prev) => [json.evidence!, ...prev]);
      }

      // Reset only the owning form, and only after success + while still mounted.
      const liveForm = formRef.current ?? form;
      if (liveForm.isConnected) {
        liveForm.reset();
      }
      setFileKey((k) => k + 1);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    if (pending) return;
    startTransition(async () => {
      const res = await fetch(`/api/supplier-qualification/evidence?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Delete failed.");
        return;
      }
      const listRes = await fetch("/api/supplier-qualification/evidence");
      const listJson = (await listRes.json().catch(() => ({}))) as {
        evidence?: SupplierQualificationEvidenceDto[];
      };
      if (listRes.ok && Array.isArray(listJson.evidence)) {
        setItems(listJson.evidence);
      } else {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="space-y-3 rounded-xl border border-border p-4"
      >
        <p className="text-sm text-muted">
          Attachments are references with provenance — never auto-verified.
        </p>
        <input
          name="title"
          required
          placeholder="Title"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select
          name="kind"
          defaultValue="OTHER"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          {EVIDENCE_KIND_SUGGESTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <textarea
          name="description"
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          name="externalUrl"
          placeholder="External URL (optional)"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        />
        <FileChooseField
          key={fileKey}
          name="file"
          uploading={pending}
          title="Drag & drop evidence here"
          hint="Optional if you provide an external URL"
          chooseLabel="Choose file"
          uploadingLabel="Saving…"
          onFilesChange={() => setError(null)}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add evidence"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.length === 0 ? (
          <li className="px-4 py-8 text-center">
            <p className="text-sm font-medium">No evidence references yet</p>
            <p className="mt-1 text-sm text-muted">
              Attach certificates or links that support your qualifications.
            </p>
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted">
                  {item.kind}
                  {item.verified ? " · verified" : " · not verified"}
                  {item.fileName ? ` · ${item.fileName}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.hasFile ? (
                  <a
                    href={`/api/supplier-qualification/evidence/${item.id}/file`}
                    className="text-primary hover:underline"
                  >
                    Download
                  </a>
                ) : item.externalUrl ? (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  disabled={pending}
                  className="text-muted hover:text-foreground disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
