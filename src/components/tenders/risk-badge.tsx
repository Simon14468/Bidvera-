import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/domain/types";
import { riskBadgeClass, riskLabels } from "@/lib/labels";

export function RiskBadge({ risk }: { risk: RiskLevel | null }) {
  if (!risk) {
    return <Badge className="border-border bg-background text-muted">—</Badge>;
  }
  return (
    <Badge statusIcon className={riskBadgeClass(risk)}>
      {riskLabels[risk]}
    </Badge>
  );
}
