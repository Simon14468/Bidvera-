"use client";

import { Button } from "@/components/ui/button";
import { FileChooseField } from "@/components/ui/file-choose-field";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ComplianceVersionUpload({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!hasFile) {
      setError("Choose a file to upload.");
      return;
    }
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await fetch(`/api/document-compliance/documents/${documentId}`, {
        method: "POST",
        body: data,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        return;
      }
      router.refresh();
      setHasFile(false);
      setResetKey((k) => k + 1);
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FileChooseField
        key={resetKey}
        name="file"
        required
        uploading={pending}
        variant="compact"
        label="Add version"
        chooseLabel="Choose file"
        uploadingLabel="Uploading…"
        onFilesChange={(files) => {
          setHasFile(files.length > 0);
          setError(null);
        }}
      />
      <Button type="submit" variant="outline" loading={pending} disabled={!hasFile || pending}>
        {pending ? "Uploading…" : "Upload version"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
