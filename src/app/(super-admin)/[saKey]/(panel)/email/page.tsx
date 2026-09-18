import { requireSuperAdmin } from "@/auth/super-admin-session";
import { EmailAdminPanel } from "@/components/super-admin/email-admin";
import { getEmailSettingsForAdmin } from "@/application/admin/email-service";

export const dynamic = "force-dynamic";

export default async function SaEmailPage() {
  await requireSuperAdmin();
  const settings = await getEmailSettingsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Email settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure Resend for Smart Alerts and transactional Bidvera emails.
          Credentials stay server-side only.
        </p>
      </div>
      <EmailAdminPanel initial={settings} />
    </div>
  );
}
