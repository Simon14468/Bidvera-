export const dynamic = "force-dynamic";

import { listTendersForSession } from "@/application/tender-service";
import { DecisionBadge } from "@/components/tenders/decision-badge";
import { RiskBadge } from "@/components/tenders/risk-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { tenderFiltersSchema } from "@/domain/schemas";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { formatDate, formatPercent } from "@/lib/format";
import { FileSearch } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { TenderFiltersBar } from "./tender-filters-bar";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export default async function TendersPage({ searchParams }: PageProps) {
  const { requireTenderAnalysisModule } = await import("@/modules/tender-analysis");
  await requireTenderAnalysisModule();
  const locale = await getLocale();
  const t = getDictionary(locale).app.tenders;
  const raw = await searchParams;
  const parsed = tenderFiltersSchema.safeParse({
    query: typeof raw.query === "string" ? raw.query : undefined,
    decision: typeof raw.decision === "string" ? raw.decision : "ALL",
    risk: typeof raw.risk === "string" ? raw.risk : "ALL",
    deadline: typeof raw.deadline === "string" ? raw.deadline : "ALL",
    sort: typeof raw.sort === "string" ? raw.sort : "analyzed_desc",
  });
  const filters = parsed.success ? parsed.data : tenderFiltersSchema.parse({});
  const { items, total } = await listTendersForSession(filters);

  const subtitle =
    total === 1 ? t.subtitleOne : fill(t.subtitle, { count: total });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <Link
          href="/tenders/upload"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {t.analyzeCta}
        </Link>
      </div>

      <Suspense fallback={null}>
        <TenderFiltersBar copy={t} />
      </Suspense>

      {items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title={t.emptyTitle}
          description={t.emptyDescription}
          actionLabel={t.analyzeCta}
          actionHref="/tenders/upload"
        />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {items.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/tenders/${row.id}`}
                  className="block rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-primary/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{row.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.clientName ?? "—"} ·{" "}
                        {fill(t.deadlineWithDate, {
                          date: formatDate(row.deadline, locale),
                        })}
                      </p>
                    </div>
                    <DecisionBadge decision={row.decision} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>
                      {fill(t.fitWithScore, {
                        score:
                          row.fitScore != null ? formatPercent(row.fitScore) : "—",
                      })}
                    </span>
                    <RiskBadge risk={row.riskLevel} />
                    <span className="truncate">
                      {row.nextAction ?? t.noNextAction}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>{t.colTender}</TH>
                  <TH>{t.colClient}</TH>
                  <TH>{t.colDeadline}</TH>
                  <TH>{t.colFit}</TH>
                  <TH>{t.colDecision}</TH>
                  <TH>{t.colRisk}</TH>
                  <TH>{t.colAnalyzed}</TH>
                  <TH>{t.colNextAction}</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={`/tenders/${row.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {row.title}
                      </Link>
                    </TD>
                    <TD className="text-muted">{row.clientName ?? "—"}</TD>
                    <TD>{formatDate(row.deadline, locale)}</TD>
                    <TD>
                      {row.fitScore != null ? formatPercent(row.fitScore) : "—"}
                    </TD>
                    <TD>
                      <DecisionBadge decision={row.decision} />
                    </TD>
                    <TD>
                      <RiskBadge risk={row.riskLevel} />
                    </TD>
                    <TD className="text-muted">{formatDate(row.analyzedAt, locale)}</TD>
                    <TD className="max-w-[220px] truncate text-muted">
                      {row.nextAction ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
