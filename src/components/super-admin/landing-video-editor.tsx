"use client";

import {
  saUpdateLandingVideo,
  saUploadLandingAsset,
} from "@/app/actions/super-admin";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { FileChooseField } from "@/components/ui/file-choose-field";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type VideoRow = {
  enabled: boolean;
  title: string;
  description: string | null;
  youtubeUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
};

export function LandingVideoEditor({
  initialByLocale,
}: {
  initialByLocale: Record<Locale, VideoRow>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>("en");
  const [rows, setRows] = useState(initialByLocale);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const current = rows[locale];

  const draft = useMemo(() => current, [current]);

  function patchLocale(next: Partial<VideoRow>) {
    setRows((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], ...next },
    }));
  }

  function persist(next: {
    enabled?: boolean;
    videoUrl?: string | null;
    posterUrl?: string | null;
    clearVideo?: boolean;
    clearPoster?: boolean;
  }) {
    setError(null);
    setMessage(null);
    const row = rows[locale];
    const nextVideo =
      next.clearVideo ? null : (next.videoUrl !== undefined ? next.videoUrl : row.videoUrl);
    const nextPoster =
      next.clearPoster ? null : (next.posterUrl !== undefined ? next.posterUrl : row.posterUrl);
    const nextEnabled =
      next.enabled ??
      (Boolean(nextVideo || row.youtubeUrl?.trim()) ? true : row.enabled);

    startTransition(async () => {
      const result = await saUpdateLandingVideo({
        locale,
        enabled: nextEnabled,
        title: row.title,
        description: row.description || null,
        youtubeUrl: row.youtubeUrl || null,
        videoUrl: nextVideo,
        posterUrl: nextPoster,
        clearVideo: next.clearVideo,
        clearPoster: next.clearPoster,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRows((prev) => ({
        ...prev,
        [locale]: {
          enabled: result.data.enabled,
          title: result.data.title,
          description: result.data.description,
          youtubeUrl: result.data.youtubeUrl,
          videoUrl: result.data.videoUrl,
          posterUrl: result.data.posterUrl,
        },
      }));
      setMessage(`Saved for ${localeLabels[locale].english}.`);
      router.refresh();
    });
  }

  async function upload(kind: "video" | "poster", file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const result = await saUploadLandingAsset(fd);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (kind === "video") {
      patchLocale({ videoUrl: result.data.url, enabled: true });
      persist({ enabled: true, videoUrl: result.data.url });
    } else {
      patchLocale({ posterUrl: result.data.url });
      persist({ posterUrl: result.data.url });
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Language
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLocale(code);
                setError(null);
                setMessage(null);
              }}
              className={cn(
                "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition",
                locale === code
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500",
              )}
            >
              {localeLabels[code].short}
              <span className="ms-1.5 hidden text-xs opacity-70 sm:inline">
                {localeLabels[code].english}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Set a YouTube (or uploaded) video for each language. The landing page shows the
          video for the visitor&apos;s selected language, with English as fallback.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => patchLocale({ enabled: e.target.checked })}
          className="rounded border-slate-600"
        />
        Show product video for {localeLabels[locale].english}
      </label>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Title</label>
        <input
          value={draft.title}
          onChange={(e) => patchLocale({ title: e.target.value })}
          className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Short description</label>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => patchLocale({ description: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">
          YouTube URL ({localeLabels[locale].short})
        </label>
        <input
          value={draft.youtubeUrl ?? ""}
          onChange={(e) => patchLocale({ youtubeUrl: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=…"
          className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
          dir="ltr"
        />
        <p className="text-xs text-slate-500">
          Different URL per language — e.g. Arabic landing shows the Arabic demo video.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Uploaded video</p>
          {draft.videoUrl ? (
            <video
              src={draft.videoUrl}
              className="max-h-28 w-full rounded-lg border border-slate-700 bg-black object-contain"
              controls
              preload="metadata"
            />
          ) : (
            <p className="text-xs text-slate-500">No file uploaded</p>
          )}
          {draft.videoUrl ? (
            <p className="truncate text-xs text-emerald-400">{draft.videoUrl}</p>
          ) : null}
          <FileChooseField
            accept="video/mp4,video/webm,video/quicktime"
            variant="compact"
            tone="admin"
            uploading={pending}
            chooseLabel="Choose file"
            uploadingLabel="Uploading…"
            onFilesChange={(files) => {
              const f = files[0];
              if (f) void upload("video", f);
            }}
          />
          {draft.videoUrl ? (
            <button
              type="button"
              className="text-xs text-red-400 hover:underline"
              onClick={() => persist({ clearVideo: true, enabled: false })}
            >
              Remove uploaded video
            </button>
          ) : null}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Poster / thumbnail</p>
          {draft.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.posterUrl} alt="" className="h-20 rounded-lg object-cover" />
          ) : (
            <p className="text-xs text-slate-500">No poster</p>
          )}
          <FileChooseField
            accept="image/jpeg,image/png,image/webp"
            variant="compact"
            tone="admin"
            uploading={pending}
            chooseLabel="Choose file"
            uploadingLabel="Uploading…"
            onFilesChange={(files) => {
              const f = files[0];
              if (f) void upload("poster", f);
            }}
          />
          {draft.posterUrl ? (
            <button
              type="button"
              className="text-xs text-red-400 hover:underline"
              onClick={() => persist({ clearPoster: true })}
            >
              Remove poster
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {pending ? <p className="text-xs text-slate-400">Saving…</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => persist({ enabled: draft.enabled })}
        className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Saving…" : `Save ${localeLabels[locale].english} video`}
      </button>
    </div>
  );
}
