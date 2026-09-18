import { requireSuperAdmin } from "@/auth/super-admin-session";
import { AuthAdminPanel } from "@/components/super-admin/auth-admin";
import { getAuthAdminSnapshot } from "@/services/auth/settings";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SaAuthPage() {
  await requireSuperAdmin();
  const [settings, recent] = await Promise.all([
    getAuthAdminSnapshot(),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "SIGNUP",
            "EMAIL_VERIFIED",
            "EMAIL_VERIFICATION_SENT",
            "PASSWORD_RESET_REQUESTED",
            "PASSWORD_RESET_COMPLETED",
            "ONBOARDING_COMPANY",
            "ONBOARDING_PLAN",
            "LOGIN",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Auth & Registration</h1>
        <p className="mt-1 text-sm text-slate-400">
          Funnel controls and recent registration / security events.
        </p>
      </div>
      <AuthAdminPanel initial={settings} />
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Recent auth events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2 pe-3">When</th>
                <th className="py-2 pe-3">Action</th>
                <th className="py-2 pe-3">User</th>
                <th className="py-2">Company</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id} className="border-t border-slate-800 text-slate-200">
                  <td className="py-2 pe-3 whitespace-nowrap">
                    {row.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="py-2 pe-3">{row.action}</td>
                  <td className="py-2 pe-3 font-mono text-xs">{row.userId ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">{row.companyId ?? "—"}</td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
