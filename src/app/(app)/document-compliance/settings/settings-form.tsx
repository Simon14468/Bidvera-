"use client";

import { Alert } from "@/components/ui/alert";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import type { ComplianceReminderSettingsDto } from "@/modules/document-compliance";
import { useState, useTransition } from "react";

type Feedback =
  | { kind: "success"; text: string }
  | { kind: "danger"; text: string };

export function ReminderSettingsForm({
  initial,
}: {
  initial: ComplianceReminderSettingsDto;
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function onSave() {
    setFeedback(null);
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
      {(
        [
          ["remind90d", "90 days before expiry"],
          ["remind30d", "30 days before expiry"],
          ["remind7d", "7 days before expiry"],
          ["remindExpired", "Expired notification"],
        ] as const
      ).map(([key, label]) => (
        <SettingsToggleRow
          key={key}
          label={label}
          checked={settings[key]}
          onCheckedChange={(next) => {
            setFeedback(null);
            setSettings((s) => ({ ...s, [key]: next }));
          }}
        />
      ))}
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
    </div>
  );
}
