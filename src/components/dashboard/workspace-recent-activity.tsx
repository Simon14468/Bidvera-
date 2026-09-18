import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceActivityItem } from "@/application/workspace-dashboard";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import Link from "next/link";

const KIND_LABEL: Record<string, string> = {
  document: "Document updated",
  client_request: "Client request",
  decision: "Decision activity",
};

export function WorkspaceRecentActivity({
  items,
  locale,
}: {
  items: WorkspaceActivityItem[];
  locale: Locale;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest updates in your company workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <p className="text-sm text-muted">No recent activity yet.</p>
          </div>
        ) : (
          items.map((item) => {
            const inner = (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-3 transition hover:border-primary/25 hover:bg-background">
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {KIND_LABEL[item.kind] ?? item.kind}
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
