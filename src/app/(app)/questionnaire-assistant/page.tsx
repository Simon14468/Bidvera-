export const dynamic = "force-dynamic";

import { requireQuestionnaireAssistantModule } from "@/modules/questionnaire-assistant";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function QuestionnaireAssistantHubPage() {
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
          Questionnaire Assistant
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tender questionnaires
        </h1>
        <p className="mt-1 text-sm text-muted">
          Extract structured questions from a tender pack, draft answers from
          company knowledge, and keep VERIFY drafts separate from verified
          evidence.
        </p>
      </div>

      {tenders.length === 0 ? (
        tenderAnalysisEnabled ? (
          <EmptyState
            icon={ClipboardList}
            title="No tenders yet"
            description="Upload a tender first, then open Questionnaire Assistant for that tender."
            actionLabel="Upload tender"
            actionHref="/tenders/upload"
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No questionnaires yet"
            description="Questionnaire drafts appear when a tender pack is available for your company. Meanwhile, keep company profile, qualifications and evidence current so drafts can use real company knowledge."
            actionLabel="Update company profile"
            actionHref="/company"
          />
        )
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {tenders.map((t) => (
            <li key={t.id}>
              <Link
                href={`/questionnaire-assistant/${t.id}`}
                className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="truncate text-sm text-muted">
                    {t.client ?? "Client unknown"} · {t._count.documents}{" "}
                    document{t._count.documents === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span>{t._count.questionnairePacks} pack{t._count.questionnairePacks === 1 ? "" : "s"}</span>
                  <span className="uppercase tracking-wide">{t.analysisStatus}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
