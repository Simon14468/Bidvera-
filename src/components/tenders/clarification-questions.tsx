import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Card, CardContent } from "@/components/ui/card";
import type { ClarificationQuestion } from "@/domain/tender-intelligence";
import { cn } from "@/lib/cn";
import { MessageCircleQuestion } from "lucide-react";

function priorityTone(priority: ClarificationQuestion["priority"]) {
  if (priority === "HIGH") return "text-danger";
  if (priority === "MEDIUM") return "text-warning";
  return "text-muted";
}

export function ClarificationQuestions({
  questions,
  className,
}: {
  questions: ClarificationQuestion[];
  className?: string;
}) {
  if (questions.length === 0) return null;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="size-4 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold tracking-tight">Clarification questions</h2>
      </div>
      <p className="text-sm text-muted">
        Questions you could send to the contracting authority when uncertainty is meaningful.
      </p>
      <div className="space-y-3">
        {questions.map((q) => (
          <Card key={q.id}>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="border-border bg-background text-xs">
                  {q.category}
                </Badge>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
                    priorityTone(q.priority),
                  )}
                >
                  <StatusIndicator className="size-3" />
                  {q.priority} priority
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{q.question}</p>
              <p className="mt-2 text-sm text-muted">
                <span className="font-medium text-foreground">Reason: </span>
                {q.reason}
              </p>
              <p className="mt-2 text-xs text-muted">Source: {q.source}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
