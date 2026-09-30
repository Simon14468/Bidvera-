"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "confirming" | "active" | "failed" | "timeout";

type StatusPayload = {
  ok?: boolean;
  confirmed?: boolean;
  status?: string | null;
  planName?: string | null;
  planSlug?: string | null;
  error?: string;
};

const POLL_MS = 2000;
const MAX_POLLS = 15;

/**
 * Post-checkout UX on /dashboard.
 * Query params only trigger server verification — they never mean "payment succeeded".
 */
export function CheckoutConfirmation({
  stripeSessionId,
  paypalSubscriptionId,
}: {
  stripeSessionId?: string | null;
  paypalSubscriptionId?: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("confirming");
  const [planName, setPlanName] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!stripeSessionId && !paypalSubscriptionId) return;
    started.current = true;

    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function activateOnce() {
      if (stripeSessionId) {
        const res = await fetch("/api/billing/activate-stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: stripeSessionId }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          // Soft failure: webhook may still finalize — keep polling.
          if (res.status === 403 || res.status === 401) {
            throw new Error(json.error ?? "forbidden");
          }
        }
        return;
      }
      if (paypalSubscriptionId) {
        const res = await fetch("/api/billing/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId: paypalSubscriptionId }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 403 || res.status === 401) {
            throw new Error(json.error ?? "forbidden");
          }
        }
      }
    }

    async function pollStatus(): Promise<boolean> {
      const res = await fetch("/api/billing/subscription-status", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return false;
      const json = (await res.json()) as StatusPayload;
      if (json.confirmed) {
        if (!cancelled) {
          setPlanName(json.planName ?? null);
          setPhase("active");
          router.refresh();
        }
        return true;
      }
      return false;
    }

    (async () => {
      try {
        await activateOnce();
      } catch {
        if (!cancelled) setPhase("failed");
        return;
      }

      const tick = async () => {
        if (cancelled) return;
        try {
          if (await pollStatus()) return;
        } catch {
          /* keep polling */
        }
        polls += 1;
        if (polls >= MAX_POLLS) {
          if (!cancelled) setPhase("timeout");
          return;
        }
        timer = setTimeout(tick, POLL_MS);
      };

      await tick();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [stripeSessionId, paypalSubscriptionId, router]);

  if (!stripeSessionId && !paypalSubscriptionId) return null;

  if (phase === "active") {
    return (
      <div
        className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm"
        role="status"
      >
        <p className="font-medium text-foreground">
          {planName
            ? `Your ${planName} subscription is active.`
            : "Your subscription is active."}
        </p>
        <p className="mt-1 text-muted">
          Entitlements come from your verified billing status — not from the payment redirect.
        </p>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div
        className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm"
        role="alert"
      >
        <p className="font-medium text-foreground">
          Payment could not be confirmed. Please check your billing status or contact support.
        </p>
        <Link href="/billing" className="mt-2 inline-block text-primary underline">
          Open billing
        </Link>
      </div>
    );
  }

  if (phase === "timeout") {
    return (
      <div
        className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
        role="status"
      >
        <p className="font-medium text-foreground">Your payment is being confirmed…</p>
        <p className="mt-1 text-muted">
          Provider confirmation can take a moment. Refresh this page or check{" "}
          <Link href="/billing" className="text-primary underline">
            Billing
          </Link>{" "}
          shortly. Premium access unlocks only after server-side verification.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <p className="font-medium text-foreground">Your payment is being confirmed…</p>
      <p className="mt-1 text-muted">
        Please wait while Bidvera verifies the payment with the provider. Do not close this page.
      </p>
    </div>
  );
}
