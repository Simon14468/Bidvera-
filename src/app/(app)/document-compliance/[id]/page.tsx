export const dynamic = "force-dynamic";

import {
  requireDocumentComplianceModule,
  getDocument,
  listVersions,
} from "@/modules/document-compliance";
import { ComplianceStatusBadge } from "@/modules/document-compliance/ui/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComplianceVersionUpload } from "./version-upload";

export default async function DocumentComplianceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { companyId } = await requireDocumentComplianceModule();
  const { id } = await params;
  const document = await getDocument(companyId, id);
  if (!document) notFound();
  const versions = await listVersions(companyId, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link
          href="/document-compliance/documents"
          className="text-sm text-primary hover:underline"
        >
          ← Documents
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{document.name}</h1>
          <ComplianceStatusBadge status={document.status} />
        </div>
        <p className="mt-1 text-sm text-muted">{document.categoryLabel}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Tenant-scoped compliance record</CardDescription>
        </CardHeader>
        <dl className="grid gap-3 px-5 pb-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Document number</dt>
            <dd className="font-medium">{document.documentNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Issuing authority</dt>
            <dd className="font-medium">{document.issuingAuthority ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Issue date</dt>
            <dd className="font-medium">{document.issueDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Expiry date</dt>
            <dd className="font-medium">{document.expiryDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Extraction confidence</dt>
            <dd className="font-medium">
              {document.extractionConfidence != null
                ? `${Math.round(document.extractionConfidence * 100)}%`
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      {document.extractionProvenance && document.extractionProvenance.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Extraction provenance</CardTitle>
            <CardDescription>
              Evidence supporting extracted fields — never auto-actions.
            </CardDescription>
          </CardHeader>
          <ul className="space-y-2 px-5 pb-5 text-sm">
            {document.extractionProvenance.map((p, i) => (
              <li key={`${p.field}-${i}`} className="rounded-lg bg-foreground/[0.03] px-3 py-2">
                <p className="font-medium">
                  {p.field}
                  {p.label ? ` · ${p.label}` : ""} ·{" "}
                  {Math.round(p.confidence * 100)}%
                </p>
                <p className="mt-0.5 text-xs text-muted">{p.evidence}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Versions</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  v{v.versionNumber} · {v.fileName}
                </p>
                <p className="text-xs text-muted">
                  {(v.byteLength / 1024).toFixed(1)} KB ·{" "}
                  {v.createdAt.toISOString().slice(0, 10)}
                </p>
              </div>
              <a
                href={`/api/document-compliance/files/${v.id}`}
                className="text-primary hover:underline"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
        <ComplianceVersionUpload documentId={document.id} />
      </section>
    </div>
  );
}
