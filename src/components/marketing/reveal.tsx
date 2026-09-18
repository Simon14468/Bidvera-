"use client";

import { cn } from "@/lib/cn";
import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in ms after entering viewport */
  delay?: number;
  /** fade-up | fade | scale */
  variant?: "fade-up" | "fade" | "scale" | "decision";
  as?: ElementType;
  once?: boolean;
  style?: CSSProperties;
};

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "fade-up",
  as: Tag = "div",
  once = true,
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const visible = reduceMotion || inView;

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, reduceMotion]);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "reveal",
        `reveal-${variant}`,
        visible && "reveal-in",
        className,
      )}
      style={{
        ...(style ?? {}),
        transitionDelay: delay ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </Tag>
  );
}

/** Subtle scale on product video while scrolling through viewport. */
export function ScrollVideoFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const view = window.innerHeight || 1;
      const mid = rect.top + rect.height / 2;
      const raw = 1 - Math.abs(mid - view / 2) / (view * 0.75);
      setProgress(Math.max(0, Math.min(1, raw)));
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduceMotion]);

  const scale = reduceMotion ? 1 : 0.985 + progress * 0.025;
  const y = reduceMotion ? 0 : (1 - progress) * 8;

  return (
    <div
      ref={ref}
      className={cn("will-change-transform", className)}
      style={{
        transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
        transition: reduceMotion ? undefined : "transform 120ms linear",
      }}
    >
      {children}
    </div>
  );
}

/** Fit score bar that fills when scrolled into view. */
export function ScrollFitBar({
  value,
  className,
  delay = 280,
}: {
  /** 0–100 */
  value: number;
  className?: string;
  /** Delay after entering viewport (ms) */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const active = reduceMotion || inView;
  const clamped = Math.max(0, Math.min(100, value));

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <div
      ref={ref}
      className={cn(
        "fit-bar relative h-2 overflow-hidden rounded-full bg-border",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={active ? clamped : 0}
    >
      <div
        className={cn("fit-bar-fill h-full rounded-full bg-primary", active && "is-on")}
        style={{
          width: `${clamped}%`,
          transform: active ? "scaleX(1)" : "scaleX(0)",
          transitionDelay: reduceMotion ? undefined : `${delay}ms`,
        }}
      />
    </div>
  );
}
