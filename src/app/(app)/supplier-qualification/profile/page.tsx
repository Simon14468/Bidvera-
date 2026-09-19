export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  getSupplierProfile,
} from "@/modules/supplier-qualification";
import { SupplierProfileEditor } from "../profile-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { formatMessage } from "@/i18n/format";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";

export default async function SupplierProfilePage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.supplierQualification;
  const { companyId } = await requireSupplierQualificationModule();
  const profile = await getSupplierProfile(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/supplier-qualification" className="text-sm text-primary hover:underline">
          ← {t.dashboard}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.profilePageTitle}</h1>
        <p className="mt-1 text-sm text-muted">
          {formatMessage(t.profileCompletenessLine, {
            percent: profile.completenessPercent,
          })}
        </p>
      </div>
      <SupplierProfileEditor initial={profile} mode="full" />
    </div>
  );
}
