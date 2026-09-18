import { getMatchingAiSettingsForAdmin } from "@/application/admin/matching-ai-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { MatchingAiAdminPanel } from "@/components/super-admin/matching-ai-admin";

export const dynamic = "force-dynamic";

export default async function SaMatchingAiPage() {
  await requireSuperAdmin();
  const settings = await getMatchingAiSettingsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI Matching</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure the optional AI ranking assistant for Matching Engine.
          Hard relevance remains the source of truth.
        </p>
      </div>
      <MatchingAiAdminPanel initial={settings} />
    </div>
  );
}
