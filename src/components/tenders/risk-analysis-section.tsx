import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ContradictionFinding,
  StructuredRisk,
} from "@/domain/tender-intelligence";
import { riskBadgeClass, riskLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { AlertTriangle, Scale } from "lucide-react";
import { InlineSourceTrace } from "./source-viewer";

export function RiskAnalysisSection({
  risks,
  contradictions,
  tenderId,
  className,
}: {
  risks: StructuredRisk[];
  contradictions: ContradictionFinding[];
  tenderId: string;
  className?: string;
}) {
  const sorted = [...risks].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <section className={cn("space-y-4", className)}>
      {contradictions.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-warning" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight">
              Contradictions &amp; ambiguities
            </h2>
          </div>
          {contradictions.map((c) => (
            <Card key={c.id} className="border-warning/25 bg-warning/[0.04]">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                  Potential contradiction
                </p>
                <h3 className="mt-1 text-sm font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-muted">{c.description}</p>
                <ul className="mt-3 space-y-1 text-sm text-foreground">
                  {c.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm">
                  <span className="font-medium">Recommended action: </span>
                  {c.recommendedAction}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight">Risks</h2>
        </div>
        <p className="text-sm text-muted">
          Meaningful risks that may affect the decision to bid or ability to comply.
        </p>
        {sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted">
            No significant risks flagged beyond standard review.
          </p>
        ) : (
          sorted.map((risk) => (
            <Card key={risk.id}>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{risk.title}</h3>
                  <Badge statusIcon className={riskBadgeClass(risk.severity)}>
                    {riskLabels[risk.severity]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{risk.category}</p>
                <p className="mt-2 text-sm text-muted">{risk.explanation}</p>
                <p className="mt-3 text-sm">
                  <span className="font-medium">Impact: </span>
                  {risk.impact}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Recommended action: </span>
                  {risk.recommendedAction}
                </p>
                <InlineSourceTrace
                  document={risk.source.document}
                  page={risk.source.page}
                  section={risk.source.section}
                  excerpt={risk.source.excerpt}
                  basis={risk.source.basis}
                  located={risk.source.located}
                  tenderId={tenderId}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
