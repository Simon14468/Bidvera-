export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  listSupplierEvidence,
} from "@/modules/supplier-qualification";
import { EvidencePanel } from "./evidence-panel";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";

export default async function SupplierEvidencePage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.supplierQualification;
  const { companyId } = await requireSupplierQualificationModule();
  const evidence = await listSupplierEvidence(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/supplier-qualification" className="text-sm text-primary hover:underline">
          ← {t.dashboard}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.evidencePageTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.evidencePageSubtitle}</p>
      </div>
      <EvidencePanel initial={evidence} />
    </div>
  );
}
