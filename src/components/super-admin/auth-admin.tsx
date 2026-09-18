"use client";

import { saSaveAuthSettings } from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AuthSnapshot = {
  registrationEnabled: boolean;
  requireEmailVerification: boolean;
  googleEnabled: boolean;
  googleClientId: string | null;
  hasGoogleClientSecret: boolean;
  microsoftEnabled: boolean;
  microsoftClientId: string | null;
  hasMicrosoftClientSecret: boolean;
  mediumRiskTrialDelayHours: number;
  mediumRiskRequireBusinessEmail: boolean;
  highRiskBlockTrial: boolean;
};

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white";

export function AuthAdminPanel({ initial }: { initial: AuthSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasGoogleSecret, setHasGoogleSecret] = useState(
    initial.hasGoogleClientSecret,
  );
  const [hasMicrosoftSecret, setHasMicrosoftSecret] = useState(
    initial.hasMicrosoftClientSecret,
  );
  const [form, setForm] = useState({
    registrationEnabled: initial.registrationEnabled,
    requireEmailVerification: initial.requireEmailVerification,
    googleEnabled: initial.googleEnabled,
    googleClientId: initial.googleClientId ?? "",
    googleClientSecret: "",
    clearGoogleClientSecret: false,
    microsoftEnabled: initial.microsoftEnabled,
    microsoftClientId: initial.microsoftClientId ?? "",
    microsoftClientSecret: "",
    clearMicrosoftClientSecret: false,
    mediumRiskTrialDelayHours: initial.mediumRiskTrialDelayHours,
    mediumRiskRequireBusinessEmail: initial.mediumRiskRequireBusinessEmail,
    highRiskBlockTrial: initial.highRiskBlockTrial,
  });

  function toggleBool(
    key:
      | "registrationEnabled"
      | "requireEmailVerification"
      | "googleEnabled"
      | "microsoftEnabled"
      | "mediumRiskRequireBusinessEmail"
      | "highRiskBlockTrial",
    value: boolean,
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Registration & auth</h2>
      <p className="mt-1 text-sm text-slate-400">
        Control public signup, email verification, trial risk gates, and OAuth
        login credentials (Google / Microsoft).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["registrationEnabled", "Registration enabled"],
            ["requireEmailVerification", "Require email verification"],
            ["googleEnabled", "Google login"],
            ["microsoftEnabled", "Microsoft login"],
            ["mediumRiskRequireBusinessEmail", "Medium risk: require business email"],
            ["highRiskBlockTrial", "High risk: block trial activation"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200"
          >
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => toggleBool(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-4 block text-sm text-slate-300">
        Medium risk trial delay (hours)
        <input
          type="number"
          min={0}
          max={168}
          value={form.mediumRiskTrialDelayHours}
          onChange={(e) => {
            setForm((prev) => ({
              ...prev,
              mediumRiskTrialDelayHours: Number(e.target.value) || 0,
            }));
            setSaved(false);
          }}
          className={inputClass}
        />
      </label>

      {form.googleEnabled ? (
        <div className="mt-4 space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <div>
            <h3 className="text-sm font-medium text-white">Google OAuth keys</h3>
            <p className="mt-1 text-xs text-slate-500">
              From Google Cloud Console → APIs &amp; Services → Credentials
              (OAuth 2.0 Client). Client secret is stored encrypted server-side.
            </p>
          </div>
          <label className="block text-sm text-slate-300">
            Google Client ID
            <input
              className={inputClass}
              value={form.googleClientId}
              onChange={(e) => {
                setForm((f) => ({ ...f, googleClientId: e.target.value }));
                setSaved(false);
              }}
              placeholder="xxxx.apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div>
            <label className="block text-sm text-slate-300">
              Google Client Secret
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                value={form.googleClientSecret}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    googleClientSecret: e.target.value,
                    clearGoogleClientSecret: false,
                  }));
                  setSaved(false);
                }}
                placeholder={
                  hasGoogleSecret
                    ? "•••••••• (saved — leave blank to keep)"
                    : "GOCSPX-…"
                }
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">
              {hasGoogleSecret
                ? "Secret is stored encrypted server-side."
                : "No client secret saved yet."}
            </p>
            {hasGoogleSecret ? (
              <button
                type="button"
                className="mt-1 text-xs text-rose-400 hover:underline"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    googleClientSecret: "",
                    clearGoogleClientSecret: true,
                  }));
                  setHasGoogleSecret(false);
                  setSaved(false);
                }}
              >
                Clear saved client secret
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {form.microsoftEnabled ? (
        <div className="mt-4 space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <div>
            <h3 className="text-sm font-medium text-white">
              Microsoft OAuth keys
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              From Microsoft Entra admin center → App registrations → your app
              → Certificates &amp; secrets. Client secret is stored encrypted
              server-side.
            </p>
          </div>
          <label className="block text-sm text-slate-300">
            Microsoft Client ID (Application ID)
            <input
              className={inputClass}
              value={form.microsoftClientId}
              onChange={(e) => {
                setForm((f) => ({ ...f, microsoftClientId: e.target.value }));
                setSaved(false);
              }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div>
            <label className="block text-sm text-slate-300">
              Microsoft Client Secret
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                value={form.microsoftClientSecret}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    microsoftClientSecret: e.target.value,
                    clearMicrosoftClientSecret: false,
                  }));
                  setSaved(false);
                }}
                placeholder={
                  hasMicrosoftSecret
                    ? "•••••••• (saved — leave blank to keep)"
                    : "Client secret value"
                }
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">
              {hasMicrosoftSecret
                ? "Secret is stored encrypted server-side."
                : "No client secret saved yet."}
            </p>
            {hasMicrosoftSecret ? (
              <button
                type="button"
                className="mt-1 text-xs text-rose-400 hover:underline"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    microsoftClientSecret: "",
                    clearMicrosoftClientSecret: true,
                  }));
                  setHasMicrosoftSecret(false);
                  setSaved(false);
                }}
              >
                Clear saved client secret
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-emerald-400">Saved.</p> : null}

      <button
        type="button"
        disabled={pending}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await saSaveAuthSettings({
              registrationEnabled: form.registrationEnabled,
              requireEmailVerification: form.requireEmailVerification,
              googleEnabled: form.googleEnabled,
              googleClientId: form.googleClientId.trim() || null,
              googleClientSecret: form.googleClientSecret || null,
              clearGoogleClientSecret: form.clearGoogleClientSecret,
              microsoftEnabled: form.microsoftEnabled,
              microsoftClientId: form.microsoftClientId.trim() || null,
              microsoftClientSecret: form.microsoftClientSecret || null,
              clearMicrosoftClientSecret: form.clearMicrosoftClientSecret,
              mediumRiskTrialDelayHours: form.mediumRiskTrialDelayHours,
              mediumRiskRequireBusinessEmail: form.mediumRiskRequireBusinessEmail,
              highRiskBlockTrial: form.highRiskBlockTrial,
            });
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            setHasGoogleSecret(result.data.hasGoogleClientSecret);
            setHasMicrosoftSecret(result.data.hasMicrosoftClientSecret);
            setForm((f) => ({
              ...f,
              googleClientId: result.data.googleClientId ?? "",
              googleClientSecret: "",
              clearGoogleClientSecret: false,
              googleEnabled: result.data.googleEnabled,
              microsoftClientId: result.data.microsoftClientId ?? "",
              microsoftClientSecret: "",
              clearMicrosoftClientSecret: false,
              microsoftEnabled: result.data.microsoftEnabled,
              registrationEnabled: result.data.registrationEnabled,
              requireEmailVerification: result.data.requireEmailVerification,
              mediumRiskTrialDelayHours: result.data.mediumRiskTrialDelayHours,
              mediumRiskRequireBusinessEmail:
                result.data.mediumRiskRequireBusinessEmail,
              highRiskBlockTrial: result.data.highRiskBlockTrial,
            }));
            setSaved(true);
            router.refresh();
          });
        }}
      >
        {pending ? "Saving…" : "Save auth settings"}
      </button>
    </div>
  );
}
