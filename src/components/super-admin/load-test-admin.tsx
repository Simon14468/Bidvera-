"use client";

type Snapshot =
  | {
      available: false;
      verdict: "NOT_RUN";
      message: string;
    }
  | {
      available: true;
      verdict: "PASS" | "WARNING" | "FAIL" | "NOT_RUN";
      testDate: string;
      environment: string;
      concurrentUsers: number;
      concurrentUsersTarget: number;
      peakRps: number;
      avgRps: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
      errorRate: number;
      failedRequests: number;
      status4xx: number;
      status5xx: number;
      timeouts: number;
      bottlenecks: string[];
      recommendedResources: string[];
      notes: string[];
      thresholds: { errorRateMax: number; p95MsMax: number; p99MsMax: number };
      holdSeconds: number;
    };

function verdictClass(v: string) {
  if (v === "PASS") return "text-emerald-400";
  if (v === "WARNING") return "text-amber-400";
  if (v === "FAIL") return "text-rose-400";
  return "text-slate-400";
}

export function LoadTestAdminPanel({ initial }: { initial: Snapshot }) {
  if (!initial.available) {
    return (
      <div className="rounded-xl border border-slate-800 p-6 space-y-2">
        <p className={`text-lg font-medium ${verdictClass(initial.verdict)}`}>
          {initial.verdict}
        </p>
        <p className="text-sm text-slate-400">{initial.message}</p>
        <p className="text-xs text-slate-500">
          Run <code className="text-slate-300">docker compose</code> from{" "}
          <code className="text-slate-300">load-test/</code> and open this page again after
          k6 writes <code className="text-slate-300">.data/load-test/latest-report.json</code>.
        </p>
      </div>
    );
  }

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const ms = (n: number) => `${Math.round(n)} ms`;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Verdict" value={initial.verdict} className={verdictClass(initial.verdict)} />
        <Card
          label="Concurrent users"
          value={`${initial.concurrentUsers} / ${initial.concurrentUsersTarget}`}
          hint={`Hold ${initial.holdSeconds}s · ${initial.environment}`}
        />
        <Card label="Peak RPS (observed avg)" value={initial.peakRps.toFixed(1)} />
        <Card label="Error rate" value={pct(initial.errorRate)} hint={`${initial.failedRequests} failed`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="p50" value={ms(initial.p50Ms)} />
        <Card
          label="p95"
          value={ms(initial.p95Ms)}
          hint={`Threshold ${ms(initial.thresholds.p95MsMax)}`}
          className={initial.p95Ms > initial.thresholds.p95MsMax ? "text-amber-400" : undefined}
        />
        <Card
          label="p99"
          value={ms(initial.p99Ms)}
          hint={`Threshold ${ms(initial.thresholds.p99MsMax)}`}
          className={initial.p99Ms > initial.thresholds.p99MsMax ? "text-amber-400" : undefined}
        />
        <Card
          label="4xx / 5xx / timeouts"
          value={`${initial.status4xx} / ${initial.status5xx} / ${initial.timeouts}`}
        />
      </div>

      <section className="rounded-xl border border-slate-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-white">Test date</h2>
        <p className="text-sm text-slate-300">{new Date(initial.testDate).toLocaleString()}</p>
      </section>

      <section className="rounded-xl border border-slate-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-white">Bottleneck</h2>
        <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
          {initial.bottlenecks.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-white">Recommended server resources</h2>
        <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
          {initial.recommendedResources.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      {initial.notes.length ? (
        <section className="rounded-xl border border-slate-800 p-4 space-y-2">
          <h2 className="text-sm font-medium text-white">Notes</h2>
          <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
            {initial.notes.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-medium ${className ?? "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
