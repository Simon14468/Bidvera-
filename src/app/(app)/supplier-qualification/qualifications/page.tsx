export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  getSupplierProfile,
} from "@/modules/supplier-qualification";
import { SupplierProfileEditor } from "../profile-editor";
import Link from "next/link";

export default async function SupplierQualificationsPage() {
  const { companyId } = await requireSupplierQualificationModule();
  const profile = await getSupplierProfile(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/supplier-qualification" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Qualifications & certifications
        </h1>
        <p className="mt-1 text-sm text-muted">
          Free-form certifications and licenses — not treated as verified evidence.
        </p>
      </div>
      <SupplierProfileEditor initial={profile} mode="qualifications" />
    </div>
  );
}
