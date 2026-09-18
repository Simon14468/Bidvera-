import { readFileSync, existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { classifyDocument } from "@/domain/company-knowledge";
import { extractDocumentText } from "@/services/document/extract";
import { ensurePdfWorker } from "@/services/document/pdf-worker";
import { logInfo } from "@/services/observability";
import { isInternalPipelineSmokeDisabled } from "@/app/api/internal/cps-pipeline-smoke/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CPS_CANDIDATES = [
  "cmtfvf1vm0000rkgkqq291zux/cmtg6a1oa00kgrkoktjqo91hu/1788116303681-CPS_v5_-_VF29-07.pdf",
  "cmtfvf1vm0000rkgkqq291zux/cmtg5ol4900gbrkokt770vb7q/1788115302145-CPS_v5_-_VF29-07.pdf",
];

function resolveCpsPath(): string | null {
  const root = process.env.STORAGE_ROOT ?? ".data/uploads";
  for (const rel of CPS_CANDIDATES) {
    const full = path.join(process.cwd(), root, rel);
    if (existsSync(full)) return full;
  }
  return null;
}

function authorized(req: Request): boolean {
  const expected = process.env.CPS_SMOKE_SECRET?.trim();
  // Fail-closed: never accept a hardcoded default secret (production abuse surface).
  if (!expected || expected.length < 16) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

/**
 * Next.js runtime smoke for CPS PDF extraction (not a public product API).
 * POST with Authorization: Bearer $CPS_SMOKE_SECRET (required, min 16 chars — no default).
 * Local/test only. Disabled in production even when CPS_SMOKE_SECRET is set.
 */
export async function POST(req: Request) {
  if (isInternalPipelineSmokeDisabled()) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cpsPath = resolveCpsPath();
  if (!cpsPath) {
    return NextResponse.json({ ok: false, error: "CPS_FILE_NOT_FOUND" }, { status: 404 });
  }

  const buffer = readFileSync(cpsPath);
  const workerSrc = await ensurePdfWorker();
  logInfo("cps.smoke.start", {
    bytes: buffer.byteLength,
    worker: workerSrc,
    runtime: "next",
  });

  const extracted = await extractDocumentText({
    buffer,
    mimeType: "application/pdf",
    fileName: "CPS v5 - VF29-07.pdf",
    documentId: "cps-next-smoke",
  });

  const classified = classifyDocument({
    text: extracted.text.slice(0, 20_000),
    fileName: "CPS v5 - VF29-07.pdf",
  });

  const body = {
    ok: true,
    runtime: "nextjs",
    workerSrc,
    path: cpsPath,
    method: extracted.method,
    usedOcrFallback: extracted.usedOcrFallback,
    pageCount: extracted.pageCount,
    characterCount: extracted.text.length,
    provenanceCount: extracted.pages.length,
    classification: classified.kind,
    classificationConfidence: classified.confidence,
    checks: {
      nativeExtraction: extracted.method === "pdf-parse" && extracted.text.length > 0,
      pages21: extracted.pageCount === 21,
      charsAround42k: extracted.text.length > 35_000,
      ocrNotRequired: !extracted.usedOcrFallback,
    },
  };

  logInfo("cps.smoke.done", {
    method: body.method,
    pageCount: body.pageCount,
    characterCount: body.characterCount,
    usedOcrFallback: body.usedOcrFallback,
    classification: body.classification,
  });

  return NextResponse.json(body);
}
