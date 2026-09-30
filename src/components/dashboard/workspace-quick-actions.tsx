import {
  Card,
  CardContent,
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
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-medium transition hover:border-primary/25 hover:bg-background sm:h-9 sm:w-auto sm:justify-start"
          >
            {actionLabels[action.labelKey as QuickActionLabelKey] ??
              action.labelKey}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
