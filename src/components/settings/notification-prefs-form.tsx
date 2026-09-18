"use client";

import { saveNotificationPrefsAction } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import type { NotificationPrefs } from "@/services/notifications/prefs";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SettingsCopy = Dictionary["app"]["settings"];

const TIMEZONES = [
  "UTC",
  "Africa/Casablanca",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Shanghai",
  "Asia/Tokyo",
];

export function NotificationPrefsForm({
  initial,
  copy,
  canManage = true,
}: {
  initial: NotificationPrefs;
  copy: SettingsCopy;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof NotificationPrefs, value: boolean) {
    if (!canManage) return;
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const channels = [
    ["inAppEnabled", copy.channelInApp],
    ["emailEnabled", copy.channelEmail],
    ["whatsappEnabled", copy.channelWhatsapp],
    ["smsEnabled", copy.channelSms],
    ["pushEnabled", copy.channelPush],
  ] as const;

  const deadlines = [
    ["deadlineAlert7d", copy.deadline7d],
    ["deadlineAlert3d", copy.deadline3d],
    ["deadlineAlert24h", copy.deadline24h],
    ["deadlineAlertPassed", copy.deadlinePassed],
  ] as const;

  const other = [
    ["decisionAlerts", copy.alertAnalysisDone],
    ["highRiskAlerts", copy.alertHighRisk],
    ["missingDocAlerts", copy.alertMissingDocs],
    ["scoreChangeAlerts", copy.alertScoreChange],
    ["requirementAlerts", copy.alertRequirementStatus],
    ["decisionMemoryAlerts", copy.alertDecisionMemory],
    ["workflowAlerts", copy.alertWorkflow],
  ] as const;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canManage) return;
        setError(null);
        startTransition(async () => {
          const result = await saveNotificationPrefsAction(form);
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          setForm(result.data);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      {!canManage ? (
        <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
          Only OWNER or ADMIN can change notification preferences.
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium text-foreground">{copy.timezone}</span>
        <select
          className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          value={form.timezone}
          disabled={!canManage}
          onChange={(e) => {
            if (!canManage) return;
            setForm((f) => ({ ...f, timezone: e.target.value }));
            setSaved(false);
          }}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">{copy.timezoneHint}</span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{copy.channels}</legend>
        {channels.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              disabled={!canManage}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{copy.deadlineAlerts}</legend>
        {deadlines.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              disabled={!canManage}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{copy.otherAlerts}</legend>
        {other.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              disabled={!canManage}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-success">{copy.prefsSaved}</p> : null}

      {canManage ? (
        <Button type="submit" loading={pending}>
          {copy.savePrefs}
        </Button>
      ) : null}
    </form>
  );
}
