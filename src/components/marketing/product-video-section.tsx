"use client";

import { cn } from "@/lib/cn";
import { Play } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";

export type LandingVideoPublic = {
  title: string;
  description: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
};

function youtubeThumb(id: string, quality: "maxresdefault" | "hqdefault" = "maxresdefault") {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}

export function ProductVideoSection({
  video,
  embedded = false,
}: {
  video: LandingVideoPublic;
  embedded?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbQuality, setThumbQuality] = useState<"maxresdefault" | "hqdefault">(
    "maxresdefault",
  );

  const youtubeId = video.youtubeId;
  const hasYoutube = Boolean(youtubeId);
  const hasFile = Boolean(video.videoUrl);

  const posterSrc =
    video.posterUrl ||
    (youtubeId ? youtubeThumb(youtubeId, thumbQuality) : null);

  const onThumbError = useCallback(() => {
    if (thumbQuality === "maxresdefault") setThumbQuality("hqdefault");
  }, [thumbQuality]);

  const startPlayback = () => setPlaying(true);

  const player = (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl bg-[#0a0a0a]",
        "border border-border/80 shadow-[var(--shadow-lift)]",
      )}
    >
      {!playing ? (
        <button
          type="button"
          onClick={startPlayback}
          className={cn(
            "group absolute inset-0 flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF6D] focus-visible:ring-offset-2",
          )}
          aria-label={`Play video: ${video.title}`}
        >
          {posterSrc ? (
            <Image
              src={posterSrc}
              alt=""
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              sizes="(max-width: 768px) 100vw, 896px"
              loading="lazy"
              unoptimized={Boolean(youtubeId && !video.posterUrl)}
              onError={onThumbError}
            />
          ) : hasFile ? (
            <video
              className="absolute inset-0 size-full object-cover"
              src={video.videoUrl!}
              muted
              playsInline
              preload="metadata"
              aria-hidden
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#1a1d1f] via-[#121414] to-[#4CAF6D]/50"
              aria-hidden
            />
          )}

          {/* Brand wash — keeps Bidvera look over YouTube thumb */}
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/25"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#4CAF6D]/25"
            aria-hidden
          />

          <span
            className={cn(
              "relative z-10 flex size-14 items-center justify-center rounded-full sm:size-[4.5rem] md:size-20",
              "bg-[#4CAF6D] text-white shadow-[0_8px_28px_rgba(76,175,109,0.45)]",
              "transition duration-200 ease-out",
              "group-hover:scale-110 group-hover:bg-[#3f9a5c] group-hover:shadow-[0_10px_32px_rgba(76,175,109,0.55)]",
              "group-active:scale-100",
              "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            )}
          >
            <Play className="ms-0.5 size-6 fill-current sm:ms-1 sm:size-8 md:size-9" aria-hidden />
          </span>
        </button>
      ) : hasYoutube ? (
        <iframe
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          className="absolute inset-0 size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : hasFile ? (
        <video
          className="absolute inset-0 size-full bg-black object-contain"
          src={video.videoUrl!}
          poster={posterSrc ?? undefined}
          controls
          autoPlay
          playsInline
          preload="metadata"
        >
          <track kind="captions" />
        </video>
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div id="product-video" className="w-full">
        <div className="sr-only">
          <h2>{video.title}</h2>
          {video.description ? <p>{video.description}</p> : null}
        </div>
        {player}
      </div>
    );
  }

  return (
    <section
      id="product-video"
      className="border-b border-border bg-background"
      aria-labelledby="product-video-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <h2
            id="product-video-heading"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {video.title}
          </h2>
          {video.description ? (
            <p className="mt-3 text-muted">{video.description}</p>
          ) : null}
        </div>
        <div className="mx-auto mt-10 max-w-4xl animate-fade-up stagger-2">{player}</div>
      </div>
    </section>
  );
}
