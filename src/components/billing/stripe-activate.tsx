"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function StripeActivate({
  sessionId,
  redirectTo = "/billing?activated=1",
}: {
  sessionId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/activate-stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Unable to activate subscription.");
          return;
        }
        if (!cancelled) router.replace(redirectTo);
      } catch {
        if (!cancelled) setError("Unable to activate subscription.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router, redirectTo]);

  if (error) {
    return <p className="text-center text-sm text-danger">{error}</p>;
  }

  return (
    <p className="text-center text-sm text-muted">Confirming Stripe payment…</p>
  );
}
