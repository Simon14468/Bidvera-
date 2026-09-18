export const dynamic = "force-dynamic";

import {
  getLatestTenderQuestionnaire,
  requireQuestionnaireAssistantModule,
} from "@/modules/questionnaire-assistant";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { QuestionnaireWorkbench } from "../questionnaire-workbench";

export default async function QuestionnaireAssistantTenderPage({
  params,
}: {
  params: Promise<{ tenderId: string }>;
}) {
  const { companyId } = await requireQuestionnaireAssistantModule();
  const { tenderId } = await params;

  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, companyId },
    select: { id: true, title: true, client: true },
  });
  if (!tender) notFound();

  const pack = await getLatestTenderQuestionnaire(companyId, tenderId);

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <QuestionnaireWorkbench
        tender={{
          id: tender.id,
          title: tender.title,
          client: tender.client,
        }}
        initialPack={pack}
      />
    </div>
  );
}
