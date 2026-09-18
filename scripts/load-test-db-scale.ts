/**
 * Isolated DB scale probes (synthetic data only, localhost Postgres).
 * Measures tenant-scoped query timings via EXPLAIN ANALYZE.
 *
 * Uses slug prefix `loadscale-co-` (not `loadtest-co-`) so growth never collides
 * with load-test session seed companies, and always re-resolves Plan.id before insert
 * to avoid Subscription_planId_fkey failures from stale IDs.
 */
import { prisma } from "../src/lib/db";
import { assertLoadTestTargetSafe } from "../src/services/load-test/safety";

const TARGETS = [1000, 10_000, 50_000, 100_000].map(Number);
const SCALE_SLUG_PREFIX = "loadscale-co-";

async function companyCount(): Promise<number> {
  return prisma.company.count({ where: { slug: { startsWith: SCALE_SLUG_PREFIX } } });
}

async function resolveBusinessPlan(): Promise<{ id: string; analysesLimit: number }> {
  const plan =
    (await prisma.plan.findFirst({
      where: { slug: "business", status: "ACTIVE" },
      select: { id: true, analysesLimit: true },
    })) ??
    (await prisma.plan.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { monthlyPriceCents: "desc" },
      select: { id: true, analysesLimit: true },
    }));
  if (!plan) {
    throw new Error("No ACTIVE Plan row — run prisma/seed.ts inside the load-test DB first.");
  }
  const stillThere = await prisma.plan.findUnique({
    where: { id: plan.id },
    select: { id: true },
  });
  if (!stillThere) {
    throw new Error(`Plan id ${plan.id} vanished before insert (Subscription_planId_fkey guard).`);
  }
  return plan;
}

async function growTo(target: number) {
  const current = await companyCount();
  if (current >= target) {
    console.log(`[db-scale] already have ${current} loadscale companies (>= ${target})`);
    return;
  }

  let plan = await resolveBusinessPlan();
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  console.log(
    `[db-scale] growing from ${current} → ${target} using planId=${plan.id}`,
  );

  for (let i = current; i < target; i++) {
    // Re-resolve periodically in case seed/admin rewrote plans mid-run.
    if (i === current || i % 1000 === 0) {
      plan = await resolveBusinessPlan();
    }
    const n = String(i).padStart(5, "0");
    const slug = `${SCALE_SLUG_PREFIX}${n}`;
    try {
      await prisma.company.create({
        data: {
          name: `Load Scale Co ${n}`,
          slug,
          domain: `loadscale-${n}.example`,
          country: "MA",
          companySize: "11-50",
          status: "ACTIVE",
          profile: {
            create: {
              industry: "Facilities",
              country: "MA",
              companySize: "11-50",
              services: ["Cleaning"],
              completeness: 20,
            },
          },
          usage: {
            create: {
              analysesUsed: 0,
              analysesLimit: plan.analysesLimit ?? 100,
            },
          },
          subscription: {
            create: {
              plan: "BUSINESS",
              planId: plan.id,
              status: "ACTIVE",
              provider: "manual_admin",
              billingInterval: "MONTH",
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
          },
        },
      });
    } catch (error) {
      // Retry once with a freshly resolved plan id (covers transient FK races).
      plan = await resolveBusinessPlan();
      await prisma.company.create({
        data: {
          name: `Load Scale Co ${n}`,
          slug,
          domain: `loadscale-${n}.example`,
          country: "MA",
          companySize: "11-50",
          status: "ACTIVE",
          profile: {
            create: {
              industry: "Facilities",
              country: "MA",
              companySize: "11-50",
              services: ["Cleaning"],
              completeness: 20,
            },
          },
          usage: {
            create: {
              analysesUsed: 0,
              analysesLimit: plan.analysesLimit ?? 100,
            },
          },
          subscription: {
            create: {
              plan: "BUSINESS",
              planId: plan.id,
              status: "ACTIVE",
              provider: "manual_admin",
              billingInterval: "MONTH",
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
          },
        },
      });
      void error;
    }
    if ((i + 1) % 500 === 0) console.log(`[db-scale] ${i + 1}/${target}`);
  }
}

async function probe(label: string, companyId: string) {
  const started = Date.now();
  const rows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
     SELECT id, name, status FROM "Company" WHERE id = $1`,
    companyId,
  );
  const t0 = Date.now();
  await prisma.company.findUnique({
    where: { id: companyId },
    include: { profile: true, usage: true, subscription: true },
  });
  const companyMs = Date.now() - t0;

  const t1 = Date.now();
  await prisma.complianceDocument.findMany({
    where: { companyId },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
  const docsMs = Date.now() - t1;

  const t2 = Date.now();
  await prisma.clientRequest.findMany({
    where: { companyId },
    take: 50,
    orderBy: { deadline: "asc" },
  });
  const reqMs = Date.now() - t2;

  const t3 = Date.now();
  await prisma.supplierQualificationEvidence.findMany({
    where: { companyId },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
  const evidenceMs = Date.now() - t3;

  const planText = rows.map((r) => r["QUERY PLAN"]).join("\n");
  const seqScan = /Seq Scan/i.test(planText);
  return {
    label,
    wallMs: Date.now() - started,
    companyMs,
    docsMs,
    reqMs,
    evidenceMs,
    seqScanOnCompanyById: seqScan,
    explainSnippet: planText.split("\n").slice(0, 6).join(" | "),
  };
}

async function main() {
  assertLoadTestTargetSafe({
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    loadTestMode: process.env.LOAD_TEST_MODE,
  });

  const freeHint = process.env.DB_SCALE_MAX ? Number(process.env.DB_SCALE_MAX) : 10_000;
  const results: unknown[] = [];

  for (const target of TARGETS) {
    if (target > freeHint) {
      results.push({
        targetCompanies: target,
        result: "NOT_EXECUTED",
        reason: `DB_SCALE_MAX=${freeHint} safety cap for this host`,
      });
      continue;
    }
    const tGrow = Date.now();
    try {
      await growTo(target);
    } catch (e) {
      results.push({
        targetCompanies: target,
        result: "NOT_EXECUTED",
        reason: String(e),
        growMs: Date.now() - tGrow,
      });
      break;
    }
    const sample = await prisma.company.findFirst({
      where: { slug: { startsWith: SCALE_SLUG_PREFIX } },
      orderBy: { slug: "asc" },
    });
    if (!sample) throw new Error("no sample loadscale company");
    const measured = await probe(`companies≈${target}`, sample.id);
    const total = await companyCount();
    results.push({
      targetCompanies: target,
      actualCompanies: total,
      growMs: Date.now() - tGrow,
      result: "EXECUTED",
      ...measured,
    });
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
