export const dynamic = "force-dynamic";

import {
  requireTenderCalendarModule,
  getCalendarReminderSettings,
} from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { ReminderSettingsForm } from "./settings-form";
import Link from "next/link";

export default async function TenderCalendarSettingsPage() {
  const { auth, companyId } = await requireTenderCalendarModule();
  const canManage = canManageCompanySettings(auth.user.role);
  const settings = await getCalendarReminderSettings(companyId);

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
      <div>
        <Link href="/tender-calendar" className="text-sm text-primary hover:underline">
          ← Calendar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Reminder settings</h1>
        <p className="mt-1 text-sm text-muted">
          Reminders use each deadline’s stored date/time. Timezones are never invented.
        </p>
      </div>
      <ReminderSettingsForm initial={settings} canManage={canManage} />
    </div>
  );
}
