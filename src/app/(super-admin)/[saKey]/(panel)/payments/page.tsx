import { getPaymentsAdminDashboard } from "@/application/admin/payments-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { PaymentsAdminPanel } from "@/components/super-admin/payments-admin";
import { saHref } from "@/lib/super-admin-nav";

export const dynamic = "force-dynamic";

export default async function SaPaymentsPage() {
  await requireSuperAdmin();
  const data = await getPaymentsAdminDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payments & Billing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enable Stripe / PayPal, manage credentials, map each plan to provider IDs, and monitor
          subscription revenue.
        </p>
      </div>
      <PaymentsAdminPanel
        settings={data.settings}
        metrics={data.metrics}
        paypalIntegration={data.paypalIntegration}
        providerCredentials={data.providerCredentials}
        freeWorkspaceSettingsHref={saHref("/plans/free-workspace")}
        plans={data.plans.map((plan) => ({
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          status: plan.status,
          visibleToPublic: plan.visibleToPublic,
          isFree: plan.isFree,
          monthlyEnabled: plan.monthlyEnabled,
          annualEnabled: plan.annualEnabled,
          stripeEnabled: plan.stripeEnabled,
          paypalEnabled: plan.paypalEnabled,
          stripePriceMonthly: plan.stripePriceMonthly,
          stripePriceAnnual: plan.stripePriceAnnual,
          paypalPlanMonthly: plan.paypalPlanMonthly,
          paypalPlanAnnual: plan.paypalPlanAnnual,
          paypalSandboxPlanMonthly: plan.paypalSandboxPlanMonthly,
          paypalSandboxPlanAnnual: plan.paypalSandboxPlanAnnual,
          subscriptionsCount: plan._count.subscriptions,
        }))}
      />
    </div>
  );
}
