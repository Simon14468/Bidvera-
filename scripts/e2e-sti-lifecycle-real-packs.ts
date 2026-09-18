/**
 * Offline STI lifecycle boundary report across stored real packages.
 * No tender-specific rules — interprets extracted requirement drafts through STI.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { buildCanonicalSemanticCandidates } from "@/domain/semantic-tender-intelligence/candidates";
import { StiApprovedRequirementBatch } from "@/domain/semantic-tender-intelligence/sti-seal";

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

type Bucket = {
  label: string;
  tenderId: string;
  drafts: number;
  canonical: number;
  bidderSubstantive: number;
  bidderProcedural: number;
  buyerExcluded: number;
  postAwardExcluded: number;
  templateExcluded: number;
  otherExcluded: number;
  sampleBuyer: string[];
  samplePostAward: string[];
  sampleTemplate: string[];
};

async function analyzeTender(tenderId: string, label: string): Promise<Bucket | null> {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      decision: { select: { intelligenceBreakdown: true } },
      documents: { select: { fileName: true, extractedText: true } },
    },
  });
  if (!tender) return null;

  const intel = tender.decision?.intelligenceBreakdown as {
    complianceMatrix?: Array<{
      requirement?: string;
      description?: string;
      sourceDocument?: string | null;
      category?: string | null;
    }>;
    requirements?: Array<{
      description?: string;
      requirement?: string;
      sourceDocument?: string | null;
    }>;
  } | null;

  const rows =
    intel?.complianceMatrix?.length
      ? intel.complianceMatrix
      : intel?.requirements ?? [];

  // Fallback: harvest shall-lines from extracted text when no decision snapshot.
  const drafts =
    rows.length > 0
      ? rows.map((r) => ({
          description: r.requirement ?? r.description ?? "",
          sourceDocument: r.sourceDocument ?? tender.title,
          category: (r as { category?: string }).category ?? null,
        }))
      : tender.documents.flatMap((d) => {
          const text = d.extractedText ?? "";
          const lines = text
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.replace(/\s+/g, " ").trim())
            .filter((s) => s.length > 40 && /\b(?:shall|must|will|may)\b/i.test(s))
            .slice(0, 80);
          return lines.map((description) => ({
            description,
            sourceDocument: d.fileName,
            category: null as string | null,
          }));
        });

  const { candidates, rejected } = buildCanonicalSemanticCandidates(drafts, {
    packageLabel: tender.title,
  });
  const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
    candidates,
    tender.title,
  );

  const bidderProcedural = candidates.filter(
    (c) => c.clauseRole === "BIDDER_PROCEDURAL_REQUIREMENT",
  ).length;
  const bidderSubstantive = Math.max(0, sealed.size - bidderProcedural);

  const buyerExcluded = rejected.filter(
    (r) =>
      r.clausePurpose === "BUYER_OBLIGATION" ||
      r.exclusionCode === "EXCLUDED_BUYER_OBLIGATION",
  );
  const postAwardExcluded = rejected.filter(
    (r) =>
      r.clausePurpose === "POST_AWARD_OBLIGATION" ||
      r.exclusionCode === "EXCLUDED_POST_AWARD",
  );
  const templateExcluded = rejected.filter(
    (r) =>
      r.clausePurpose === "TEMPLATE" ||
      r.clausePurpose === "FORM_INSTRUCTION" ||
      r.exclusionCode === "EXCLUDED_TEMPLATE" ||
      r.exclusionCode === "EXCLUDED_FORM_INSTRUCTION",
  );

  return {
    label,
    tenderId,
    drafts: drafts.length,
    canonical: sealed.size,
    bidderSubstantive,
    bidderProcedural,
    buyerExcluded: buyerExcluded.length,
    postAwardExcluded: postAwardExcluded.length,
    templateExcluded: templateExcluded.length,
    otherExcluded:
      rejected.length -
      buyerExcluded.length -
      postAwardExcluded.length -
      templateExcluded.length,
    sampleBuyer: buyerExcluded.slice(0, 3).map((r) => r.requirementText.slice(0, 100)),
    samplePostAward: postAwardExcluded
      .slice(0, 3)
      .map((r) => r.requirementText.slice(0, 100)),
    sampleTemplate: templateExcluded
      .slice(0, 3)
      .map((r) => r.requirementText.slice(0, 100)),
  };
}

async function main() {
  const preferred = [
    { id: "cmtnkhv580blxrk38sfayjw98", label: "Tender_310896 (SOGREA-class RFP)" },
  ];
  const recent = await prisma.tender.findMany({
    where: { analysisStatus: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true },
  });

  const seen = new Set<string>();
  const targets: Array<{ id: string; label: string }> = [];
  for (const p of preferred) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      targets.push(p);
    }
  }
  for (const t of recent) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    targets.push({ id: t.id, label: t.title.slice(0, 80) });
    if (targets.length >= 3) break;
  }

  const reports: Bucket[] = [];
  for (const t of targets) {
    const r = await analyzeTender(t.id, t.label);
    if (r) reports.push(r);
  }

  console.log(JSON.stringify({ packages: reports }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
