"use client";

import {
  compareDecisionSimulationScenariosAction,
  fetchDecisionSimulatorContextAction,
  runDecisionSimulationScenarioAction,
} from "@/app/actions/decision-simulator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DecisionSimulationResult,
  ScenarioComparisonRow,
  SimulationQuickScenario,
} from "@/domain/decision-simulator";
import { ChevronDown, ChevronUp, FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type DecisionSimulatorPanelProps = {
  tenderId: string;
  disabled?: boolean;
  /** Defer canonical fetch until the panel enters the viewport. */
  lazyLoad?: boolean;
};

export function DecisionSimulatorPanel({
  tenderId,
  disabled = false,
  lazyLoad = false,
}: DecisionSimulatorPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(!lazyLoad);
  const [loading, setLoading] = useState(!lazyLoad);
  const loadKey = shouldLoad ? tenderId : null;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    if (loadKey) setLoading(true);
  }
  const [error, setError] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [currentDecision, setCurrentDecision] = useState("—");
  const [blockerCount, setBlockerCount] = useState(0);
  const [quickScenarios, setQuickScenarios] = useState<SimulationQuickScenario[]>([]);
  const [memoryNote, setMemoryNote] = useState<string | null>(null);
  const [result, setResult] = useState<DecisionSimulationResult | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparisonRow[] | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!lazyLoad || shouldLoad) return;
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazyLoad, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    fetchDecisionSimulatorContextAction(tenderId)
      .then((ctx) => {
        if (cancelled) return;
        setCurrentDecision(ctx.currentDecision);
        setBlockerCount(ctx.blockerCount);
        setQuickScenarios(ctx.quickScenarios);
        setMemoryNote(ctx.memoryNote);
        setUnavailableReason(ctx.unavailableReason);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load simulator.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenderId, shouldLoad]);

  const onRunScenario = useCallback(
    (scenarioId: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const simulation = await runDecisionSimulationScenarioAction(tenderId, scenarioId);
          setResult(simulation);
          setComparison(null);
          setShowDetails(false);
        } catch (e) {
          setResult(null);
          setError(e instanceof Error ? e.message : "Simulation failed.");
        }
      });
    },
    [tenderId],
  );

  const onCompareTop = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const cmp = await compareDecisionSimulationScenariosAction(
          tenderId,
          quickScenarios.slice(0, 3).map((s) => s.id),
        );
        setComparison(cmp.rows);
        setResult(null);
        setShowDetails(true);
      } catch (e) {
        setComparison(null);
        setError(e instanceof Error ? e.message : "Comparison failed.");
      }
    });
  }, [quickScenarios, tenderId]);

  const onReset = useCallback(() => {
    setResult(null);
    setComparison(null);
    setError(null);
    setShowDetails(false);
  }, []);

  if (lazyLoad && !shouldLoad) {
    return (
      <div ref={rootRef}>
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted">
            Decision Simulator loads when you scroll here.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div ref={rootRef}>
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading decision simulator…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (unavailableReason) {
    return (
      <div ref={rootRef}>
        <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4 text-primary" aria-hidden />
            Decision Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">{unavailableReason}</CardContent>
      </Card>
      </div>
    );
  }

  const topScenarios = quickScenarios.slice(0, 6);

  return (
    <div ref={rootRef}>
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="size-4 text-primary" aria-hidden />
              Decision Simulator
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Simulation only
              </Badge>
            </CardTitle>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Current decision</p>
            <p className="text-xl font-semibold tracking-tight">{currentDecision}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-xl bg-soft/60 px-4 py-3">
          <p className="text-sm font-medium">What could change it?</p>
          <p className="mt-0.5 text-sm text-muted">
            {blockerCount > 0
              ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"} identified — select a scenario to simulate.`
              : "Explore verification or evidence scenarios below."}
          </p>
        </div>

        {topScenarios.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topScenarios.map((scenario) => (
              <Button
                key={scenario.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || pending}
                className="h-auto max-w-full whitespace-normal py-2 text-left"
                onClick={() => onRunScenario(scenario.id)}
              >
                <span className="line-clamp-2">{scenario.label}</span>
                {scenario.requiresVerification ? (
                  <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                    Requires verification
                  </Badge>
                ) : null}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No quick scenarios available for this tender.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {quickScenarios.length > 1 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || pending}
              onClick={onCompareTop}
            >
              Compare top scenarios
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={pending}>
            Reset
          </Button>
        </div>

        {memoryNote ? (
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {memoryNote}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">SIMULATED</Badge>
              <span className="text-sm text-muted">{currentDecision}</span>
              <span className="text-muted">→</span>
              <span className="text-lg font-semibold">
                {result.simulated?.displayLabel ?? result.diff.simulatedDecision}
              </span>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Why?</p>
              <p className="mt-1 text-sm">{result.explanation.summary}</p>
            </div>

            {result.explanation.requiresVerification ? (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                Requires verification — simulated changes are not real evidence. Use Team
                Workflow to verify before the production decision can change.
              </p>
            ) : null}

            {result.minimalPath?.achievable && result.minimalPath.changes.length > 0 ? (
              <div className="text-sm text-muted">
                <p className="font-medium text-foreground">Minimal path to {result.minimalPath.targetLabel}</p>
                <ul className="mt-1 list-disc pl-5">
                  {result.minimalPath.changes.map((c, i) => (
                    <li key={i}>{c.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-0"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? (
                <>
                  <ChevronUp className="size-4" aria-hidden />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" aria-hidden />
                  View details
                </>
              )}
            </Button>

            {showDetails ? (
              <div className="space-y-3 border-t border-border pt-3 text-sm">
                <DetailSection title="What changed" items={result.explanation.whatChanged} />
                {result.explanation.rulesTriggered.length > 0 ? (
                  <div>
                    <p className="font-medium">Rules triggered</p>
                    <ul className="mt-1 list-disc pl-5 text-muted">
                      {result.explanation.rulesTriggered.map((r) => (
                        <li key={r.code}>
                          {r.code}: {r.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <DetailSection
                  title="Real evidence (current tender)"
                  items={result.explanation.realEvidenceSupportingCurrentState.map(
                    (e) => `${e.provenance}: ${e.label}`,
                  )}
                />
                <DetailSection
                  title="Still missing"
                  items={result.explanation.stillMissing}
                />
                <DetailSection
                  title="Actions required in reality"
                  items={result.explanation.realWorldActionsRequired}
                />
                <EvidenceProvenanceTable rows={result.evidenceProvenance} />
                <p className="text-xs text-muted">
                  Production decision remains <strong>{result.current.displayLabel}</strong>.
                  Simulations never modify the real tender, billing, credits, or alerts.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {comparison && comparison.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Scenario comparison vs {currentDecision}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-2 pr-3">Scenario</th>
                    <th className="py-2 pr-3">Result</th>
                    <th className="py-2">Changed?</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.scenarioId} className="border-b border-border/60">
                      <td className="py-2 pr-3">{row.label}</td>
                      <td className="py-2 pr-3 font-medium">{row.simulatedDecision}</td>
                      <td className="py-2">
                        {row.decisionChanged ? (
                          <Badge className="bg-primary/15 text-primary">Yes</Badge>
                        ) : (
                          <span className="text-muted">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted">
          Team Workflow tasks are not auto-completed.{" "}
          <Link href={`/tenders/${tenderId}#team-workflow`} className="underline underline-offset-2">
            Open team tasks
          </Link>
        </p>
      </CardContent>
    </Card>
    </div>
  );
}

function DetailSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-muted">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceProvenanceTable({
  rows,
}: {
  rows: DecisionSimulationResult["evidenceProvenance"];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="font-medium">Evidence provenance</p>
      <ul className="mt-1 space-y-1 text-muted">
        {rows.slice(0, 8).map((r) => (
          <li key={r.evidenceId}>
            <Badge variant="outline" className="mr-2 text-[10px]">
              {r.provenance}
            </Badge>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
