"use client";

import { markAllAlertsReadAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function MarkAllReadButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          await markAllAlertsReadAction();
          router.refresh();
        });
      }}
    >
      {label}
    </Button>
  );
}
