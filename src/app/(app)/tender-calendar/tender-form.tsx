"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TENDER_STATUSES } from "@/modules/tender-calendar/constants";

export function TenderForm({
  mode,
  tenderId,
  initial,
}: {
  mode: "create" | "edit";
  tenderId?: string;
  initial?: {
    title?: string;
    referenceNumber?: string | null;
    buyerAuthority?: string | null;
    country?: string | null;
    category?: string | null;
    description?: string | null;
    status?: string;
    sourceUrl?: string | null;
    notes?: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      title: String(fd.get("title") || ""),
      referenceNumber: String(fd.get("referenceNumber") || "") || null,
      buyerAuthority: String(fd.get("buyerAuthority") || "") || null,
      country: String(fd.get("country") || "") || null,
      category: String(fd.get("category") || "") || null,
      description: String(fd.get("description") || "") || null,
      status: String(fd.get("status") || "OPEN"),
      sourceUrl: String(fd.get("sourceUrl") || "") || null,
      notes: String(fd.get("notes") || "") || null,
    };
    startTransition(async () => {
      const res = await fetch(
        mode === "create"
          ? "/api/tender-calendar/tenders"
          : `/api/tender-calendar/tenders/${tenderId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        tender?: { id: string };
      };
      if (!res.ok) {
        setError(json.error ?? "Save failed.");
        return;
      }
      router.push(`/tender-calendar/${json.tender?.id ?? tenderId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field name="title" label="Title" defaultValue={initial?.title ?? ""} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="referenceNumber"
          label="Reference number"
          defaultValue={initial?.referenceNumber ?? ""}
        />
        <Field
          name="buyerAuthority"
          label="Buyer / authority"
          defaultValue={initial?.buyerAuthority ?? ""}
        />
        <Field name="country" label="Country" defaultValue={initial?.country ?? ""} />
        <Field name="category" label="Category" defaultValue={initial?.category ?? ""} />
        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select
            name="status"
            defaultValue={initial?.status ?? "OPEN"}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {TENDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <Field name="sourceUrl" label="Source URL" defaultValue={initial?.sourceUrl ?? ""} />
      </div>
      <label className="block text-sm">
        <span className="font-medium">Description</span>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Notes</span>
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={2}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create tender" : "Save changes"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}
