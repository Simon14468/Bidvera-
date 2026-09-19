export const dynamic = "force-dynamic";

import {
  requireDocumentComplianceModule,
  getReminderSettings,
} from "@/modules/document-compliance";
import { ReminderSettingsForm } from "./settings-form";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";

export default async function DocumentComplianceSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.documentCompliance;
  const { companyId } = await requireDocumentComplianceModule();
  const settings = await getReminderSettings(companyId);

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/document-compliance"
          className="text-sm text-primary hover:underline"
        >
          ← {t.dashboard}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.settingsTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.settingsSubtitle}</p>
      </div>
      <ReminderSettingsForm initial={settings} />
    </div>
  );
}
