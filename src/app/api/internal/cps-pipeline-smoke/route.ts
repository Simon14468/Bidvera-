import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storageService } from "@/services/storage";
import { processTenderAnalysis } from "@/modules/tender-analysis";
import { logInfo } from "@/services/observability";
import { extractCompanyKnowledgeHeuristic } from "@/domain/company-knowledge";
import { persistCompanyKnowledge } from "@/services/company-knowledge";
import { extractDocumentText } from "@/services/document/extract";
import {
  isInternalPipelineSmokeDisabled,
  resolvePipelineSmokeCompanyId,
} from "./guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function findUpload(matcher: RegExp): string | null {
  const root = path.join(process.cwd(), process.env.STORAGE_ROOT ?? ".data/uploads");
  if (!existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) stack.push(full);
      else if (matcher.test(name.name)) return full;
    }
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
 * Full Next.js pipeline smoke: Avis + CPS as one tender package → analysis.
 * Uses existing Atlas company profile document for Company Knowledge when present.
 * Requires Authorization: Bearer $CPS_SMOKE_SECRET (min 16 chars — no default).
 * Local/test only: set CPS_SMOKE_COMPANY_ID to an explicit company. Disabled in production.
 */
export async function POST(req: Request) {
  if (isInternalPipelineSmokeDisabled()) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cpsPath = findUpload(/CPS_v5.*VF29-07\.pdf$/i);
  const avisPath = findUpload(/Avis_en_Fran.*29-07\.pdf$/i);
  const atlasPath = findUpload(/Atlas_Digital_Solutions.*Profile\.pdf$/i);
  if (!cpsPath) {
    return NextResponse.json({ ok: false, error: "CPS_FILE_NOT_FOUND" }, { status: 404 });
  }

  const companyId = resolvePipelineSmokeCompanyId();
  if (!companyId) {
    return NextResponse.json({ ok: false, error: "SMOKE_COMPANY_REQUIRED" }, { status: 404 });
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ ok: false, error: "NO_COMPANY" }, { status: 404 });
  }

  // Ensure Company Knowledge from Atlas profile (extracted, never hardcoded)
  if (atlasPath) {
    try {
      const atlasBuf = readFileSync(atlasPath);
      const extracted = await extractDocumentText({
        buffer: atlasBuf,
        mimeType: "application/pdf",
        fileName: path.basename(atlasPath),
      });
      if (extracted.text && extracted.text.length > 500) {
        const knowledge = extractCompanyKnowledgeHeuristic({
          text: extracted.text,
          fileName: path.basename(atlasPath),
        });
        await persistCompanyKnowledge({
          companyId: company.id,
          knowledge,
        });
      }
    } catch {
      // Continue with whatever profile knowledge already exists
    }
  }

  const tender = await prisma.tender.create({
    data: {
      companyId: company.id,
      title: "Tender package smoke — Avis + CPS VF29-07",
      analysisStatus: "PROCESSING",
      status: "DRAFT",
    },
  });

  const files: Array<{ path: string; fileName: string }> = [
    ...(avisPath
      ? [{ path: avisPath, fileName: "Avis en Français v2 29-07.pdf" }]
      : []),
    { path: cpsPath, fileName: "CPS v5 - VF29-07.pdf" },
  ];

  for (const file of files) {
    const buffer = readFileSync(file.path);
    const stored = await storageService.putObject({
      companyId: company.id,
      tenderId: tender.id,
      fileName: file.fileName,
      mimeType: "application/pdf",
      body: buffer,
    });
    await prisma.tenderDocument.create({
      data: {
        tenderId: tender.id,
        companyId: company.id,
        fileName: file.fileName,
        storageKey: stored.storageKey,
        mimeType: "application/pdf",
        fileSize: stored.byteLength,
        checksumSha256: stored.checksumSha256,
        processingStatus: "STORED",
      },
    });
  }

  logInfo("cps.pipeline.start", {
    tenderId: tender.id,
    documents: files.map((f) => f.fileName),
  });

  try {
    await processTenderAnalysis(tender.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, tenderId: tender.id, error: message.slice(0, 500) },
      { status: 500 },
    );
  }

  const result = await prisma.tender.findUnique({
    where: { id: tender.id },
    select: {
      analysisStatus: true,
      analysisError: true,
      analysisPhase: true,
      deadline: true,
      deadlineTimezone: true,
      decision: {
        select: {
          decision: true,
          fitScore: true,
          reasoning: true,
          fitBreakdown: true,
          readinessBreakdown: true,
          bidScoreBreakdown: true,
        },
      },
      requirements: {
        select: { id: true, status: true, category: true, description: true, sourcePage: true },
      },
      documents: {
        select: {
          fileName: true,
          pageCount: true,
          documentKind: true,
          processingStatus: true,
        },
      },
      risks: { select: { id: true, category: true } },
      missingDocs: { select: { id: true } },
      evidence: { select: { id: true } },
    },
  });

  const reqs = result?.requirements ?? [];
  const ready = reqs.filter((r) => r.status === "MATCHED").length;
  const missing = reqs.filter((r) => r.status === "FAILED" || r.status === "MISSING").length;
  const verify = reqs.filter((r) => r.status === "UNCERTAIN").length;
  const byCategory: Record<string, number> = {};
  for (const r of reqs) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }
  const evidenceBacked = (
    await prisma.tenderRequirement.findMany({
      where: { tenderId: tender.id },
      select: { status: true, evidence: true },
    })
  ).filter(
    (r) =>
      (r.status === "MATCHED" || r.status === "FAILED") &&
      !!r.evidence &&
      r.evidence.trim().length > 0,
  ).length;
  const fitBreakdown = result?.decision?.fitBreakdown as { overall?: number } | null;
  const bid = result?.decision?.bidScoreBreakdown as {
    score?: number;
    expectedValue?: string;
  } | null;
  const reasoning = result?.decision?.reasoning ?? "";
  const fitInReasoning = reasoning.match(/(\d+)%\s+company–tender fit/i)?.[1];
  const fitScore = result?.decision?.fitScore ?? null;

  return NextResponse.json({
    ok: result?.analysisStatus === "COMPLETED",
    tenderId: tender.id,
    analysisStatus: result?.analysisStatus,
    documents: result?.documents,
    requirementCount: reqs.length,
    byCategory,
    ready,
    missing,
    verify,
    evidenceBackedDecisions: evidenceBacked,
    risks: result?.risks.length ?? 0,
    evidence: result?.evidence.length ?? 0,
    missingDocs: result?.missingDocs.length ?? 0,
    deadline: result?.deadline?.toISOString() ?? null,
    deadlineDisplay: result?.deadline ? result.deadline.toISOString() : "Unknown — Verify",
    decision: result?.decision?.decision ?? null,
    fitScore,
    fitBreakdownOverall: fitBreakdown?.overall ?? null,
    fitInReasoning: fitInReasoning ? Number(fitInReasoning) : null,
    fitConsistent:
      fitScore != null &&
      fitBreakdown?.overall === fitScore &&
      (fitInReasoning == null || Number(fitInReasoning) === fitScore),
    bidScore: bid?.score ?? null,
    expectedValue: bid?.expectedValue ?? null,
    checks: {
      requirementsGt0: reqs.length > 0,
      completed: result?.analysisStatus === "COMPLETED",
      fitConsistent:
        fitScore != null &&
        fitBreakdown?.overall === fitScore &&
        (fitInReasoning == null || Number(fitInReasoning) === fitScore),
      notAllVerify: ready + missing > 0,
      hasCategories: Object.keys(byCategory).length > 0,
    },
  });
}
