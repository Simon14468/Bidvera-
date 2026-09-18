/**
 * Lightweight regression checks for registration/onboarding funnel wiring.
 * Run: npx tsx scripts/onboarding-regression.ts
 */
import { PrismaClient } from "@prisma/client";
import { onboardingPathForStep } from "../src/auth/onboarding";
import { createAccountSchema, companyOnboardingSchema } from "../src/domain/schemas";
import { authSettingsSchema, DEFAULT_AUTH_SETTINGS } from "../src/services/auth/settings";

const prisma = new PrismaClient();

async function main() {
  const asserts: string[] = [];

  function ok(name: string, cond: boolean) {
    if (!cond) throw new Error(`FAIL: ${name}`);
    asserts.push(name);
  }

  ok("path verify", onboardingPathForStep("VERIFY_EMAIL") === "/onboarding/verify");
  ok("path company", onboardingPathForStep("COMPANY") === "/onboarding/company");
  ok("path plan", onboardingPathForStep("PLAN") === "/onboarding/plan");
  ok("path done", onboardingPathForStep("DONE") === "/dashboard");

  ok(
    "createAccount schema",
    createAccountSchema.safeParse({
      email: "a@b.com",
      password: "password1",
      acceptTerms: true,
    }).success,
  );
  ok(
    "createAccount rejects terms",
    !createAccountSchema.safeParse({
      email: "a@b.com",
      password: "password1",
      acceptTerms: false,
    }).success,
  );
  ok(
    "company schema",
    companyOnboardingSchema.safeParse({
      companyName: "Acme FM",
      country: "United Kingdom",
      industry: "Security & Facilities",
      companySize: "Medium",
      services: ["Soft facilities management", "Hard facilities management"],
      experienceLevel: "experienced",
    }).success,
  );
  ok("auth settings defaults", authSettingsSchema.parse(DEFAULT_AUTH_SETTINGS).registrationEnabled);

  const accounts = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "owner@meridian-facilities.test",
          "admin@meridian-facilities.test",
          "analyst@meridian-facilities.test",
          "trial@bidvera.com",
        ],
      },
    },
  });
  ok("seeded test users present", accounts.length >= 3);
  for (const u of accounts) {
    ok(`${u.email} DONE`, u.onboardingStep === "DONE");
    ok(`${u.email} has company`, !!u.companyId);
    ok(`${u.email} verified`, u.emailVerified);
  }

  const meridian = await prisma.company.findUnique({
    where: { slug: "meridian-integrated-facilities" },
    include: { subscription: true, profile: true },
  });
  ok("meridian company exists", !!meridian);
  ok("meridian not demo-named", !meridian?.name.toLowerCase().includes("demo"));
  ok("meridian active", meridian?.status === "ACTIVE");
  ok("meridian business plan", meridian?.subscription?.plan === "BUSINESS");
  ok("meridian profile complete", (meridian?.profile?.completeness ?? 0) >= 90);

  console.log(`OK ${asserts.length} checks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
