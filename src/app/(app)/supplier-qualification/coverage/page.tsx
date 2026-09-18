export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  getSupplierProfile,
} from "@/modules/supplier-qualification";
import { SupplierProfileEditor } from "../profile-editor";
import Link from "next/link";

export default async function SupplierCoveragePage() {
  const { companyId } = await requireSupplierQualificationModule();
  const profile = await getSupplierProfile(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/supplier-qualification" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Coverage</h1>
        <p className="mt-1 text-sm text-muted">
          Geographic coverage, currencies, and languages — country-agnostic.
        </p>
      </div>
      <SupplierProfileEditor initial={profile} mode="coverage" />
    </div>
  );
}
