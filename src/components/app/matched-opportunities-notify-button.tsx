"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const POLL_MS = 60_000;

function formatBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export function MatchedOpportunitiesNotifyButton({
  initialCount,
  label,
  newMatchesLabel,
}: {
  initialCount: number;
  label: string;
  newMatchesLabel: string;
}) {
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/matching-engine/new-matches-count", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json().catch(() => null)) as {
        count?: unknown;
      } | null;
      if (typeof body?.count === "number" && Number.isFinite(body.count)) {
        setCount(Math.max(0, Math.floor(body.count)));
      }
    } catch {
      // Keep last known count on transient network errors.
    }
  }, []);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const matchBadge = formatBadge(count);

  return (
    <Link
      href="/matched-opportunities"
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={
        matchBadge
          ? newMatchesLabel.replace("{count}", matchBadge)
          : label
      }
      title={label}
    >
      <Bell className="size-4" aria-hidden />
      {matchBadge ? (
        <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
          {matchBadge}
        </span>
      ) : null}
    </Link>
  );
}
