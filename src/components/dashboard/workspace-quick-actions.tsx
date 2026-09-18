import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const LABELS: Record<string, string> = {
  addDocument: "Add document",
  completeQualification: "Complete qualification",
  createClientRequest: "Create client request",
  openQuestionnaire: "Open questionnaires",
  reviewEvidence: "Review evidence",
  reviewDeadlines: "Review deadlines",
};

export function WorkspaceQuickActions({
  actions,
}: {
  actions: Array<{ id: string; href: string; labelKey: string }>;
}) {
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Shortcuts for capabilities on your current plan.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium transition hover:border-primary/25 hover:bg-background"
          >
            {LABELS[action.labelKey] ?? action.labelKey}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
