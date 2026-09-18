"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DEADLINE_TYPES } from "@/modules/tender-calendar/constants";

export function MilestoneForms({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(kind: "deadline" | "event", e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const dateOnly = fd.get("dateOnly") === "on";
    const body = {
      kind,
      type: String(fd.get("type") || (kind === "deadline" ? "SUBMISSION" : "OTHER")),
      title: String(fd.get("title") || ""),
      date: dateOnly ? String(fd.get("date") || "") : null,
      dateTime: dateOnly ? null : String(fd.get("dateTime") || "") || null,
      dateOnly,
      timezone: String(fd.get("timezone") || "") || null,
      source: String(fd.get("source") || "") || null,
      notes: String(fd.get("notes") || "") || null,
    };
    startTransition(async () => {
      const res = await fetch(`/api/tender-calendar/tenders/${tenderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed.");
        return;
      }
      e.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => submit("deadline", e)}
        className="space-y-2 rounded-xl border border-border p-4"
      >
        <h3 className="text-sm font-semibold">Add deadline</h3>
        <MilestoneFields defaultType="SUBMISSION" />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-xl bg-primary px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          Add deadline
        </button>
      </form>
      <form
        onSubmit={(e) => submit("event", e)}
        className="space-y-2 rounded-xl border border-border p-4"
      >
        <h3 className="text-sm font-semibold">Add event</h3>
        <MilestoneFields defaultType="OTHER" />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-60"
        >
          Add event
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function MilestoneFields({ defaultType }: { defaultType: string }) {
  return (
    <>
      <input
        name="title"
        required
        placeholder="Title"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <select
        name="type"
        defaultValue={defaultType}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        {DEADLINE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="dateOnly" defaultChecked />
        Date only (no time / timezone invented)
      </label>
      <input
        type="date"
        name="date"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <input
        type="datetime-local"
        name="dateTime"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <input
        name="timezone"
        placeholder="Timezone only if explicit (e.g. Africa/Casablanca)"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <input
        name="source"
        placeholder="Source (optional)"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <input
        name="notes"
        placeholder="Notes (optional)"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
    </>
  );
}

export function DeleteMilestoneButton({
  id,
  kind,
}: {
  id: string;
  kind: "deadline" | "event";
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs text-muted hover:text-foreground"
      onClick={async () => {
        await fetch(`/api/tender-calendar/milestones?id=${id}&kind=${kind}`, {
          method: "DELETE",
        });
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
