import { requireSuperAdmin } from "@/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { saHref } from "@/lib/super-admin-nav";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Super-Admin / development diagnostic: FINAL RESULT → RULE → STRUCTURED INPUT → SOURCE.
 * Never linked from customer UI.
 */
export default async function SaAnalysisTracePage({
  params,
}: {
  params: Promise<{ saKey: string; companyId: string; tenderId: string }>;
}) {
  await requireSuperAdmin();
  const { companyId, tenderId } = await params;

  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, companyId },
    include: {
      decision: true,
      documents: { orderBy: { createdAt: "asc" }, take: 3 },
      company: { include: { profile: true } },
      requirements: { orderBy: { sortOrder: "asc" }, take: 50 },
    },
  });
  if (!tender || !tender.decision) notFound();

  const intelligence = tender.decision.intelligenceBreakdown as {
    analysisTrace?: unknown;
    decisionContext?: string;
    learningSignal?: unknown;
  } | null;

  const knowledge = tender.company.profile?.knowledgeJson ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={saHref(`/companies/${companyId}`)}
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Company
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Analysis trace</h1>
        <p className="text-sm text-slate-400">
          {tender.title} · {tender.id}
        </p>
        <p className="mt-1 text-xs text-amber-400/90">
          Internal diagnostic — not visible to customers.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Documents</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {tender.documents.map((d) => (
            <li key={d.id}>
              {d.fileName} · kind={d.documentKind ?? "—"} · pages={d.pageCount ?? "—"}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Decision snapshot</h2>
        <pre className="mt-2 overflow-x-auto text-xs text-slate-300">
          {JSON.stringify(
            {
              decision: tender.decision.decision,
              fitScore: tender.decision.fitScore,
              confidence: tender.decision.confidence,
              reasoning: tender.decision.reasoning,
              requirements: tender.requirements.map((r) => ({
                description: r.description,
                status: r.status,
                evidence: r.evidence,
                sourcePage: r.sourcePage,
              })),
            },
            null,
            2,
          )}
        </pre>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Analysis trace</h2>
        <pre className="mt-2 max-h-[28rem] overflow-auto text-xs text-slate-300">
          {JSON.stringify(intelligence?.analysisTrace ?? { note: "No trace stored" }, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Stored company knowledge</h2>
        <pre className="mt-2 max-h-[28rem] overflow-auto text-xs text-slate-300">
          {JSON.stringify(knowledge ?? { note: "No knowledgeJson" }, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Learning signal</h2>
        <pre className="mt-2 overflow-x-auto text-xs text-slate-300">
          {JSON.stringify(intelligence?.learningSignal ?? null, null, 2)}
        </pre>
      </section>
    </div>
  );
}
