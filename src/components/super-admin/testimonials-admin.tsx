"use client";

import {
  saDeleteTestimonial,
  saReorderTestimonials,
  saToggleTestimonial,
  saUploadLandingAsset,
  saUpsertTestimonial,
} from "@/app/actions/super-admin";
import { FileChooseField } from "@/components/ui/file-choose-field";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type TestimonialRow = {
  id: string;
  customerName: string;
  companyName: string;
  jobTitle: string | null;
  quote: string;
  rating: number;
  avatarUrl: string | null;
  verified: boolean;
  enabled: boolean;
  sortOrder: number;
};

const empty = {
  customerName: "",
  companyName: "",
  jobTitle: "",
  quote: "",
  rating: 5,
  avatarUrl: "" as string | null,
  verified: false,
  enabled: true,
  sortOrder: 0,
};

export function TestimonialsAdmin({ initial }: { initial: TestimonialRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);

  function startCreate() {
    setEditingId(null);
    setForm({ ...empty, sortOrder: items.length });
    setShowForm(true);
  }

  function startEdit(t: TestimonialRow) {
    setEditingId(t.id);
    setForm({
      customerName: t.customerName,
      companyName: t.companyName,
      jobTitle: t.jobTitle ?? "",
      quote: t.quote,
      rating: t.rating,
      avatarUrl: t.avatarUrl,
      verified: t.verified,
      enabled: t.enabled,
      sortOrder: t.sortOrder,
    });
    setShowForm(true);
  }

  async function uploadAvatar(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.set("kind", "avatar");
    fd.set("file", file);
    const result = await saUploadLandingAsset(fd);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setForm((f) => ({ ...f, avatarUrl: result.data.url }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saUpsertTestimonial({
        id: editingId ?? undefined,
        customerName: form.customerName,
        companyName: form.companyName,
        jobTitle: form.jobTitle || null,
        quote: form.quote,
        rating: form.rating,
        avatarUrl: form.avatarUrl || null,
        verified: form.verified,
        enabled: form.enabled,
        sortOrder: form.sortOrder,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setEditingId(null);
      setForm(empty);
      setShowForm(false);
      router.refresh();
    });
  }

  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((t) => t.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= items.length) return;
    const ordered = [...items];
    const [row] = ordered.splice(idx, 1);
    ordered.splice(next, 0, row!);
    setItems(ordered);
    startTransition(async () => {
      await saReorderTestimonials({ orderedIds: ordered.map((t) => t.id) });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
        Publish only genuine customer testimonials. Do not invent names, companies, or ratings.
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{items.length} testimonial(s)</p>
        <button
          type="button"
          onClick={startCreate}
          className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Add testimonial
        </button>
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm font-medium text-white">
            {editingId ? "Edit testimonial" : "New testimonial"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Customer name *"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            />
            <input
              placeholder="Company name *"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            />
            <input
              placeholder="Job title"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            />
            <label className="flex h-10 items-center gap-2 text-sm text-slate-300">
              Rating
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-white"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            placeholder="Testimonial quote * (genuine words only)"
            value={form.quote}
            onChange={(e) => setForm({ ...form, quote: e.target.value })}
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.verified}
                onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              />
              Verified badge
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enabled on landing
            </label>
            <FileChooseField
              accept="image/*"
              variant="compact"
              tone="admin"
              uploading={pending}
              chooseLabel="Choose file"
              uploadingLabel="Uploading…"
              onFilesChange={(files) => {
                const f = files[0];
                if (f) void uploadAvatar(f);
              }}
            />
            {form.avatarUrl ? (
              <span className="truncate text-xs text-emerald-400">{form.avatarUrl}</span>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="h-9 rounded-lg bg-emerald-600 px-3 text-sm text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
                setShowForm(false);
              }}
              className="h-9 rounded-lg border border-slate-700 px-3 text-sm text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-white">
                {t.customerName}{" "}
                <span className="text-slate-400">· {t.companyName}</span>
                {!t.enabled ? (
                  <span className="ms-2 text-xs text-amber-400">Disabled</span>
                ) : null}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">“{t.quote}”</p>
              <p className="mt-1 text-xs text-slate-500">
                {t.rating}/5 · order {t.sortOrder}
                {t.verified ? " · verified" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                onClick={() => move(t.id, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                onClick={() => move(t.id, 1)}
              >
                Down
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                onClick={() => startEdit(t)}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                onClick={() =>
                  startTransition(async () => {
                    await saToggleTestimonial(t.id, !t.enabled);
                    router.refresh();
                  })
                }
              >
                {t.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-400"
                onClick={() =>
                  startTransition(async () => {
                    if (!confirm("Delete this testimonial?")) return;
                    await saDeleteTestimonial(t.id);
                    router.refresh();
                  })
                }
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
