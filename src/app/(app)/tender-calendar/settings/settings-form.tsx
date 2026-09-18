"use client";

import { useState, useTransition } from "react";
import type { ReminderSettingsDto } from "@/modules/tender-calendar";

export function ReminderSettingsForm({
  initial,
  canManage = true,
}: {
  initial: ReminderSettingsDto;
  canManage?: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(key: keyof ReminderSettingsDto) {
    if (!canManage) return;
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  function onSave() {
    if (!canManage) return;
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/tender-calendar/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: ReminderSettingsDto;
      };
      if (!res.ok) {
        setMessage(json.error ?? "Save failed.");
        return;
      }
      if (json.settings) setSettings(json.settings);
      setMessage("Saved.");
    });
  }

  return (
    <div className="space-y-3">
      {!canManage ? (
        <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
          Only OWNER or ADMIN can change reminder settings.
        </p>
      ) : null}
      {(
        [
          ["remind30d", "30 days before"],
          ["remind14d", "14 days before"],
          ["remind7d", "7 days before"],
          ["remind3d", "3 days before"],
          ["remind1d", "1 day before"],
          ["remindSameDay", "Same day"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings[key]}
            disabled={!canManage}
            onChange={() => toggle(key)}
          />
          {label}
        </label>
      ))}
      {canManage ? (
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save reminders"}
        </button>
      ) : null}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
