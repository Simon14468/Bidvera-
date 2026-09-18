import { Badge } from "@/components/ui/badge";
import type { DecisionType } from "@/domain/types";
import { getLocale } from "@/i18n/get-locale";
import {
  decisionBadgeClass,
  getDecisionLabel,
  getPendingDecisionLabel,
} from "@/lib/labels";
import { cn } from "@/lib/cn";

export async function DecisionBadge({
  decision,
  className,
}: {
  decision: DecisionType | null;
  className?: string;
}) {
  const locale = await getLocale();

  if (!decision) {
    return (
      <Badge className={cn("border-border bg-background text-muted", className)}>
        {getPendingDecisionLabel(locale)}
      </Badge>
    );
  }
  return (
    <Badge
      statusIcon
      className={cn(
        "font-semibold tracking-tight",
        decisionBadgeClass(decision),
        className,
      )}
    >
      {getDecisionLabel(decision, locale)}
    </Badge>
  );
}
