import { getPaymentsAdminDashboard } from "@/application/admin/payments-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { PaymentsAdminPanel } from "@/components/super-admin/payments-admin";

export const dynamic = "force-dynamic";

export default async function SaPaymentsPage() {
  await requireSuperAdmin();
  const data = await getPaymentsAdminDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payments & Billing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enable Stripe / PayPal, manage credentials, and monitor subscription revenue.
          Plan visibility and price IDs are edited under Plans.
        </p>
      </div>
      <PaymentsAdminPanel
        settings={data.settings}
        metrics={data.metrics}
        paypalIntegration={data.paypalIntegration}
        providerCredentials={data.providerCredentials}
      />
    </div>
  );
}
