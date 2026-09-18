import { getMatchingSponsorshipPricingAdminSnapshot } from "@/application/admin/matching-sponsorship-pricing-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { MatchingSponsorshipPricingAdminPanel } from "@/components/super-admin/matching-sponsorship-pricing-admin";

export const dynamic = "force-dynamic";

export default async function SaMatchingSponsoredPricingPage() {
  await requireSuperAdmin();
  const snapshot = await getMatchingSponsorshipPricingAdminSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Sponsored Matching pricing
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Matching → Sponsored Pricing. Catalog is SA-only to manage. Companies
          see active plans only after an explicit Sponsored Matching request.
          Payment processing is not connected.
        </p>
      </div>
      <MatchingSponsorshipPricingAdminPanel initial={snapshot} />
    </div>
  );
}
