export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { AppError, ErrorCode } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { getDecisionMemory } from "@/services/decision-memory";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DecisionMemoryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale).app.decisionMemory;
  const { companyId } = await requireCompanyId();

  let memory;
  try {
    memory = await getDecisionMemory(companyId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) {
      notFound();
    }
    throw error;
  }

  const req = memory.requirementsSnapshot;
  const risks = memory.risksSnapshot;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/decision-memory"
          className="text-sm text-muted hover:text-foreground"
        >
          ← {t.back}
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {memory.decisionLabel}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {memory.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {[memory.client, memory.industry, memory.country]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 text-xs text-muted">
          {t.analyzed} {formatDateTime(memory.analyzedAt, locale)}
        </p>
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-muted">
        {memory.disclaimer}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{t.scores}</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Fit</dt>
            <dd className="font-medium">{memory.fitScore ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Readiness</dt>
            <dd className="font-medium">{memory.readinessScore ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Bid Score</dt>
            <dd className="font-medium">{memory.bidScore ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{t.reasoning}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {memory.reasoning}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{t.requirements}</h2>
        <p className="mt-2 text-xs text-muted">
          {req.totalRequirements} total · {req.ready} ready · {req.missing}{" "}
          missing · {req.verify} verify
        </p>
        {req.lines?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {req.lines.slice(0, 20).map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{t.risks}</h2>
        {risks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">—</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {risks.map((r) => (
              <li key={r.id}>
                <span className="font-medium text-foreground">{r.severity}</span>
                {" — "}
                {r.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/tenders/${memory.tenderId}`}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
      >
        {t.viewTender}
      </Link>
    </div>
  );
}
