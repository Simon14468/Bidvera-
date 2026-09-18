import { listAiCatalog } from "@/application/admin/platform-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { AiModelForms } from "@/components/super-admin/ai-model-forms";

export const dynamic = "force-dynamic";

export default async function SaAiModelsPage() {
  await requireSuperAdmin();
  const catalog = await listAiCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI model management</h1>
        <p className="mt-1 text-sm text-slate-400">
          OpenAI · Anthropic Claude · Google Gemini — paste API keys here (encrypted vault) or
          use env vars. Assign models to tasks so tender analysis uses them.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Current task assignments</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {catalog.assignments.map((a) => (
            <li key={a.id}>
              {a.task} → {a.model.displayName} ({a.model.name}
              {a.model.version ? `@${a.model.version}` : ""}) via {a.model.provider.name}
              {a.fallbackModel
                ? ` · fallback ${a.fallbackModel.displayName} (${a.fallbackModel.provider?.name ?? ""})`
                : ""}
            </li>
          ))}
          {catalog.assignments.length === 0 ? (
            <li className="text-slate-500">No assignments — env fallbacks active.</li>
          ) : null}
        </ul>
      </section>

      <AiModelForms
        models={catalog.models.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          name: m.name,
          version: m.version,
          latestVersion: m.latestVersion,
          previousVersion: m.previousVersion,
          active: m.active,
          provider: {
            key: m.provider.key,
            name: m.provider.name,
            active: m.provider.active,
          },
        }))}
        providers={catalog.providers.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          active: p.active,
          apiKeyEnvVar: p.apiKeyEnvVar,
        }))}
        knownProviders={catalog.knownProviders}
      />
    </div>
  );
}
