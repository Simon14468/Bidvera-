import { requireSuperAdmin } from "@/auth/super-admin-session";
import { NotificationChannelsAdmin } from "@/components/super-admin/notification-channels-admin";
import { getNotificationChannelAdminSnapshot } from "@/services/notifications/channel-settings";

export const dynamic = "force-dynamic";

export default async function SaNotificationChannelsPage() {
  await requireSuperAdmin();
  const settings = await getNotificationChannelAdminSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Notification channels
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure Meta WhatsApp and SMS provider credentials, then unlock each
          channel for company Settings. Secrets are encrypted and never shown
          again.
        </p>
      </div>
      <NotificationChannelsAdmin initial={settings} />
    </div>
  );
}
