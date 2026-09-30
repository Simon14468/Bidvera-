"use client";

import { saSaveNotificationChannelSettings } from "@/app/actions/super-admin";
import type { NotificationChannelAdminSnapshot } from "@/services/notifications/channel-settings";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none";

function Switch({
  on,
  label,
  disabled,
  onToggle,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span
        className={`min-w-[2.25rem] text-xs font-semibold tracking-wide ${
          on ? "text-emerald-400" : "text-slate-500"
        }`}
      >
        {on ? "ON" : "OFF"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
          "disabled:cursor-wait disabled:opacity-60",
          on
            ? "border-emerald-400/50 bg-emerald-500"
            : "border-slate-600 bg-slate-700 hover:bg-slate-600",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200",
            on ? "translate-x-6" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function NotificationChannelsAdmin({
  initial,
}: {
  initial: NotificationChannelAdminSnapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [snap, setSnap] = useState(initial);

  const [whatsappVisible, setWhatsappVisible] = useState(initial.whatsappVisible);
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState(
    initial.whatsappPhoneNumberId ?? "",
  );
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState(
    initial.whatsappBusinessAccountId ?? "",
  );
  const [whatsappApiVersion, setWhatsappApiVersion] = useState(
    initial.whatsappApiVersion || "v21.0",
  );
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [clearWhatsappAccessToken, setClearWhatsappAccessToken] =
    useState(false);

  const [smsVisible, setSmsVisible] = useState(initial.smsVisible);
  const [smsProvider, setSmsProvider] = useState<"none" | "twilio">(
    initial.smsProvider === "twilio" ? "twilio" : "none",
  );
  const [smsAccountSid, setSmsAccountSid] = useState(
    initial.smsAccountSid ?? "",
  );
  const [smsFromNumber, setSmsFromNumber] = useState(
    initial.smsFromNumber ?? "",
  );
  const [smsAuthToken, setSmsAuthToken] = useState("");
  const [clearSmsAuthToken, setClearSmsAuthToken] = useState(false);

  const [pushVisible, setPushVisible] = useState(initial.pushVisible);

  function applySnap(next: NotificationChannelAdminSnapshot) {
    setSnap(next);
    setWhatsappVisible(next.whatsappVisible);
    setWhatsappPhoneNumberId(next.whatsappPhoneNumberId ?? "");
    setWhatsappBusinessAccountId(next.whatsappBusinessAccountId ?? "");
    setWhatsappApiVersion(next.whatsappApiVersion || "v21.0");
    setWhatsappAccessToken("");
    setClearWhatsappAccessToken(false);
    setSmsVisible(next.smsVisible);
    setSmsProvider(next.smsProvider === "twilio" ? "twilio" : "none");
    setSmsAccountSid(next.smsAccountSid ?? "");
    setSmsFromNumber(next.smsFromNumber ?? "");
    setSmsAuthToken("");
    setClearSmsAuthToken(false);
    setPushVisible(next.pushVisible);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await saSaveNotificationChannelSettings({
            whatsappVisible,
            whatsappPhoneNumberId,
            whatsappBusinessAccountId,
            whatsappApiVersion,
            whatsappAccessToken: whatsappAccessToken || null,
            clearWhatsappAccessToken,
            smsVisible,
            smsProvider,
            smsAccountSid,
            smsFromNumber,
            smsAuthToken: smsAuthToken || null,
            clearSmsAuthToken,
            pushVisible,
          });
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          applySnap(result.data);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      {/* WhatsApp / Meta */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              WhatsApp (Meta Cloud API)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Store Meta Graph API credentials. The access token is encrypted at
              rest and never shown again. Companies only see WhatsApp when this
              channel is ON.
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-xs text-slate-500">
              Token:{" "}
              {snap.hasWhatsappAccessToken
                ? `${snap.whatsappAccessTokenHint ?? "••••"} (${snap.whatsappAccessTokenSource})`
                : "not set"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-800 px-4 py-3">
          <div>
            <p className="font-medium text-white">Show to companies</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Requires Phone Number ID + Meta access token.
            </p>
          </div>
          <Switch
            on={whatsappVisible}
            label={`WhatsApp visible: ${whatsappVisible ? "on" : "off"}`}
            disabled={pending}
            onToggle={() => setWhatsappVisible((v) => !v)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Phone Number ID
            <input
              className={inputClass}
              value={whatsappPhoneNumberId}
              onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
              placeholder="Meta WhatsApp phone_number_id"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm text-slate-300">
            WhatsApp Business Account ID
            <input
              className={inputClass}
              value={whatsappBusinessAccountId}
              onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
              placeholder="Optional WABA id"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Graph API version
            <input
              className={inputClass}
              value={whatsappApiVersion}
              onChange={(e) => setWhatsappApiVersion(e.target.value)}
              placeholder="v21.0"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Meta access token
            <input
              type="password"
              className={inputClass}
              value={whatsappAccessToken}
              onChange={(e) => {
                setWhatsappAccessToken(e.target.value);
                setClearWhatsappAccessToken(false);
              }}
              placeholder={
                snap.hasWhatsappAccessToken
                  ? "Leave blank to keep current token"
                  : "Paste permanent / system-user token"
              }
              autoComplete="new-password"
            />
          </label>
        </div>
        {snap.hasWhatsappAccessToken ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={clearWhatsappAccessToken}
              onChange={(e) => {
                setClearWhatsappAccessToken(e.target.checked);
                if (e.target.checked) setWhatsappAccessToken("");
              }}
            />
            Clear stored Meta access token
          </label>
        ) : null}
      </section>

      {/* SMS / Twilio */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              SMS (Twilio)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Provider auth for outbound SMS alerts. Auth token is encrypted at
              rest. Companies only see SMS when this channel is ON.
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-xs text-slate-500">
              Auth token:{" "}
              {snap.hasSmsAuthToken
                ? `${snap.smsAuthTokenHint ?? "••••"} (${snap.smsAuthTokenSource})`
                : "not set"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-800 px-4 py-3">
          <div>
            <p className="font-medium text-white">Show to companies</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Requires Twilio Account SID, Auth Token, and From number.
            </p>
          </div>
          <Switch
            on={smsVisible}
            label={`SMS visible: ${smsVisible ? "on" : "off"}`}
            disabled={pending}
            onToggle={() => {
              setSmsVisible((v) => {
                const next = !v;
                if (next && smsProvider === "none") setSmsProvider("twilio");
                return next;
              });
            }}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Provider
            <select
              className={inputClass}
              value={smsProvider}
              onChange={(e) =>
                setSmsProvider(e.target.value === "twilio" ? "twilio" : "none")
              }
            >
              <option value="none">None</option>
              <option value="twilio">Twilio</option>
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            From number
            <input
              className={inputClass}
              value={smsFromNumber}
              onChange={(e) => setSmsFromNumber(e.target.value)}
              placeholder="+15551234567"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Twilio Account SID
            <input
              className={inputClass}
              value={smsAccountSid}
              onChange={(e) => setSmsAccountSid(e.target.value)}
              placeholder="ACxxxxxxxx…"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Twilio Auth Token
            <input
              type="password"
              className={inputClass}
              value={smsAuthToken}
              onChange={(e) => {
                setSmsAuthToken(e.target.value);
                setClearSmsAuthToken(false);
              }}
              placeholder={
                snap.hasSmsAuthToken
                  ? "Leave blank to keep current token"
                  : "Paste Twilio Auth Token"
              }
              autoComplete="new-password"
            />
          </label>
        </div>
        {snap.hasSmsAuthToken ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={clearSmsAuthToken}
              onChange={(e) => {
                setClearSmsAuthToken(e.target.checked);
                if (e.target.checked) setSmsAuthToken("");
              }}
            />
            Clear stored Twilio Auth Token
          </label>
        ) : null}
      </section>

      {/* Push */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Push</h2>
            <p className="mt-1 text-sm text-slate-400">
              Visibility only for now. Provider keys can be added when a push
              adapter is wired.
            </p>
          </div>
          <Switch
            on={pushVisible}
            label={`Push visible: ${pushVisible ? "on" : "off"}`}
            disabled={pending}
            onToggle={() => setPushVisible((v) => !v)}
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-400">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save channel settings"}
      </button>
    </form>
  );
}
