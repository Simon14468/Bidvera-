"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  subscriptionId: string;
  planId?: string;
  interval?: "MONTH" | "YEAR";
  redirectTo?: string;
}

export function PayPalActivate({
  subscriptionId,
  planId,
  interval = "MONTH",
  redirectTo = "/billing?activated=1",
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("Activating subscription…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId, planId, interval }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setMessage(data.error ?? "Activation pending — webhook will finalize access.");
          return;
        }
        setMessage("Subscription active. Redirecting…");
        router.replace(redirectTo);
        router.refresh();
      } catch {
        if (!cancelled) {
          setMessage("Activation pending — refresh after PayPal confirms payment.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subscriptionId, planId, interval, router, redirectTo]);

  return (
    <p className="text-center text-sm text-muted" role="status">
      {message}
    </p>
  );
}
