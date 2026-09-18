import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function TenderDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-muted/40" />
        <div className="h-8 w-2/3 max-w-md rounded bg-muted/50" />
        <div className="h-4 w-48 rounded bg-muted/30" />
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm font-medium text-foreground">
            Preparing your decision analysis…
          </p>
          <p className="text-sm text-muted">
            Loading persisted results from your completed tender analysis.
          </p>
          <Progress value={40} label="Loading results" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-muted/20" />
        <div className="h-32 rounded-xl bg-muted/20" />
        <div className="h-40 rounded-xl bg-muted/20" />
      </div>
    </div>
  );
}
