"use client";

import {
  saAssignAiModel,
  saRollbackAiVersion,
  saSaveAiProviderKey,
  saSwitchAiVersion,
  saTestAiModel,
  saToggleAiModel,
  saToggleAiProvider,
  saUpsertAiModel,
} from "@/app/actions/super-admin";
import { AI_PROVIDER_OPTIONS } from "@/config/ai-providers";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const TASKS = [
  "PDF_EXTRACTION",
  "REQUIREMENT_EXTRACTION",
  "CLASSIFICATION",
  "COMPANY_MATCHING",
  "RISK_ANALYSIS",
  "FINAL_REASONING",
] as const;

const inputClass =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";

type CatalogModel = {
  id: string;
  displayName: string;
  name: string;
  version: string | null;
  latestVersion: string | null;
  previousVersion: string | null;
  active: boolean;
  provider: { key: string; name: string; active: boolean };
};

type CatalogProvider = {
  id: string;
  key: string;
  name: string;
  active: boolean;
  apiKeyEnvVar: string | null;
};

type KnownProvider = {
  key: string;
  name: string;
  keyConfigured: boolean;
  apiKeyEnvVar: string;
  hasVaultKey?: boolean;
  hasEnvKey?: boolean;
};

export function AiModelForms({
  models,
  providers,
  knownProviders,
}: {
  models: CatalogModel[];
  providers: CatalogProvider[];
  knownProviders: KnownProvider[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      {/* Providers */}
      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Providers</h2>
        <p className="mt-1 text-xs text-slate-500">
          Paste an API key for OpenAI, Anthropic Claude, or Google Gemini. Keys are encrypted
          server-side (or use env vars). Enabling a provider activates it for tender analysis
          tasks after you assign a model.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {providers.map((p) => {
            const known = knownProviders.find((k) => k.key === p.key);
            return (
              <div
                key={p.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm"
              >
                <p className="font-medium text-white">{p.name}</p>
                <p className="text-xs text-slate-500">{p.key}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Key:{" "}
                  {known?.keyConfigured ? (
                    <span className="text-emerald-400">
                      configured
                      {known.hasVaultKey ? " (vault)" : known.hasEnvKey ? " (env)" : ""}
                    </span>
                  ) : (
                    <span className="text-amber-400">missing</span>
                  )}
                </p>
                <form
                  className="mt-2 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const apiKey = String(fd.get("apiKey") || "");
                    start(async () => {
                      const form = e.currentTarget;
                      const r = await saSaveAiProviderKey({
                        providerKey: p.key as "openai" | "anthropic" | "google",
                        apiKey,
                        clear: false,
                      });
                      setMsg(
                        r.ok
                          ? `${p.name} API key saved and provider enabled${
                              r.data.assignedTasks
                                ? ` · wired ${r.data.assignedTasks} analysis tasks`
                                : ""
                            }`
                          : r.error.message,
                      );
                      if (r.ok) {
                        form.reset();
                        router.refresh();
                      }
                    });
                  }}
                >
                  <input
                    name="apiKey"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      known?.keyConfigured ? "•••••••• (replace key)" : "Paste API key"
                    }
                    className={`w-full ${inputClass}`}
                  />
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-emerald-800 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Save key
                    </button>
                    <button
                      type="button"
                      disabled={pending || !known?.hasVaultKey}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-40"
                      onClick={() =>
                        start(async () => {
                          const r = await saSaveAiProviderKey({
                            providerKey: p.key as "openai" | "anthropic" | "google",
                            clear: true,
                          });
                          setMsg(
                            r.ok ? `${p.name} vault key cleared` : r.error.message,
                          );
                          if (r.ok) router.refresh();
                        })
                      }
                    >
                      Clear vault
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      onClick={() =>
                        start(async () => {
                          const r = await saToggleAiProvider({
                            providerKey: p.key as "openai" | "anthropic" | "google",
                            active: !p.active,
                          });
                          setMsg(
                            r.ok
                              ? `${p.name} ${!p.active ? "enabled" : "disabled"}`
                              : r.error.message,
                          );
                          if (r.ok) router.refresh();
                        })
                      }
                    >
                      {p.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="grid gap-2 rounded-xl border border-slate-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await saUpsertAiModel({
                providerKey: String(fd.get("providerKey")) as
                  | "openai"
                  | "anthropic"
                  | "google",
                name: String(fd.get("name")),
                version: String(fd.get("version") || "") || null,
                latestVersion: String(fd.get("latestVersion") || "") || null,
                displayName: String(fd.get("displayName")),
                active: true,
                isDefault: fd.get("isDefault") === "on",
                maxTokens: Number(fd.get("maxTokens") || 0) || null,
                temperature: Number(fd.get("temperature") || 0) || null,
                inputCostPer1k: Number(fd.get("inputCostPer1k") || 0) || null,
                outputCostPer1k: Number(fd.get("outputCostPer1k") || 0) || null,
                notes: String(fd.get("notes") || "") || null,
              });
              setMsg(r.ok ? "Model saved" : r.error.message);
              if (r.ok) router.refresh();
            });
          }}
        >
          <h2 className="font-medium text-white">Add / update model</h2>
          <label className="text-xs text-slate-400">
            Provider
            <select name="providerKey" required className={`mt-1 w-full ${inputClass}`}>
              {AI_PROVIDER_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input name="name" required placeholder="API model id (e.g. gpt-5.6-luna)" className={inputClass} />
          <input name="displayName" required placeholder="Display name" className={inputClass} />
          <input name="version" placeholder="Active version" className={inputClass} />
          <input name="latestVersion" placeholder="Latest version (catalog)" className={inputClass} />
          <input name="maxTokens" type="number" placeholder="Max tokens" className={inputClass} />
          <input
            name="temperature"
            type="number"
            step="0.1"
            placeholder="Temperature"
            className={inputClass}
          />
          <input
            name="inputCostPer1k"
            type="number"
            step="0.0001"
            placeholder="Input $/1k"
            className={inputClass}
          />
          <input
            name="outputCostPer1k"
            type="number"
            step="0.0001"
            placeholder="Output $/1k"
            className={inputClass}
          />
          <input name="notes" placeholder="Notes" className={inputClass} />
          <label className="flex gap-2 text-sm text-slate-300">
            <input name="isDefault" type="checkbox" /> Default for provider
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm"
          >
            Save model
          </button>
        </form>

        <form
          className="grid gap-2 rounded-xl border border-slate-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await saAssignAiModel({
                task: String(fd.get("task")) as (typeof TASKS)[number],
                modelId: String(fd.get("modelId")),
                fallbackModelId: String(fd.get("fallbackModelId") || "") || null,
                active: true,
                priority: 100,
              });
              setMsg(r.ok ? "Assignment saved (active + fallback)" : r.error.message);
              if (r.ok) router.refresh();
            });
          }}
        >
          <h2 className="font-medium text-white">Assign active + fallback</h2>
          <select name="task" className={inputClass}>
            {TASKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="modelId" required className={inputClass}>
            {models
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  Active: {m.displayName} ({m.provider.name})
                </option>
              ))}
          </select>
          <select name="fallbackModelId" className={inputClass}>
            <option value="">No fallback</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                Fallback: {m.displayName} ({m.provider.name})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || models.filter((m) => m.active).length === 0}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
          >
            Assign
          </button>
        </form>
      </div>

      {/* Per-model controls */}
      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <h2 className="border-b border-slate-800 px-3 py-2 text-sm font-medium text-white">
          Models — activate, version, test, rollback
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Latest</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-t border-slate-800/70 align-top">
                <td className="px-3 py-2">
                  <p className="text-white">{m.displayName}</p>
                  <p className="text-xs text-slate-500">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.active ? "active" : "disabled"}</p>
                </td>
                <td className="px-3 py-2">{m.provider.name}</td>
                <td className="px-3 py-2">
                  {m.version ?? "—"}
                  {m.previousVersion ? (
                    <p className="text-xs text-slate-500">prev {m.previousVersion}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{m.latestVersion ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-slate-700 px-2 py-1 text-xs"
                      onClick={() =>
                        start(async () => {
                          const r = await saToggleAiModel({
                            modelId: m.id,
                            active: !m.active,
                          });
                          setMsg(r.ok ? "Toggled" : r.error.message);
                          if (r.ok) router.refresh();
                        })
                      }
                    >
                      {m.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-slate-700 px-2 py-1 text-xs"
                      onClick={() =>
                        start(async () => {
                          const r = await saTestAiModel({ modelId: m.id });
                          setMsg(
                            r.ok
                              ? r.data.message
                              : r.error.message,
                          );
                        })
                      }
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      disabled={pending || !m.previousVersion}
                      className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40"
                      onClick={() =>
                        start(async () => {
                          const r = await saRollbackAiVersion(m.id);
                          setMsg(r.ok ? "Rolled back" : r.error.message);
                          if (r.ok) router.refresh();
                        })
                      }
                    >
                      Rollback
                    </button>
                  </div>
                  <form
                    className="mt-2 flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      start(async () => {
                        const r = await saSwitchAiVersion({
                          modelId: m.id,
                          version: String(fd.get("version")),
                          note: "Switch from dashboard",
                        });
                        setMsg(r.ok ? "Version updated" : r.error.message);
                        if (r.ok) router.refresh();
                      });
                    }}
                  >
                    <input
                      name="version"
                      required
                      placeholder="New version"
                      defaultValue={m.latestVersion ?? m.version ?? ""}
                      className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded border border-emerald-800 px-2 py-1 text-xs text-emerald-300"
                    >
                      Switch
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
    </div>
  );
}
