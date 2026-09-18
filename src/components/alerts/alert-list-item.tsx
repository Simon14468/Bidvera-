"use client";

import { markAlertReadAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { formatRelative } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type AlertRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  status: string;
  createdAt: Date | string;
  scheduledFor: Date | string | null;
};

export function AlertListItem({
  alert,
  newBadgeLabel = "New",
  locale = "en",
}: {
  alert: AlertRow;
  newBadgeLabel?: string;
  locale?: Locale;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onOpen() {
    if (alert.status === "READ") return;
    startTransition(async () => {
      await markAlertReadAction(alert.id);
      router.refresh();
    });
  }

  const body = (
    <Card className={alert.status === "READ" ? "opacity-80" : undefined}>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{alert.title}</p>
            {alert.status !== "READ" ? (
              <Badge className="border-primary/20 bg-primary-muted text-primary">
                {newBadgeLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{alert.message}</p>
          <p className="mt-2 text-xs text-muted">
            {formatRelative(alert.scheduledFor ?? alert.createdAt, locale)}
          </p>
        </div>
        <Badge className="border-border bg-background text-muted">
          {alert.type.replaceAll("_", " ")}
        </Badge>
      </CardContent>
    </Card>
  );

  if (alert.href) {
    return (
      <Link href={alert.href} className="block hover:opacity-95" onClick={onOpen}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className="block w-full text-start" onClick={onOpen}>
      {body}
    </button>
  );
}
