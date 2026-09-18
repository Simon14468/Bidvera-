export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  listSupplierEvidence,
} from "@/modules/supplier-qualification";
import { EvidencePanel } from "./evidence-panel";
import Link from "next/link";

export default async function SupplierEvidencePage() {
  const { companyId } = await requireSupplierQualificationModule();
  const evidence = await listSupplierEvidence(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/supplier-qualification" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Documents & evidence references
        </h1>
        <p className="mt-1 text-sm text-muted">
          Optional supporting files or URLs. Ownership is tenant-scoped; content is not
          auto-verified.
        </p>
      </div>
      <EvidencePanel initial={evidence} />
    </div>
  );
}
