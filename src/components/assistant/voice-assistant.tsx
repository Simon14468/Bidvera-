"use client";

import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import { cn } from "@/lib/cn";
import { ArrowUp, ImagePlus, MicOff, Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imagePreviewUrl?: string;
};

export type VoiceAssistantCopy = {
  askLabel: string;
  title: string;
  description: string;
  placeholder: string;
  send: string;
  thinking: string;
  play: string;
  pause: string;
  mute: string;
  unmute: string;
  voiceUnavailable: string;
  errorGeneric: string;
  attachImage: string;
  removeImage: string;
  imageOnlyOne: string;
  imageTooLarge: string;
  imageInvalid: string;
  imageQuotaReached: string;
  replyQuotaReached: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_QUOTA_LIMIT = 1;
const REPLY_QUOTA_LIMIT = 10;
const QUOTA_WINDOW_MS = 4 * 60 * 60 * 1000;
const CLIENT_ID_KEY = "bidvera_assistant_cid";
const IMAGE_QUOTA_KEY = "bidvera_assistant_image_quota";
const REPLY_QUOTA_KEY = "bidvera_assistant_reply_quota";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && existing.length >= 8) return existing.slice(0, 64);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

function readQuotaTimes(storageKey: string): number[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { times?: number[] };
    const now = Date.now();
    return (parsed.times ?? []).filter((t) => now - t < QUOTA_WINDOW_MS);
  } catch {
    return [];
  }
}

function recordQuotaSend(storageKey: string, limit: number): number {
  const times = [...readQuotaTimes(storageKey), Date.now()].slice(-limit);
  try {
    localStorage.setItem(storageKey, JSON.stringify({ times }));
  } catch {
    // ignore
  }
  return Math.max(0, limit - times.length);
}

function syncQuotaFromServer(
  storageKey: string,
  limit: number,
  remaining: number,
  resetAt: number,
) {
  try {
    const now = Date.now();
    const used = Math.max(0, limit - remaining);
    const times = Array.from({ length: used }, (_, i) => resetAt - QUOTA_WINDOW_MS + i + 1);
    localStorage.setItem(
      storageKey,
      JSON.stringify({ times: times.filter((t) => now - t < QUOTA_WINDOW_MS) }),
    );
  } catch {
    // ignore
  }
}

function readImageSendTimes(): number[] {
  return readQuotaTimes(IMAGE_QUOTA_KEY);
}

function recordImageSend(): number {
  return recordQuotaSend(IMAGE_QUOTA_KEY, IMAGE_QUOTA_LIMIT);
}

function syncImageQuotaFromServer(remaining: number, resetAt: number) {
  syncQuotaFromServer(IMAGE_QUOTA_KEY, IMAGE_QUOTA_LIMIT, remaining, resetAt);
}

function readReplySendTimes(): number[] {
  return readQuotaTimes(REPLY_QUOTA_KEY);
}

function recordReplySend(): number {
  return recordQuotaSend(REPLY_QUOTA_KEY, REPLY_QUOTA_LIMIT);
}

function syncReplyQuotaFromServer(remaining: number, resetAt: number) {
  syncQuotaFromServer(REPLY_QUOTA_KEY, REPLY_QUOTA_LIMIT, remaining, resetAt);
}

export function BidveraVoiceAssistant({
  copy,
  locale,
  voiceEnabled = true,
}: {
  copy: VoiceAssistantCopy;
  locale: string;
  voiceEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [muted, setMuted] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageQuotaLeft, setImageQuotaLeft] = useState(() =>
    typeof window === "undefined"
      ? IMAGE_QUOTA_LIMIT
      : Math.max(0, IMAGE_QUOTA_LIMIT - readImageSendTimes().length),
  );
  const [replyQuotaLeft, setReplyQuotaLeft] = useState(() =>
    typeof window === "undefined"
      ? REPLY_QUOTA_LIMIT
      : Math.max(0, REPLY_QUOTA_LIMIT - readReplySendTimes().length),
  );
  const clientId = useSyncExternalStore(
    () => () => {},
    getOrCreateClientId,
    () => "anon",
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function stopAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function clearImage() {
    if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setImageDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onPickImage(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (imageQuotaLeft <= 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (imageDataUrl) {
      setError(copy.imageOnlyOne);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (fileList.length > 1) {
      setError(copy.imageOnlyOne);
    }
    const file = fileList[0]!;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError(copy.imageInvalid);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(copy.imageTooLarge);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
      const preview = URL.createObjectURL(file);
      setImageDataUrl(dataUrl);
      setImagePreviewUrl(preview);
      setError(fileList.length > 1 ? copy.imageOnlyOne : null);
    } catch {
      setError(copy.imageInvalid);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function speak(text: string, language?: string) {
    if (!voiceEnabled || muted) return;
    stopAudio();
    setTtsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language, clientId }),
      });
      if (!res.ok) {
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      await audio.play();
    } catch {
      // Text answers remain; voice fails softly without blocking the chat.
    } finally {
      setTtsBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    const image = imageDataUrl;
    if (pending) return;
    if (replyQuotaLeft <= 0) {
      return;
    }
    if (!q && !image) return;
    setError(null);
    setQuestion("");
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      text: q,
      imagePreviewUrl: image ?? undefined,
    };
    clearImage();
    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      try {
        const res = await fetch("/api/assistant/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            locale,
            imageDataUrl: image,
            clientId,
          }),
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          answer?: string;
          answerLocale?: string;
          imageQuota?: { remaining: number; resetAt: number } | null;
          replyQuota?: { remaining: number; resetAt: number } | null;
          error?: { message?: string; code?: string };
        };
        if (!res.ok || !payload.ok || !payload.answer) {
          if (res.status === 429 || payload.error?.code === "RATE_LIMITED") {
            const msg = payload.error?.message ?? "";
            if (/image/i.test(msg)) {
              setImageQuotaLeft(0);
            } else {
              setReplyQuotaLeft(0);
            }
          } else {
            setError(payload.error?.message ?? copy.errorGeneric);
          }
          return;
        }
        if (payload.replyQuota) {
          setReplyQuotaLeft(payload.replyQuota.remaining);
          syncReplyQuotaFromServer(
            payload.replyQuota.remaining,
            payload.replyQuota.resetAt,
          );
        } else {
          setReplyQuotaLeft(recordReplySend());
        }
        if (image) {
          if (payload.imageQuota) {
            setImageQuotaLeft(payload.imageQuota.remaining);
            syncImageQuotaFromServer(
              payload.imageQuota.remaining,
              payload.imageQuota.resetAt,
            );
          } else {
            setImageQuotaLeft(recordImageSend());
          }
        }
        const assistantMsg: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.answer,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await speak(payload.answer, payload.answerLocale);
      } catch {
        setError(copy.errorGeneric);
      }
    });
  }

  const repliesFrozen = replyQuotaLeft <= 0;
  const imagesFrozen = imageQuotaLeft <= 0;
  const canSend =
    !pending &&
    !repliesFrozen &&
    (question.trim().length >= 2 || Boolean(imageDataUrl));
  const attachFrozen =
    pending || repliesFrozen || imagesFrozen || Boolean(imageDataUrl);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border border-border/80",
            "bg-[#F4F6F4] text-sm font-medium text-[#2A322A]",
            "shadow-[var(--shadow-lift)] transition hover:scale-[1.02] active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "p-1.5 sm:py-1.5 sm:pe-4 sm:ps-1.5",
            "animate-fade-in",
          )}
          aria-label={copy.askLabel}
        >
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border/60",
              "md:assistant-fab-mark",
            )}
          >
            <Image
              src={BRAND_MARK_SRC}
              alt=""
              width={22}
              height={22}
              unoptimized
              className="object-contain md:assistant-fab-mark__icon"
            />
          </span>
          <span className="hidden sm:inline">{copy.askLabel}</span>
        </button>
      ) : null}

      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          stopAudio();
        }}
        title={copy.title}
        titleIcon={
          <Image
            src={BRAND_MARK_SRC}
            alt=""
            width={28}
            height={28}
            unoptimized
            className="size-7 object-contain"
          />
        }
        side="right"
        variant="panel"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div
            ref={listRef}
            className={
              messages.length === 0 && !pending
                ? "hidden"
                : "flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-background/60 p-3 md:max-h-[min(48vh,22rem)]"
            }
            aria-live="polite"
          >
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[88%] space-y-2 rounded-2xl rounded-ee-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                    {m.imagePreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- chat preview (blob/data URL)
                      <img
                        src={m.imagePreviewUrl}
                        alt=""
                        className="block max-h-48 w-full min-w-[10rem] rounded-xl object-cover"
                      />
                    ) : null}
                    {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-end gap-2">
                  <span className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
                    <Image
                      src={BRAND_MARK_SRC}
                      alt=""
                      width={18}
                      height={18}
                      unoptimized
                      className="object-contain"
                    />
                  </span>
                  <div className="max-w-[82%] rounded-2xl rounded-es-md border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
                    {m.text}
                  </div>
                </div>
              ),
            )}

            {pending ? (
              <div className="flex items-end gap-2">
                <span className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
                  <Image
                    src={BRAND_MARK_SRC}
                    alt=""
                    width={18}
                    height={18}
                    unoptimized
                    className="object-contain"
                  />
                </span>
                <div className="rounded-2xl rounded-es-md border border-border bg-card px-3.5 py-2.5 text-sm text-muted animate-pulse-soft">
                  {copy.thinking}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex shrink-0 flex-col gap-3 border-t border-border/60 bg-card pt-3">
            {voiceEnabled ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (next) stopAudio();
                  }}
                  aria-label={muted ? copy.unmute : copy.mute}
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  <span className="ms-1.5">{muted ? copy.unmute : copy.mute}</span>
                </Button>
                {ttsBusy ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <MicOff className="size-3.5" />
                    …
                  </span>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            {imagePreviewUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="h-20 w-20 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={pending || repliesFrozen}
                  className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-sm disabled:pointer-events-none disabled:opacity-40"
                  aria-label={copy.removeImage}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                multiple={false}
                disabled={attachFrozen}
                onChange={(e) => void onPickImage(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={attachFrozen}
                aria-disabled={attachFrozen}
                aria-label={copy.attachImage}
                title={
                  repliesFrozen
                    ? copy.replyQuotaReached
                    : imagesFrozen
                      ? copy.imageQuotaReached
                      : imageDataUrl
                        ? copy.imageOnlyOne
                        : copy.attachImage
                }
                className="size-11 shrink-0 rounded-full p-0 disabled:opacity-40"
                onClick={(e) => {
                  if (attachFrozen) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  fileInputRef.current?.click();
                }}
              >
                <ImagePlus className="size-5" aria-hidden />
              </Button>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={copy.placeholder}
                disabled={pending || repliesFrozen}
                readOnly={repliesFrozen}
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none ring-ring focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={2000}
              />
              <Button
                type="submit"
                disabled={!canSend}
                aria-disabled={!canSend}
                aria-label={copy.send}
                title={repliesFrozen ? copy.replyQuotaReached : copy.send}
                className="size-11 shrink-0 rounded-full p-0 disabled:opacity-40"
              >
                <ArrowUp className="size-5 stroke-[2.25]" aria-hidden />
              </Button>
            </form>
          </div>
          <audio ref={audioRef} className="hidden" preload="none" />
        </div>
      </Drawer>
    </>
  );
}
