import { requireSuperAdmin } from "@/auth/super-admin-session";
import { AssistantControlPanel } from "@/components/super-admin/assistant-control-panel";
import { AssistantKnowledgeEditor } from "@/components/super-admin/assistant-knowledge-editor";
import { getAssistantKnowledge } from "@/services/ai/assistant-knowledge";
import { getAssistantAdminSnapshot } from "@/services/ai/assistant-settings";

export const dynamic = "force-dynamic";

export default async function SaAssistantKnowledgePage() {
  await requireSuperAdmin();
  const [knowledge, control] = await Promise.all([
    getAssistantKnowledge(),
    getAssistantAdminSnapshot(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Bidvera AI Knowledge</h1>
        <p className="mt-1 text-sm text-slate-400">
          Dedicated controls for the floating Bidvera AI Assistant. Answers follow the
          user&apos;s question language (EN / ES / ZH / AR / FR). Tender analysis AI is
          unchanged.
        </p>
      </div>

      <AssistantControlPanel initial={control} />

      <AssistantKnowledgeEditor initialByLocale={knowledge.byLocale} />
    </div>
  );
}
