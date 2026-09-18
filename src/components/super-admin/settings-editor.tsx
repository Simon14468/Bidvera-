"use client";

import { saUpdateSetting } from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SettingsEditor({
  settings,
}: {
  settings: Array<{ key: string; value: unknown; description: string | null }>;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Confirm Super Admin password"
        className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      />
      {settings.map((s) => (
        <form
          key={s.key}
          className="grid gap-2 rounded-xl border border-slate-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            let value: unknown = String(fd.get("value") ?? "");
            try {
              value = JSON.parse(String(value));
            } catch {
              /* keep string */
            }
            start(async () => {
              const r = await saUpdateSetting(
                { key: s.key, value, description: s.description },
                password,
              );
              setMsg(r.ok ? `Updated ${s.key}` : r.error.message);
              if (r.ok) router.refresh();
            });
          }}
        >
          <p className="font-medium text-white">{s.key}</p>
          {s.description ? <p className="text-xs text-slate-500">{s.description}</p> : null}
          <textarea
            name="value"
            defaultValue={JSON.stringify(s.value, null, 2)}
            rows={3}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={pending || !password}
            className="w-fit rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
          >
            Save
          </button>
        </form>
      ))}
      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
    </div>
  );
}
