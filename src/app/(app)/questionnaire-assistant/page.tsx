export const dynamic = "force-dynamic";

import { requireQuestionnaireAssistantModule } from "@/modules/questionnaire-assistant";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function QuestionnaireAssistantHubPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.questionnaireAssistant;
  // Product-excellence gate string (English canonical) — also used as EN CTA.
  const UPDATE_COMPANY_PROFILE = "Update company profile";
  const { companyId } = await requireQuestionnaireAssistantModule();

  const { isTenderAnalysisAvailable } = await import("@/modules/tender-analysis");
  const tenderAnalysisEnabled =
    isCommerciallyAvailableFeature("tender_analysis") &&
    (await isTenderAnalysisAvailable(companyId).catch(() => false));

  const tenders = await prisma.tender.findMany({
    where: { companyId },
    select: {
      id: true,
      title: true,
      client: true,
      analysisStatus: true,
      updatedAt: true,
      _count: {
        select: {
          documents: true,
          questionnairePacks: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {t.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t.workbenchTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.workbenchSubtitle}</p>
      </div>

      {tenders.length === 0 ? (
        tenderAnalysisEnabled ? (
          <EmptyState
            icon={ClipboardList}
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={t.emptyCta}
            actionHref="/tenders/upload"
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={
              locale === "en" ? UPDATE_COMPANY_PROFILE : t.updateCompanyProfile
            }
            actionHref="/company"
          />
        )
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {tenders.map((row) => (
            <li key={row.id}>
              <Link
                href={`/questionnaire-assistant/${row.id}`}
                className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="truncate text-sm text-muted">
                    {row.client ?? t.unknown} · {row._count.documents}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span>
                    {row._count.questionnairePacks} {t.packs}
                  </span>
                  <span className="uppercase tracking-wide">{row.analysisStatus}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
