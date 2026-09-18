import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.tenderDocument.findMany({
    where: {
      OR: [
        { fileName: { contains: "Realistic", mode: "insensitive" } },
        { fileName: { contains: "Bidvera", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      tender: {
        select: {
          id: true,
          title: true,
          analysisStatus: true,
          analysisError: true,
          createdAt: true,
          updatedAt: true,
          analyzedAt: true,
          decision: { select: { id: true, decision: true } },
        },
      },
    },
  });

  console.log("=== MATCHING DOCUMENTS ===");
  for (const d of docs) {
    console.log(JSON.stringify({
      fileName: d.fileName,
      tenderId: d.tenderId,
      processingStatus: d.processingStatus,
      pageCount: d.pageCount,
      textLen: d.extractedText?.length ?? 0,
      tender: d.tender,
    }, null, 2));

    const jobs = await prisma.job.findMany({
      where: {
        tenderId: d.tenderId,
        type: { in: ["RUN_TENDER_ANALYSIS", "PROCESS_TENDER_DOCUMENT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log("JOBS:", JSON.stringify(jobs, null, 2));

    const phaseRows = await prisma.$queryRaw<
      Array<{ analysisPhase: string | null; analysisStatus: string; analysisError: string | null }>
    >`SELECT "analysisPhase", "analysisStatus", "analysisError" FROM "Tender" WHERE id = ${d.tenderId}`;
    console.log("PHASE:", JSON.stringify(phaseRows[0], null, 2));
  }

  console.log("\n=== RECENT TENDERS ===");
  const recent = await prisma.tender.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      analysisStatus: true,
      analysisError: true,
      createdAt: true,
      updatedAt: true,
      analyzedAt: true,
      documents: { select: { fileName: true, processingStatus: true }, take: 3 },
      decision: { select: { decision: true } },
    },
  });
  console.log(JSON.stringify(recent, null, 2));

  console.log("\n=== RUNNING / STUCK JOBS ===");
  const running = await prisma.job.findMany({
    where: { status: { in: ["RUNNING", "PENDING", "DEAD"] } },
    orderBy: { updatedAt: "desc" },
    take: 15,
  });
  console.log(JSON.stringify(running, null, 2));

  const incomplete = await prisma.tender.findMany({
    where: {
      analysisStatus: { notIn: ["COMPLETED", "FAILED"] },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      analysisStatus: true,
      analysisError: true,
      updatedAt: true,
      documents: { select: { fileName: true }, take: 2 },
    },
  });
  console.log("\n=== INCOMPLETE TENDERS (7d) ===");
  console.log(JSON.stringify(incomplete, null, 2));

  const dead = await prisma.job.findMany({
    where: { status: "DEAD", type: { in: ["RUN_TENDER_ANALYSIS", "PROCESS_TENDER_DOCUMENT"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  console.log("\n=== DEAD ANALYSIS JOBS ===");
  console.log(JSON.stringify(dead, null, 2));

  const runningAnalysis = await prisma.job.findMany({
    where: { status: "RUNNING", type: { in: ["RUN_TENDER_ANALYSIS", "PROCESS_TENDER_DOCUMENT"] } },
  });
  console.log("\n=== RUNNING ANALYSIS JOBS ===");
  console.log(JSON.stringify(runningAnalysis, null, 2));

  for (const tid of ["cmtiw70bf0dgorkro8yasu2sx", "cmtiw38ai0cf0rkrorohq7uag"]) {
    const logs = await prisma.aiUsageLog.findMany({
      where: { tenderId: tid },
      orderBy: { createdAt: "asc" },
      select: { task: true, success: true, latencyMs: true, errorMessage: true, createdAt: true },
    });
    console.log(`\n=== AI TIMELINE ${tid} ===`);
    console.log(JSON.stringify(logs, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
