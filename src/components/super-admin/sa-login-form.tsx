"use client";

import { saLogin } from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SaLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await saLogin({ email, password });
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          router.replace(nextPath);
          router.refresh();
        });
      }}
    >
      <div>
        <h1 className="text-xl font-semibold text-white">Super Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Restricted platform access</p>
      </div>

      <label className="block text-sm">
        <span className="text-slate-400">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-400">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
