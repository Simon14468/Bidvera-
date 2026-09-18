import { listPublicSettings } from "@/services/settings";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { SettingsEditor } from "@/components/super-admin/settings-editor";

export const dynamic = "force-dynamic";

export default async function SaSettingsPage() {
  await requireSuperAdmin();
  const settings = await listPublicSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">System settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configurable platform defaults. Secrets are never shown here.
        </p>
      </div>
      <SettingsEditor
        settings={settings.map((s) => ({
          key: s.key,
          value: s.value,
          description: s.description,
        }))}
      />
    </div>
  );
}
