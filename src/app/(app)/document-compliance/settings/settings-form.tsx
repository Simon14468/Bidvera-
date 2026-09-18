"use client";

import { useState, useTransition } from "react";
import type { ComplianceReminderSettingsDto } from "@/modules/document-compliance";

export function ReminderSettingsForm({
  initial,
}: {
  initial: ComplianceReminderSettingsDto;
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(key: keyof ComplianceReminderSettingsDto) {
    if (key === "expiringSoonDays") return;
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/document-compliance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: ComplianceReminderSettingsDto;
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
    <div className="space-y-4">
      {(
        [
          ["remind90d", "90 days before expiry"],
          ["remind30d", "30 days before expiry"],
          ["remind7d", "7 days before expiry"],
          ["remindExpired", "Expired notification"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={() => toggle(key)}
          />
          {label}
        </label>
      ))}
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save reminders"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
