import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENDER_ID = process.argv[2] ?? "cmtiw70bf0dgorkro8yasu2sx";

async function main() {
  const tender = await prisma.tender.findUnique({
    where: { id: TENDER_ID },
    select: {
      id: true,
      title: true,
      analysisStatus: true,
      createdAt: true,
      updatedAt: true,
      analyzedAt: true,
      decision: { select: { decision: true, createdAt: true } },
      documents: {
        select: {
          fileName: true,
          processingStatus: true,
          pageCount: true,
          extractedText: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  console.log("TENDER:", JSON.stringify(tender, null, 2));

  const audit = await prisma.auditLog.findMany({
    where: {
      metadata: { path: ["tenderId"], equals: TENDER_ID },
    },
    orderBy: { createdAt: "asc" },
    select: { action: true, createdAt: true, metadata: true },
  });
  console.log("\nAUDIT TIMELINE:");
  for (const row of audit) {
    console.log(`${row.createdAt.toISOString()}  ${row.action}`);
  }

  const jobs = await prisma.job.findMany({
    where: { tenderId: TENDER_ID, type: "RUN_TENDER_ANALYSIS" },
    orderBy: { createdAt: "asc" },
  });
  console.log("\nJOB:", JSON.stringify(jobs, null, 2));

  const ai = await prisma.aiUsageLog.findMany({
    where: { tenderId: TENDER_ID },
    orderBy: { createdAt: "asc" },
  });
  console.log("\nAI:", JSON.stringify(ai, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
