import { getMatchingSponsorshipAdminSnapshot } from "@/application/admin/matching-sponsorship-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { MatchingSponsorshipAdminPanel } from "@/components/super-admin/matching-sponsorship-admin";

export const dynamic = "force-dynamic";

export default async function SaMatchingSponsorshipPage() {
  await requireSuperAdmin();
  const snapshot = await getMatchingSponsorshipAdminSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Matching sponsorship
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Feature 8F foundation. Sponsored opportunities never bypass relevance.
          No live payment charging.
        </p>
      </div>
      <MatchingSponsorshipAdminPanel initial={snapshot} />
    </div>
  );
}
