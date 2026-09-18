"use client";

import { saSaveAssistantKnowledge } from "@/app/actions/super-admin";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { defaultKnowledgeForLocale } from "@/services/ai/assistant-knowledge";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AssistantKnowledgeEditor({
  initialByLocale,
}: {
  initialByLocale: Record<Locale, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>("en");
  const [drafts, setDrafts] = useState<Record<Locale, string>>(initialByLocale);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const text = drafts[locale] ?? "";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Multilingual AI knowledge</h2>
      <p className="mt-1 text-sm text-slate-400">
        Edit Bidvera facts per language. The assistant detects the user’s question language and
        answers in the same language using that locale’s knowledge. Only real Bidvera features.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {locales.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => {
              setLocale(loc);
              setSaved(false);
              setError(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              locale === loc
                ? "bg-emerald-600 text-white"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {localeLabels[loc].english}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Editing: {localeLabels[locale].native} ({localeLabels[locale].english})
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setDrafts((prev) => ({ ...prev, [locale]: value }));
          setSaved(false);
        }}
        rows={16}
        maxLength={24000}
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm leading-relaxed text-slate-100 outline-none focus:border-emerald-600"
        spellCheck
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{text.length.toLocaleString()} / 24,000</span>
        <button
          type="button"
          className="text-emerald-400 hover:underline"
          onClick={() => {
            setDrafts((prev) => ({
              ...prev,
              [locale]: defaultKnowledgeForLocale(locale),
            }));
            setSaved(false);
          }}
        >
          Restore default for this language
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      {saved ? (
        <p className="mt-3 text-sm text-emerald-400">
          Saved {localeLabels[locale].english} knowledge. Live for new questions.
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await saSaveAssistantKnowledge({
              locale,
              instructions: drafts[locale] ?? "",
            });
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            setDrafts(result.data.byLocale);
            setSaved(true);
            router.refresh();
          });
        }}
      >
        {pending ? "Saving…" : `Save ${localeLabels[locale].english} knowledge`}
      </button>
    </div>
  );
}
