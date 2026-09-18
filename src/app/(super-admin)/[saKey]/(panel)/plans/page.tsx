import { listPlansForAdmin } from "@/application/admin/plan-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { PlansManager } from "@/components/super-admin/plan-form";
import { parsePlanTranslations } from "@/services/billing/plan-i18n";
import { ADMIN_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";

export const dynamic = "force-dynamic";

export default async function SaPlansPage() {
  await requireSuperAdmin();
  const plans = await listPlansForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Plans & Entitlements</h1>
        <p className="mt-1 text-sm text-slate-400">
          Prices, limits, and real entitlements enforce Paywall, checkout, and
          product access. Marketing Languages remain separate display copy.
        </p>
      </div>
      <PlansManager
        entitlementKeys={[...ADMIN_ENTITLEMENT_KEYS]}
        plans={plans.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          monthlyPriceCents: p.monthlyPriceCents,
          annualPriceCents: p.annualPriceCents,
          annualMonths: p.annualMonths,
          monthlyEnabled: p.monthlyEnabled,
          annualEnabled: p.annualEnabled,
          analysesLimit: p.analysesLimit,
          analysesLimitYearly: p.analysesLimitYearly,
          seatsLimit: p.seatsLimit,
          seatsLimitYearly: p.seatsLimitYearly,
          aiTokensLimit: p.aiTokensLimit,
          storageMbLimit: p.storageMbLimit,
          isFree: p.isFree,
          visibleToPublic: p.visibleToPublic,
          stripeEnabled: p.stripeEnabled,
          paypalEnabled: p.paypalEnabled,
          trialEligible: p.trialEligible,
          trialDays: p.trialDays,
          graceDays: p.graceDays,
          currency: p.currency,
          sortOrder: p.sortOrder,
          highlighted: p.highlighted,
          preferEntitlementLabels: p.preferEntitlementLabels,
          status: p.status,
          featureList: p.featureList,
          featureKeys: p.planFeatures
            .filter((pf) => pf.enabled)
            .map((pf) => pf.feature.key)
            .filter((k) => (ADMIN_ENTITLEMENT_KEYS as readonly string[]).includes(k)),
          translations: parsePlanTranslations(p.translations),
          subscriptionsCount: p._count.subscriptions,
        }))}
      />
    </div>
  );
}
