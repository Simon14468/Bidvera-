/**
 * Synthetic load-test users + pre-issued sessions.
 * NEVER run against production (hostname / DATABASE_URL guards).
 *
 * Outputs:
 * - load-test/fixtures/users.json  (email, companyId, sessionCookie for k6)
 * - Does not send email, charge cards, or call AI providers.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../src/auth/password";
import { generateToken, hashToken } from "../src/lib/crypto";
import { prisma } from "../src/lib/db";
import { assertLoadTestTargetSafe } from "../src/services/load-test/safety";

const USER_COUNT = Number.parseInt(process.env.LOAD_TEST_USER_COUNT ?? "1000", 10);
const PASSWORD = process.env.LOAD_TEST_USER_PASSWORD ?? "LoadTestUser1!";
const OUT_PRIMARY =
  process.env.LOAD_TEST_USERS_OUT ??
  path.join(process.cwd(), ".data", "load-test", "users.json");
const OUT_FIXTURES = path.join(process.cwd(), "load-test", "fixtures", "users.json");

function sessionExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d;
}

async function main() {
  assertLoadTestTargetSafe({
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    loadTestMode: process.env.LOAD_TEST_MODE,
  });

  if (!Number.isFinite(USER_COUNT) || USER_COUNT < 1 || USER_COUNT > 5000) {
    throw new Error("LOAD_TEST_USER_COUNT must be between 1 and 5000.");
  }

  const business = await prisma.plan.findFirst({ where: { slug: "business" } });
  if (!business) {
    throw new Error("Run prisma/seed.ts first so plans exist.");
  }

  const passwordHash = await hashPassword(PASSWORD);
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const fixtures: Array<{
    i: number;
    email: string;
    password: string;
    companyId: string;
    companySlug: string;
    sessionToken: string;
  }> = [];

  console.log(`[load-test-seed] creating ${USER_COUNT} companies/users + sessions...`);

  for (let i = 0; i < USER_COUNT; i++) {
    const n = String(i).padStart(4, "0");
    const slug = `loadtest-co-${n}`;
    const email = `loadtest.user.${n}@bidvera.loadtest`;

    const company = await prisma.company.upsert({
      where: { slug },
      create: {
        name: `Load Test Co ${n}`,
        slug,
        domain: `loadtest-${n}.example`,
        country: "MA",
        companySize: "11-50",
        status: "ACTIVE",
        profile: {
          create: {
            industry: "Facilities",
            country: "MA",
            companySize: "11-50",
            services: ["Cleaning", "Security"],
            completeness: 40,
          },
        },
        usage: {
          create: {
            analysesUsed: 0,
            analysesLimit: business.analysesLimit ?? 100,
          },
        },
        subscription: {
          create: {
            plan: "BUSINESS",
            planId: business.id,
            status: "ACTIVE",
            provider: "manual_admin",
            billingInterval: "MONTH",
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        },
      },
      update: { status: "ACTIVE" },
    });

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `Load Tester ${n}`,
        passwordHash,
        role: "OWNER",
        emailVerified: true,
        onboardingStep: "DONE",
        companyId: company.id,
        acceptedTermsAt: new Date(),
      },
      update: {
        passwordHash,
        companyId: company.id,
        onboardingStep: "DONE",
        emailVerified: true,
        role: "OWNER",
      },
    });

    await prisma.session.deleteMany({ where: { userId: user.id } });
    const sessionToken = generateToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: sessionExpiry(),
        deviceFingerprint: `loadtest-${n}`,
      },
    });

    fixtures.push({
      i,
      email,
      password: PASSWORD,
      companyId: company.id,
      companySlug: company.slug,
      sessionToken,
    });

    if ((i + 1) % 100 === 0) {
      console.log(`[load-test-seed] ${i + 1}/${USER_COUNT}`);
    }
  }

  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      cookieName: "bidvera_session",
      password: PASSWORD,
      count: fixtures.length,
      users: fixtures.map((u) => ({
        email: u.email,
        companyId: u.companyId,
        sessionToken: u.sessionToken,
      })),
    },
    null,
    2,
  );

  // Shared Docker volume path (k6 reads this) + local fixtures mirror for host runs.
  for (const out of [OUT_PRIMARY, OUT_FIXTURES]) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, payload, "utf8");
    console.log(`[load-test-seed] wrote ${fixtures.length} fixtures → ${out}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
