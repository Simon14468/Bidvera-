import { resolveSuperAdminContext } from "@/auth/super-admin-session";
import { SaLoginForm } from "@/components/super-admin/sa-login-form";
import { assertSaKey } from "@/lib/super-admin-guard";
import { saHref } from "@/lib/super-admin-nav";
import { redirect } from "next/navigation";

export default async function SaLoginPage({
  params,
}: {
  params: Promise<{ saKey: string }>;
}) {
  const { saKey } = await params;
  assertSaKey(saKey);
  const ctx = await resolveSuperAdminContext();
  if (ctx) redirect(saHref());
  // If a stale cookie exists, resolveSuperAdminContext clears it.
  return (
    <div className="min-h-screen bg-slate-950 px-4">
      <SaLoginForm nextPath={saHref()} />
    </div>
  );
}
