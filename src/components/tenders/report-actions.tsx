"use client";

import { createReportShareLink, revokeReportShareLinks } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import { Download, Link2, Printer, Unlink } from "lucide-react";
import { useState, useTransition } from "react";

export type ReportActionsCopy = {
  print: string;
  downloadPdf: string;
  shareLink: string;
  copied: string;
  shareExpires: string;
  revokeShare: string;
  shareRevoked: string;
};

function fileNameFromDisposition(header: string | null, tenderId: string): string {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] || `bidvera-report-${tenderId}.pdf`;
}

export function ReportActions({
  tenderId,
  copy,
}: {
  tenderId: string;
  copy: ReportActionsCopy;
}) {
  const [pending, startTransition] = useTransition();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending}
          onClick={() => window.print()}
        >
          <Printer className="size-4" aria-hidden />
          {copy.print}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const res = await fetch(`/api/tenders/${tenderId}/pdf`, {
                  method: "GET",
                  credentials: "same-origin",
                });
                if (!res.ok) {
                  const payload = (await res.json().catch(() => null)) as {
                    error?: string;
                  } | null;
                  setError(
                    payload?.error ?? "Something went wrong. Please try again.",
                  );
                  return;
                }
                const blob = await res.blob();
                if (blob.size < 5) {
                  setError("Something went wrong. Please try again.");
                  return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileNameFromDisposition(
                  res.headers.get("Content-Disposition"),
                  tenderId,
                );
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                setError("Something went wrong. Please try again.");
              }
            });
          }}
        >
          <Download className="size-4" aria-hidden />
          {copy.downloadPdf}
        </Button>
        <Button
          type="button"
          className="gap-2"
          disabled={pending}
          onClick={() => {
            setError(null);
            setCopied(false);
            startTransition(async () => {
              setRevoked(false);
              const result = await createReportShareLink(tenderId);
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setShareUrl(result.data.url);
              try {
                await navigator.clipboard.writeText(result.data.url);
                setCopied(true);
              } catch {
                /* ignore */
              }
            });
          }}
        >
          <Link2 className="size-4" aria-hidden />
          {copy.shareLink}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await revokeReportShareLinks(tenderId);
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setShareUrl(null);
              setCopied(false);
              setRevoked(true);
            });
          }}
        >
          <Unlink className="size-4" aria-hidden />
          {copy.revokeShare}
        </Button>
      </div>
      {shareUrl ? (
        <p className="max-w-md break-all text-xs text-muted">
          {copied ? `${copy.copied} ` : ""}
          {copy.shareExpires} {shareUrl}
        </p>
      ) : null}
      {revoked && !shareUrl ? (
        <p className="max-w-md text-xs text-muted">{copy.shareRevoked}</p>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
