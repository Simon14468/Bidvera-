export const dynamic = "force-dynamic";

import { requireDocumentComplianceModule } from "@/modules/document-compliance";
import { ComplianceUploadForm } from "./upload-form";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";

export default async function DocumentComplianceUploadPage() {
  await requireDocumentComplianceModule();
  const locale = await getLocale();
  const t = getDictionary(locale).app.documentCompliance;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/document-compliance"
          className="text-sm text-primary hover:underline"
        >
          ← {t.dashboard}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.uploadTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.uploadSubtitle}</p>
      </div>
      <ComplianceUploadForm labels={t} />
    </div>
  );
}
