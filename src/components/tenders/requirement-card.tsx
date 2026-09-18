import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Requirement } from "@/domain/types";
import { requirementBadgeClass, requirementLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";

interface RequirementCardProps {
  requirement: Requirement;
  className?: string;
}

export function RequirementCard({ requirement, className }: RequirementCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold text-foreground">{requirement.title}</h4>
          <Badge statusIcon className={requirementBadgeClass(requirement.status)}>
            {requirementLabels[requirement.status]}
          </Badge>
        </div>
        {requirement.description ? (
          <p className="mt-2 text-sm text-muted">{requirement.description}</p>
        ) : null}
        {requirement.evidence ? (
          <p className="mt-3 text-sm text-foreground">
            <span className="font-medium">Evidence: </span>
            {requirement.evidence}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
