import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AppModuleBundle } from "@/i18n/app-modules";
import Link from "next/link";

type QuickActionLabelKey =
  | "addDocument"
  | "completeQualification"
  | "createClientRequest"
  | "openQuestionnaire"
  | "reviewEvidence"
  | "reviewDeadlines";

export function WorkspaceQuickActions({
  actions,
  labels,
}: {
  actions: Array<{ id: string; href: string; labelKey: string }>;
  labels: AppModuleBundle["common"];
}) {
  if (actions.length === 0) return null;

  const actionLabels: Record<QuickActionLabelKey, string> = {
    addDocument: labels.addDocument,
    completeQualification: labels.completeQualification,
    createClientRequest: labels.createClientRequest,
    openQuestionnaire: labels.openQuestionnaire,
    reviewEvidence: labels.reviewEvidence,
    reviewDeadlines: labels.reviewDeadlines,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{labels.quickActionsTitle}</CardTitle>
        <CardDescription>{labels.quickActionsHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium transition hover:border-primary/25 hover:bg-background"
          >
            {actionLabels[action.labelKey as QuickActionLabelKey] ??
              action.labelKey}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
