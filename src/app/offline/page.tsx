import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Bidvera</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Bidvera needs a connection for live tender data. Reconnect, then open your dashboard
          again.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
