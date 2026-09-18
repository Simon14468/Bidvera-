export const dynamic = "force-dynamic";

import {
  requireTenderCalendarModule,
  getCalendarTender,
} from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { TenderForm } from "../../tender-form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function EditCalendarTenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { auth, companyId } = await requireTenderCalendarModule();
  if (!canManageCompanySettings(auth.user.role)) {
    redirect("/tender-calendar");
  }
  const { id } = await params;
  const tender = await getCalendarTender(companyId, id);
  if (!tender) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <Link
          href={`/tender-calendar/${tender.id}`}
          className="text-sm text-primary hover:underline"
        >
          ← Details
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit tender</h1>
      </div>
      <TenderForm mode="edit" tenderId={tender.id} initial={tender} />
    </div>
  );
}
