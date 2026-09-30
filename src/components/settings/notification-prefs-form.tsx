"use client";

import { saveNotificationPrefsAction } from "@/app/actions/reports";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  detectBrowserTimeZone,
  resolveSuggestedCompanyTimezone,
} from "@/lib/timezones";
import type { NotificationChannelSettings } from "@/services/notifications/channel-settings";
import type { NotificationPrefs } from "@/services/notifications/prefs";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

type SettingsCopy = Dictionary["app"]["settings"];

const emptySubscribe = () => () => {};

/** Client snapshot — runs immediately after hydration (no effect lag). */
function getBrowserTimeZoneSnapshot(): string | null {
  return detectBrowserTimeZone();
}

function getServerTimeZoneSnapshot(): string | null {
  return null;
}

export function NotificationPrefsForm({
  initial,
  copy,
  canManage = true,
  channelVisibility,
}: {
  initial: NotificationPrefs;
  copy: SettingsCopy;
  canManage?: boolean;
  channelVisibility?: Pick<
    NotificationChannelSettings,
    "whatsappVisible" | "smsVisible" | "pushVisible"
  >;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Once the user picks a zone manually, stop auto-suggesting over it. */
  const [timezoneTouched, setTimezoneTouched] = useState(false);

  const browserTimezone = useSyncExternalStore(
    emptySubscribe,
    getBrowserTimeZoneSnapshot,
    getServerTimeZoneSnapshot,
  );

  const suggested = resolveSuggestedCompanyTimezone({
    savedTimezone: initial.timezone,
    detectedTimezone: browserTimezone,
  });

  const timezone = timezoneTouched
    ? form.timezone
    : suggested.timezone || form.timezone;

  const showWhatsapp = channelVisibility?.whatsappVisible === true;
  const showSms = channelVisibility?.smsVisible === true;
  const showPush = channelVisibility?.pushVisible === true;

  function toggle(key: keyof NotificationPrefs, value: boolean) {
    if (!canManage) return;
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const channels: Array<
    readonly [keyof NotificationPrefs & string, string]
  > = [
    ["inAppEnabled", copy.channelInApp],
    ["emailEnabled", copy.channelEmail],
    ...(showWhatsapp
      ? ([["whatsappEnabled", copy.channelWhatsapp]] as const)
      : []),
    ...(showSms ? ([["smsEnabled", copy.channelSms]] as const) : []),
    ...(showPush ? ([["pushEnabled", copy.channelPush]] as const) : []),
  ];

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
          const result = await saveNotificationPrefsAction({
            ...form,
            timezone,
          });
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          setForm(result.data);
          setTimezoneTouched(false);
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

      <TimezonePicker
        id="company-timezone"
        label={copy.timezone}
        value={timezone}
        disabled={!canManage}
        loading={!browserTimezone && !timezone}
        placeholder={copy.timezonePlaceholder}
        searchPlaceholder={copy.timezoneSearchPlaceholder}
        emptyMessage={copy.timezoneEmpty}
        onChange={(next) => {
          if (!canManage) return;
          setTimezoneTouched(true);
          setForm((f) => ({ ...f, timezone: next }));
          setSaved(false);
        }}
      />

      <fieldset className="space-y-1">
        <legend className="mb-2 text-sm font-medium text-foreground">
          {copy.channels}
        </legend>
        {channels.map(([key, label]) => (
          <SettingsToggleRow
            key={key}
            label={label}
            checked={Boolean(form[key])}
            disabled={!canManage}
            onCheckedChange={(next) => toggle(key, next)}
          />
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-sm font-medium text-foreground">
          {copy.deadlineAlerts}
        </legend>
        {deadlines.map(([key, label]) => (
          <SettingsToggleRow
            key={key}
            label={label}
            checked={Boolean(form[key])}
            disabled={!canManage}
            onCheckedChange={(next) => toggle(key, next)}
          />
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-sm font-medium text-foreground">
          {copy.otherAlerts}
        </legend>
        {other.map(([key, label]) => (
          <SettingsToggleRow
            key={key}
            label={label}
            checked={Boolean(form[key])}
            disabled={!canManage}
            onCheckedChange={(next) => toggle(key, next)}
          />
        ))}
      </fieldset>

      {error ? (
        <Alert variant="danger" title="Couldn’t save preferences">
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <Alert variant="success" title="Saved">
          {copy.prefsSaved}
        </Alert>
      ) : null}

      {canManage ? (
        <Button type="submit" loading={pending}>
          {copy.savePrefs}
        </Button>
      ) : null}
    </form>
  );
}
