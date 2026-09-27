import { getPaymentsAdminDashboard } from "@/application/admin/payments-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { PaymentsAdminPanel } from "@/components/super-admin/payments-admin";
import { getSuperAdminPath } from "@/config/super-admin";

export const dynamic = "force-dynamic";

export default async function SaPaymentsPage() {
  await requireSuperAdmin();
  const data = await getPaymentsAdminDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payments & Billing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enable Stripe / PayPal, control plan visibility, and monitor subscription revenue.
        </p>
      </div>
      <PaymentsAdminPanel
        settings={data.settings}
        metrics={data.metrics}
        paypalIntegration={data.paypalIntegration}
        freeWorkspaceSettingsHref={`/${getSuperAdminPath()}/plans/free-workspace`}
        plans={data.plans.map((p) => ({
          ...p,
          subscriptionsCount: p._count.subscriptions,
        }))}
      />
    </div>
  );
}
