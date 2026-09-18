"use client";

import { openBillingPortalAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { useState, useTransition } from "react";

type BillingCopy = Dictionary["app"]["billing"];

export function UpdatePaymentMethodButton({
  copy,
  variant = "primary",
  label,
}: {
  copy: BillingCopy;
  variant?: "primary" | "outline";
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={variant}
        loading={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await openBillingPortalAction();
            if (!result.ok) {
              setError(result.error.message || copy.paymentPortalError);
              return;
            }
            window.location.href = result.data.url;
          });
        }}
      >
        {label ?? copy.updatePaymentMethod}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
