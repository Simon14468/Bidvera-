export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  getSupplierProfile,
} from "@/modules/supplier-qualification";
import { SupplierProfileEditor } from "../profile-editor";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";

export default async function SupplierServicesPage() {
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.servicesPageTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.servicesPageSubtitle}</p>
      </div>
      <SupplierProfileEditor initial={profile} mode="services" />
    </div>
  );
}
