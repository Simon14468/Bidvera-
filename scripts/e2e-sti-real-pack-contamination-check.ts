/**
 * Spot-check real DB packs: sealed admitted must not carry post-award/buyer semantics.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { buildCanonicalSemanticCandidates } from "../src/domain/semantic-tender-intelligence/candidates";
import { StiApprovedRequirementBatch } from "../src/domain/semantic-tender-intelligence/sti-seal";
import { isPostAwardOnlyPhase } from "../src/domain/semantic-tender-intelligence/phase";
import { buildCanonicalRequirements } from "../src/domain/tender-requirements";
import type { ProcurementPhase } from "../src/domain/semantic-tender-intelligence/types";

function applyEnv(file: string, override = false) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i);
    const v = line.slice(i + 1).replace(/^["']|["']$/g, "");
    if (override || process.env[k] === undefined) process.env[k] = v;
  }
}
applyEnv(".env");
applyEnv(".env.local", true);

const prisma = new PrismaClient();

async function check(tenderId: string, label: string) {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      decision: { select: { intelligenceBreakdown: true } },
      documents: { select: { fileName: true, extractedText: true } },
    },
  });
  if (!tender) return { label, error: "missing" };

  const intel = tender.decision?.intelligenceBreakdown as {
    complianceMatrix?: Array<{ requirement?: string; description?: string; sourceDocument?: string | null }>;
  } | null;
  const rows = intel?.complianceMatrix ?? [];
  const drafts =
    rows.length > 0
      ? rows.map((r) => ({
          description: r.requirement ?? r.description ?? "",
          sourceDocument: r.sourceDocument ?? tender.title,
        }))
      : tender.documents.flatMap((d) =>
          (d.extractedText ?? "")
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.replace(/\s+/g, " ").trim())
            .filter((s) => s.length > 40 && /\b(?:shall|must)\b/i.test(s))
            .slice(0, 80)
            .map((description) => ({ description, sourceDocument: d.fileName })),
        );

  const { candidates, rejected } = buildCanonicalSemanticCandidates(drafts, {
    packageLabel: tender.title,
  });
  const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, tender.title);
  const canonical = buildCanonicalRequirements({ stiApproved: sealed });
  const contamination = canonical.filter(
    (r) =>
      isPostAwardOnlyPhase((r.stiProcurementPhase ?? "UNKNOWN") as ProcurementPhase) ||
      r.stiClausePurpose === "BUYER_OBLIGATION" ||
      r.stiActor === "CONTRACTOR" ||
      r.stiActor === "BUYER" ||
      r.stiActor === "AUTHORITY",
  );

  return {
    label,
    tenderId,
    files: tender.documents.length,
    formats: [...new Set(tender.documents.map((d) => d.fileName.split(".").pop()?.toLowerCase()))],
    drafts: drafts.length,
    stiCandidates: candidates.length,
    admitted: canonical.length,
    rejected: rejected.length,
    contamination: contamination.map((r) => ({
      text: r.requirement.slice(0, 120),
      actor: r.stiActor,
      phase: r.stiProcurementPhase,
      purpose: r.stiClausePurpose,
    })),
    samplesAdmitted: canonical.slice(0, 3).map((r) => ({
      text: r.requirement.slice(0, 100),
      actor: r.stiActor,
      phase: r.stiProcurementPhase,
    })),
    result: contamination.length === 0 ? "PASS" : "FAIL",
  };
}

async function main() {
  const recent = await prisma.tender.findMany({
    where: { analysisStatus: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true, title: true },
  });
  const reports = [];
  for (const t of recent) {
    reports.push(await check(t.id, t.title.slice(0, 80)));
  }
  const status = reports.every((r) => r.result === "PASS") ? "PASS" : "FAIL";
  const out = { status, packages: reports };
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/sti-real-pack-contamination-check.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (status !== "PASS") process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
