import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DisqualificationRisk } from "@/domain/types";
import { riskBadgeClass, riskLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";

interface RiskCardProps {
  risk: DisqualificationRisk;
  className?: string;
}

export function RiskCard({ risk, className }: RiskCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold text-foreground">{risk.title}</h4>
          <Badge className={riskBadgeClass(risk.level)} statusIcon>
            {riskLabels[risk.level]}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted">{risk.description}</p>
        {risk.mitigation ? (
          <p className="mt-3 text-sm text-foreground">
            <span className="font-medium">Next step: </span>
            {risk.mitigation}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
