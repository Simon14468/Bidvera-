"use client";

import { Button } from "@/components/ui/button";
import { FileChooseField } from "@/components/ui/file-choose-field";
import type { AppModuleBundle } from "@/i18n/app-modules";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const CATEGORIES = [
  "RC",
  "CNSS",
  "TVA",
  "TAX_CERTIFICATE",
  "ISO",
  "INSURANCE",
  "LICENSE",
  "CONTRACT",
  "CERTIFICATION",
  "OTHER",
] as const;

export function ComplianceUploadForm({
  labels,
}: {
  labels: AppModuleBundle["documentCompliance"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!hasFile) {
      setError(labels.chooseFileError);
      return;
    }
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await fetch("/api/document-compliance/documents", {
        method: "POST",
        body: data,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        document?: { id: string };
      };
      if (!res.ok) {
        setError(json.error ?? labels.uploadFailed);
        return;
      }
      if (json.document?.id) {
        router.push(`/document-compliance/${json.document.id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
      <FileChooseField
        name="file"
        required
        uploading={pending}
        label={labels.fileLabel}
        title={labels.dragDropTitle}
        hint={labels.fileHint}
        chooseLabel={labels.chooseFile}
        uploadingLabel={labels.uploadingMetadata}
        onFilesChange={(files) => {
          setHasFile(files.length > 0);
          setError(null);
        }}
      />

      <div>
        <label className="text-sm font-medium">{labels.nameOptional}</label>
        <input
          name="name"
          disabled={pending}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{labels.category}</label>
        <select
          name="categoryKey"
          defaultValue="OTHER"
          disabled={pending}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{labels.issueDateLabel}</label>
          <input
            type="date"
            name="issueDate"
            disabled={pending}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-sm font-medium">{labels.expiryDateLabel}</label>
          <input
            type="date"
            name="expiryDate"
            disabled={pending}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="noExpiry" value="true" disabled={pending} />
        {labels.noExpiryCheckbox}
      </label>
      <div>
        <label className="text-sm font-medium">{labels.issuingAuthorityLabel}</label>
        <input
          name="issuingAuthority"
          disabled={pending}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{labels.documentNumberLabel}</label>
        <input
          name="documentNumber"
          disabled={pending}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button
        type="submit"
        loading={pending}
        disabled={!hasFile || pending}
        className="w-full sm:w-auto"
      >
        {pending ? labels.uploading : labels.uploadExtract}
      </Button>
    </form>
  );
}
