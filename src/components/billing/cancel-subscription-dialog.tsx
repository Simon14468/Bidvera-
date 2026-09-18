"use client";

import { cancelSubscriptionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Dictionary } from "@/i18n/dictionaries";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type BillingCopy = Dictionary["app"]["billing"];

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value),
    template,
  );
}

export function CancelSubscriptionDialog({
  kind,
  effectiveDate,
  copy,
}: {
  kind: "trial" | "paid";
  effectiveDate: string;
  copy: BillingCopy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="outline" type="button" onClick={() => setOpen(true)}>
        {kind === "trial" ? copy.cancelTrial : copy.cancelSubscription}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={kind === "trial" ? copy.cancelTrialTitle : copy.cancelPaidTitle}
      >
        <div className="space-y-3 text-sm text-muted">
          {kind === "trial" ? (
            <>
              <p>{copy.cancelTrialExplainConvert}</p>
              <p>{copy.cancelTrialExplainAccess}</p>
              <p>{copy.cancelTrialExplainData}</p>
            </>
          ) : (
            <>
              <p>{fill(copy.cancelPaidExplainDate, { date: effectiveDate })}</p>
              <p>{copy.cancelPaidExplainAccess}</p>
              <p>{copy.cancelPaidExplainAfter}</p>
            </>
          )}
          {error ? <p className="text-danger">{error}</p> : null}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            {copy.keepPlan}
          </Button>
          <Button
            variant="danger"
            type="button"
            loading={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await cancelSubscriptionAction(true);
                if (!result.ok) {
                  setError(result.error.message || copy.cancelError);
                  return;
                }
                setOpen(false);
                router.refresh();
              });
            }}
          >
            {copy.confirmCancel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
