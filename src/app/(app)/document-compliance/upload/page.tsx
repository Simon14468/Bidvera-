export const dynamic = "force-dynamic";

import { requireDocumentComplianceModule } from "@/modules/document-compliance";
import { ComplianceUploadForm } from "./upload-form";
import Link from "next/link";

export default async function DocumentComplianceUploadPage() {
  await requireDocumentComplianceModule();

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/document-compliance"
          className="text-sm text-primary hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Upload document
        </h1>
        <p className="mt-1 text-sm text-muted">
          Metadata is extracted from the file when supported. Expiry dates are
          never invented.
        </p>
      </div>
      <ComplianceUploadForm />
    </div>
  );
}
