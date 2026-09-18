export const dynamic = "force-dynamic";

import {
  requireDocumentComplianceModule,
  getReminderSettings,
} from "@/modules/document-compliance";
import { ReminderSettingsForm } from "./settings-form";
import Link from "next/link";

export default async function DocumentComplianceSettingsPage() {
  const { companyId } = await requireDocumentComplianceModule();
  const settings = await getReminderSettings(companyId);

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/document-compliance"
          className="text-sm text-primary hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Reminder settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Reminders use calendar expiry dates only — no timezone conversion.
        </p>
      </div>
      <ReminderSettingsForm initial={settings} />
    </div>
  );
}
