"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";

type DraftItem = {
  key: string;
  type: "INFORMATION" | "DOCUMENT";
  label: string;
  description: string;
};

export function CreateClientRequestForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([
    { key: "1", type: "DOCUMENT", label: "", description: "" },
  ]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        type: "DOCUMENT",
        label: "",
        description: "",
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.key !== key)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      clientName: String(fd.get("clientName") || "").trim(),
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim() || null,
      deadline: String(fd.get("deadline") || "").trim(),
      items: items
        .map((i) => ({
          type: i.type,
          label: i.label.trim(),
          description: i.description.trim() || null,
        }))
        .filter((i) => i.label),
    };

    startTransition(async () => {
      const res = await fetch("/api/client-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create request.");
        return;
      }
      router.push(`/client-requests/${data.request.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Client / company name</span>
          <input
            name="clientName"
            required
            className="block h-10 w-full rounded-xl border border-border bg-background px-3"
            placeholder="e.g. Atlas Procurement"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Deadline</span>
          <input
            name="deadline"
            type="date"
            required
            className="block h-10 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Request title</span>
        <input
          name="title"
          required
          className="block h-10 w-full rounded-xl border border-border bg-background px-3"
          placeholder="e.g. Supplier qualification documents"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Description</span>
        <textarea
          name="description"
          rows={3}
          className="block w-full rounded-xl border border-border bg-background px-3 py-2"
          placeholder="Optional context from the client"
        />
      </label>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Requested items</h2>
          <button
            type="button"
            onClick={addItem}
            className="text-sm font-medium text-primary hover:underline"
          >
            Add item
          </button>
        </div>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[8rem_1fr_auto]"
            >
              <select
                value={item.type}
                onChange={(e) =>
                  updateItem(item.key, {
                    type: e.target.value as DraftItem["type"],
                  })
                }
                className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
              >
                <option value="DOCUMENT">Document</option>
                <option value="INFORMATION">Information</option>
              </select>
              <div className="space-y-2">
                <input
                  value={item.label}
                  onChange={(e) => updateItem(item.key, { label: e.target.value })}
                  required
                  placeholder="e.g. ISO certificate"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
                <input
                  value={item.description}
                  onChange={(e) =>
                    updateItem(item.key, { description: e.target.value })
                  }
                  placeholder="Optional note"
                  className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="h-10 self-start rounded-xl px-3 text-sm text-muted hover:bg-foreground/[0.04]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create request"}
        </button>
        <Link
          href="/client-requests"
          className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
