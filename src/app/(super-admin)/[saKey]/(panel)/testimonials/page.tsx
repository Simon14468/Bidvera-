import { TestimonialsAdmin } from "@/components/super-admin/testimonials-admin";
import { listTestimonialsForAdmin } from "@/application/admin/landing-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";

export const dynamic = "force-dynamic";

export default async function SaTestimonialsPage() {
  await requireSuperAdmin();
  const items = await listTestimonialsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Customer testimonials</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage genuine testimonials shown on the landing page. Empty list shows an early-customer
          state — never invent reviews.
        </p>
      </div>
      <TestimonialsAdmin
        initial={items.map((t) => ({
          id: t.id,
          customerName: t.customerName,
          companyName: t.companyName,
          jobTitle: t.jobTitle,
          quote: t.quote,
          rating: t.rating,
          avatarUrl: t.avatarUrl,
          verified: t.verified,
          enabled: t.enabled,
          sortOrder: t.sortOrder,
        }))}
      />
    </div>
  );
}
