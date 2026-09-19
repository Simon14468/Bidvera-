export const dynamic = "force-dynamic";

import { requireTenderCalendarModule } from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { TenderForm } from "../tender-form";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewCalendarTenderPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.tenderCalendar;
  const { auth } = await requireTenderCalendarModule();
  if (!canManageCompanySettings(auth.user.role)) {
    redirect("/tender-calendar");
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <Link href="/tender-calendar" className="text-sm text-primary hover:underline">
          ← {t.calendarHome}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.createTenderTitle}</h1>
      </div>
      <TenderForm mode="create" />
    </div>
  );
}
