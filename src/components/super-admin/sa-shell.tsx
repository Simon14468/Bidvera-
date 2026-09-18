import { saLogout } from "@/app/actions/super-admin";
import { getSuperAdminPath } from "@/config/super-admin";
import { redirect } from "next/navigation";

async function logoutAndRedirect() {
  "use server";
  await saLogout();
  redirect(`/${getSuperAdminPath()}/login`);
}

export function SaShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const base = `/${getSuperAdminPath()}`;
  const nav = [
    { href: base, label: "Overview" },
    { href: `${base}/companies`, label: "Companies" },
    { href: `${base}/subscriptions`, label: "Subscriptions" },
    { href: `${base}/payments`, label: "Payments" },
    { href: `${base}/auth`, label: "Auth" },
    { href: `${base}/plans`, label: "Plans" },
    { href: `${base}/features`, label: "Features" },
    { href: `${base}/matching`, label: "Matching" },
    { href: `${base}/matching-sponsorship`, label: "Sponsorship" },
    { href: `${base}/matching-sponsored-pricing`, label: "Sponsored Pricing" },
    { href: `${base}/ai-matching`, label: "AI Matching" },
    { href: `${base}/landing-video`, label: "Landing video" },
    { href: `${base}/testimonials`, label: "Testimonials" },
    { href: `${base}/ai-models`, label: "AI Models" },
    { href: `${base}/ai-knowledge`, label: "AI Knowledge" },
    { href: `${base}/ai-costs`, label: "AI Costs" },
    { href: `${base}/email`, label: "Email" },
    { href: `${base}/settings`, label: "Settings" },
    { href: `${base}/backups`, label: "Backups" },
    { href: `${base}/load-test`, label: "Load test" },
    { href: `${base}/production-readiness`, label: "Production readiness" },
    { href: `${base}/audit`, label: "Audit" },
  ];

  // Ops chrome stays LTR so the nav is always on the physical left,
  // even when the app/html language is RTL (e.g. Arabic).
  return (
    <div dir="ltr" className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-row">
        <aside className="hidden w-56 shrink-0 border-r border-slate-800 p-4 md:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Bidvera Control
          </p>
          <p className="mt-1 truncate text-sm text-slate-400">{adminName}</p>
          <nav className="mt-6 space-y-1">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <form action={logoutAndRedirect} className="mt-8">
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Sign out
            </button>
          </form>
        </aside>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
