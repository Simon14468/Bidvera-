"use client";

import { Alert } from "@/components/ui/alert";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import type { ReminderSettingsDto } from "@/modules/tender-calendar";
import { useState, useTransition } from "react";

type Feedback =
  | { kind: "success"; text: string }
  | { kind: "danger"; text: string };

export function ReminderSettingsForm({
  initial,
  canManage = true,
}: {
  initial: ReminderSettingsDto;
  canManage?: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function onSave() {
    if (!canManage) return;
    setFeedback(null);
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
        setFeedback({
          kind: "danger",
          text: json.error ?? "Couldn’t save reminder settings. Try again.",
        });
        return;
      }
      if (json.settings) setSettings(json.settings);
      setFeedback({
        kind: "success",
        text: "Reminder settings saved successfully.",
      });
    });
  }

  return (
    <div className="space-y-1">
      {!canManage ? (
        <p className="mb-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
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
        <SettingsToggleRow
          key={key}
          label={label}
          checked={settings[key]}
          disabled={!canManage}
          onCheckedChange={(next) => {
            if (!canManage) return;
            setFeedback(null);
            setSettings((s) => ({ ...s, [key]: next }));
          }}
        />
      ))}
      {canManage ? (
        <div className="space-y-3 pt-3">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save reminders"}
          </button>
          {feedback ? (
            <Alert
              variant={feedback.kind === "success" ? "success" : "danger"}
              title={feedback.kind === "success" ? "Saved" : "Save failed"}
            >
              {feedback.text}
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
