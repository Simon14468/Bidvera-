/**
 * Hit Next.js runtime smoke endpoints for CPS (not tsx-only extract).
 *
 * Requires: npm run dev (or start) on localhost:3000
 * Run: npx tsx scripts/e2e-cps-next-runtime.ts
 */
export {};

const BASE = process.env.CPS_SMOKE_BASE ?? "http://localhost:3000";
const SECRET = process.env.CPS_SMOKE_SECRET ?? "dev-cps-smoke";

async function post(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 1000) };
  }
  return { status: res.status, json };
}

async function main() {
  console.log("=== CPS Next.js runtime smoke ===");
  console.log("base:", BASE);

  const extract = await post("/api/internal/cps-extract-smoke");
  console.log("\n— Extract smoke —");
  console.log(JSON.stringify(extract, null, 2));

  const pipeline = await post("/api/internal/cps-pipeline-smoke");
  console.log("\n— Pipeline smoke —");
  console.log(JSON.stringify(pipeline, null, 2));

  const ex = extract.json as {
    ok?: boolean;
    method?: string;
    pageCount?: number;
    characterCount?: number;
    usedOcrFallback?: boolean;
    classification?: string;
    checks?: Record<string, boolean>;
  };
  const pipe = pipeline.json as {
    ok?: boolean;
    analysisStatus?: string;
    requirementCount?: number;
    ready?: number;
    missing?: number;
    verify?: number;
    evidence?: number;
    deadline?: string | null;
    deadlineDisplay?: string;
    fitScore?: number | null;
    fitConsistent?: boolean;
    bidScore?: number | null;
    expectedValue?: string | null;
    decision?: string | null;
    checks?: Record<string, boolean>;
  };

  const pass =
    extract.status === 200 &&
    ex.ok === true &&
    ex.checks?.nativeExtraction === true &&
    ex.checks?.pages21 === true &&
    ex.checks?.ocrNotRequired === true &&
    pipeline.status === 200 &&
    pipe.ok === true &&
    pipe.checks?.completed === true &&
    pipe.checks?.requirementsGt0 === true &&
    pipe.checks?.fitConsistent === true &&
    pipe.checks?.notAllVerify !== false &&
    (pipe.requirementCount ?? 0) > 0 &&
    (pipe.evidence ?? 0) > 0 &&
    ((pipe.ready ?? 0) > 0 || (pipe.missing ?? 0) > 0);

  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        extractOk: extract.status === 200 && ex.ok,
        method: ex.method,
        pages: ex.pageCount,
        chars: ex.characterCount,
        ocr: ex.usedOcrFallback,
        classification: ex.classification,
        pipelineStatus: pipe.analysisStatus,
        requirements: pipe.requirementCount,
        ready: pipe.ready,
        missing: pipe.missing,
        verify: pipe.verify,
        evidence: pipe.evidence,
        deadline: pipe.deadlineDisplay ?? pipe.deadline,
        fitScore: pipe.fitScore,
        fitConsistent: pipe.fitConsistent,
        bidScore: pipe.bidScore,
        expectedValue: pipe.expectedValue,
        decision: pipe.decision,
        PASS: pass,
      },
      null,
      2,
    ),
  );

  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
