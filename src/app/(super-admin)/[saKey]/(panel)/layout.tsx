import { resolveSuperAdminContext } from "@/auth/super-admin-session";
import { SaShell } from "@/components/super-admin/sa-shell";
import { assertSaKey } from "@/lib/super-admin-guard";
import { saHref } from "@/lib/super-admin-nav";
import { redirect } from "next/navigation";

export default async function SaPanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ saKey: string }>;
}) {
  const { saKey } = await params;
  assertSaKey(saKey);
  const ctx = await resolveSuperAdminContext();
  if (!ctx) redirect(saHref("/login"));
  return <SaShell adminName={ctx.admin.name}>{children}</SaShell>;
}
