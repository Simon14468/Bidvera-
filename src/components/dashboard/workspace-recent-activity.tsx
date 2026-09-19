import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkspaceActivityItem } from "@/application/workspace-dashboard";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { AppModuleBundle } from "@/i18n/app-modules";
import Link from "next/link";

export function WorkspaceRecentActivity({
  items,
  locale,
  labels,
}: {
  items: WorkspaceActivityItem[];
  locale: Locale;
  labels: AppModuleBundle["common"];
}) {
  const kindLabel: Record<string, string> = {
    document: labels.activityDocument,
    client_request: labels.activityClientRequest,
    decision: labels.activityDecision,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{labels.recentActivityTitle}</CardTitle>
        <CardDescription>{labels.recentActivityHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <p className="text-sm text-muted">{labels.recentActivityEmpty}</p>
          </div>
        ) : (
          items.map((item) => {
            const inner = (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-3 transition hover:border-primary/25 hover:bg-background">
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {kindLabel[item.kind] ?? item.kind}
                  </p>
                  <p className="truncate text-sm font-medium">{item.title}</p>
                </div>
                <time className="shrink-0 text-xs text-muted" dateTime={item.at}>
                  {formatDate(item.at, locale)}
                </time>
              </div>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={item.id}>{inner}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
