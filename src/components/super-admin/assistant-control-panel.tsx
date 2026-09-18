"use client";

import {
  saRevealAssistantSecrets,
  saSaveAssistantControl,
  saTestAssistantConnection,
  saTestElevenLabsConnection,
} from "@/app/actions/super-admin";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Snapshot = {
  enabled: boolean;
  voiceEnabled: boolean;
  providerKey: "openai" | "anthropic" | "google";
  modelName: string;
  baseUrl: string | null;
  hasAssistantApiKey: boolean;
  hasElevenLabsApiKey: boolean;
};

const PROVIDER_DEFAULTS: Record<
  Snapshot["providerKey"],
  { model: string; placeholder: string; keyHint: string }
> = {
  openai: {
    model: "gpt-4o-mini",
    placeholder: "gpt-4o-mini",
    keyHint: "OpenAI / compatible key (usually starts with sk-)",
  },
  anthropic: {
    model: "claude-sonnet-4-20250514",
    placeholder: "claude-sonnet-4-20250514",
    keyHint: "Anthropic key (usually starts with sk-ant-)",
  },
  google: {
    model: "gemini-2.0-flash",
    placeholder: "gemini-2.0-flash",
    keyHint: "Google AI key (usually starts with AIza)",
  },
};

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white";

function SecretField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  show,
  onToggleShow,
  onReveal,
  revealPending,
  canReveal,
  onClear,
  showClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
  show: boolean;
  onToggleShow: () => void;
  onReveal: () => void;
  revealPending: boolean;
  canReveal: boolean;
  onClear?: () => void;
  showClear: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-slate-300">
        {label}
        <div className="relative mt-1">
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className={`${inputClass} mt-0 pe-10`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
          <button
            type="button"
            className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-slate-400 hover:text-white"
            onClick={onToggleShow}
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </label>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="mt-1 flex flex-wrap gap-3">
        {canReveal ? (
          <button
            type="button"
            disabled={revealPending}
            className="text-xs text-sky-400 hover:underline disabled:opacity-60"
            onClick={onReveal}
          >
            {revealPending ? "Loading…" : "Show saved key"}
          </button>
        ) : null}
        {showClear ? (
          <button
            type="button"
            className="text-xs text-rose-400 hover:underline"
            onClick={onClear}
          >
            Clear saved key
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantControlPanel({ initial }: { initial: Snapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();
  const [revealing, startReveal] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAssistantKey, setShowAssistantKey] = useState(false);
  const [showElevenKey, setShowElevenKey] = useState(false);
  const [form, setForm] = useState({
    enabled: initial.enabled,
    voiceEnabled: initial.voiceEnabled,
    providerKey: initial.providerKey,
    modelName: initial.modelName.replace(/\.+$/, ""),
    baseUrl: initial.baseUrl ?? "",
    assistantApiKey: "",
    elevenLabsApiKey: "",
    clearAssistantApiKey: false,
    clearElevenLabsApiKey: false,
  });
  const [hasAssistantKey, setHasAssistantKey] = useState(initial.hasAssistantApiKey);
  const [hasElevenKey, setHasElevenKey] = useState(initial.hasElevenLabsApiKey);
  const [revealPassword, setRevealPassword] = useState("");

  const providerMeta = PROVIDER_DEFAULTS[form.providerKey];

  const modelLooksMismatched =
    (form.providerKey === "google" &&
      /^(gpt-|o[1-9]|claude)/i.test(form.modelName.trim())) ||
    (form.providerKey === "anthropic" &&
      /^(gpt-|o[1-9]|gemini)/i.test(form.modelName.trim())) ||
    (form.providerKey === "openai" &&
      /^(claude|gemini)/i.test(form.modelName.trim()));

  function onProviderChange(next: Snapshot["providerKey"]) {
    const defaults = PROVIDER_DEFAULTS[next];
    setForm((f) => {
      const previousDefault = PROVIDER_DEFAULTS[f.providerKey].model;
      const shouldResetModel =
        !f.modelName.trim() ||
        f.modelName.trim() === previousDefault ||
        f.modelName.trim() === previousDefault + ".";
      return {
        ...f,
        providerKey: next,
        modelName: shouldResetModel ? defaults.model : f.modelName.replace(/\.+$/, ""),
      };
    });
    setSaved(false);
    setTestMsg(null);
    setError(null);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Bidvera AI Assistant</h2>
      <p className="mt-1 text-sm text-slate-400">
        Keys are stored encrypted in the database (not required in .env). Tender
        analysis AI is unchanged.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => {
              setForm((f) => ({ ...f, enabled: e.target.checked }));
              setSaved(false);
            }}
          />
          AI Assistant ON
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={form.voiceEnabled}
            onChange={(e) => {
              setForm((f) => ({ ...f, voiceEnabled: e.target.checked }));
              setSaved(false);
            }}
          />
          Voice ON
        </label>
      </div>
      {form.voiceEnabled && !hasElevenKey && !form.elevenLabsApiKey ? (
        <p className="mt-2 text-xs text-amber-300">
          Voice ON needs an ElevenLabs API key below. Paste the key and Save —
          Voice turns on automatically when a key is saved.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Answer provider
          <select
            className={inputClass}
            value={form.providerKey}
            onChange={(e) =>
              onProviderChange(e.target.value as Snapshot["providerKey"])
            }
          >
            <option value="openai">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google Gemini</option>
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          Model name
          <input
            className={inputClass}
            value={form.modelName}
            onChange={(e) => {
              setForm((f) => ({ ...f, modelName: e.target.value }));
              setSaved(false);
              setTestMsg(null);
            }}
            placeholder={providerMeta.placeholder}
          />
        </label>
        {modelLooksMismatched ? (
          <p className="sm:col-span-2 text-xs text-amber-300">
            Model name looks wrong for this provider. Expected something like{" "}
            <code className="text-amber-200">{providerMeta.placeholder}</code>.
          </p>
        ) : null}
        <label className="block text-sm text-slate-300 sm:col-span-2">
          Base URL (optional — OpenAI-compatible only)
          <input
            className={inputClass}
            value={form.baseUrl}
            onChange={(e) => {
              setForm((f) => ({ ...f, baseUrl: e.target.value }));
              setSaved(false);
              setTestMsg(null);
            }}
            placeholder="https://api.openai.com/v1"
            disabled={form.providerKey !== "openai"}
          />
        </label>
      </div>

      <label className="mt-5 block max-w-sm text-sm text-slate-300">
        Confirm Super Admin password to reveal saved keys
        <input
          type="password"
          autoComplete="current-password"
          value={revealPassword}
          onChange={(e) => setRevealPassword(e.target.value)}
          placeholder="Confirm password"
          className={inputClass}
        />
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SecretField
          label="Assistant AI API key"
          value={form.assistantApiKey}
          onChange={(v) => {
            setForm((f) => ({
              ...f,
              assistantApiKey: v,
              clearAssistantApiKey: false,
            }));
            setSaved(false);
            setTestMsg(null);
          }}
          placeholder={
            hasAssistantKey && !form.assistantApiKey
              ? "•••••••• (saved — Show saved key or paste a new one)"
              : "Paste key…"
          }
          hint={`${providerMeta.keyHint}. ${
            hasAssistantKey
              ? "Encrypted in DB vault — .env not required."
              : "No key saved yet."
          }`}
          show={showAssistantKey}
          onToggleShow={() => setShowAssistantKey((s) => !s)}
          canReveal={hasAssistantKey && !form.assistantApiKey && Boolean(revealPassword)}
          revealPending={revealing}
          onReveal={() => {
            setError(null);
            startReveal(async () => {
              const result = await saRevealAssistantSecrets({ password: revealPassword });
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setForm((f) => ({
                ...f,
                assistantApiKey: result.data.assistantApiKey ?? f.assistantApiKey,
                elevenLabsApiKey:
                  result.data.elevenLabsApiKey ?? f.elevenLabsApiKey,
                clearAssistantApiKey: false,
                clearElevenLabsApiKey: false,
              }));
              if (result.data.assistantApiKey) setShowAssistantKey(true);
              if (result.data.elevenLabsApiKey) setShowElevenKey(true);
            });
          }}
          showClear={hasAssistantKey}
          onClear={() => {
            setForm((f) => ({
              ...f,
              assistantApiKey: "",
              clearAssistantApiKey: true,
            }));
            setSaved(false);
          }}
        />
        <SecretField
          label="ElevenLabs API key (voice only)"
          value={form.elevenLabsApiKey}
          onChange={(v) => {
            setForm((f) => ({
              ...f,
              elevenLabsApiKey: v,
              clearElevenLabsApiKey: false,
            }));
            setSaved(false);
          }}
          placeholder={
            hasElevenKey && !form.elevenLabsApiKey
              ? "•••••••• (saved — Show saved key or paste a new one)"
              : "xi-…"
          }
          hint={
            hasElevenKey
              ? "Encrypted in DB vault — .env not required."
              : "No ElevenLabs key saved — voice will stay off."
          }
          show={showElevenKey}
          onToggleShow={() => setShowElevenKey((s) => !s)}
          canReveal={hasElevenKey && !form.elevenLabsApiKey && Boolean(revealPassword)}
          revealPending={revealing}
          onReveal={() => {
            setError(null);
            startReveal(async () => {
              const result = await saRevealAssistantSecrets({ password: revealPassword });
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setForm((f) => ({
                ...f,
                assistantApiKey: result.data.assistantApiKey ?? f.assistantApiKey,
                elevenLabsApiKey:
                  result.data.elevenLabsApiKey ?? f.elevenLabsApiKey,
                clearAssistantApiKey: false,
                clearElevenLabsApiKey: false,
              }));
              if (result.data.assistantApiKey) setShowAssistantKey(true);
              if (result.data.elevenLabsApiKey) setShowElevenKey(true);
            });
          }}
          showClear={hasElevenKey}
          onClear={() => {
            setForm((f) => ({
              ...f,
              elevenLabsApiKey: "",
              clearElevenLabsApiKey: true,
            }));
            setSaved(false);
          }}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      {testMsg ? (
        <p
          className={`mt-3 text-sm ${
            testMsg.startsWith("Connected") || testMsg.startsWith("Voice connected")
              ? "text-emerald-400"
              : "text-amber-300"
          }`}
        >
          {testMsg}
        </p>
      ) : null}
      {saved ? <p className="mt-3 text-sm text-emerald-400">Assistant controls saved.</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || testing}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          onClick={() => {
            setError(null);
            setTestMsg(null);
            startTest(async () => {
              const result = await saTestAssistantConnection({
                providerKey: form.providerKey,
                modelName: form.modelName.replace(/\.+$/, ""),
                baseUrl: form.providerKey === "openai" ? form.baseUrl || null : null,
                assistantApiKey: form.assistantApiKey || null,
              });
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setTestMsg(result.data.message);
            });
          }}
        >
          {testing ? "Testing…" : "Test AI connection"}
        </button>
        <button
          type="button"
          disabled={pending || testing}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          onClick={() => {
            setError(null);
            setTestMsg(null);
            startTest(async () => {
              const result = await saTestElevenLabsConnection({
                elevenLabsApiKey: form.elevenLabsApiKey || null,
              });
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              if (!result.data.ok) {
                setTestMsg(result.data.message);
                return;
              }
              setTestMsg(result.data.message);
              // Enable Voice ON in the form after a successful key check
              setForm((f) => ({ ...f, voiceEnabled: true }));
            });
          }}
        >
          {testing ? "Testing…" : "Test voice (ElevenLabs)"}
        </button>
        <button
          type="button"
          disabled={pending || testing}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          onClick={() => {
            setError(null);
            setTestMsg(null);
            startTransition(async () => {
              const result = await saSaveAssistantControl({
                enabled: form.enabled,
                voiceEnabled: form.voiceEnabled,
                providerKey: form.providerKey,
                modelName: form.modelName.replace(/\.+$/, ""),
                baseUrl: form.providerKey === "openai" ? form.baseUrl || null : null,
                assistantApiKey: form.assistantApiKey || null,
                elevenLabsApiKey: form.elevenLabsApiKey || null,
                clearAssistantApiKey: form.clearAssistantApiKey,
                clearElevenLabsApiKey: form.clearElevenLabsApiKey,
              });
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setHasAssistantKey(result.data.hasAssistantApiKey);
              setHasElevenKey(result.data.hasElevenLabsApiKey);
              // Keep revealed keys in the field so you can still see them after save
              setForm((f) => ({
                ...f,
                clearAssistantApiKey: false,
                clearElevenLabsApiKey: false,
                enabled: result.data.enabled,
                voiceEnabled: result.data.voiceEnabled,
                providerKey: result.data.providerKey,
                modelName: result.data.modelName,
                baseUrl: result.data.baseUrl ?? "",
              }));
              setSaved(true);
              router.refresh();
            });
          }}
        >
          {pending ? "Saving…" : "Save assistant controls"}
        </button>
      </div>
    </div>
  );
}
