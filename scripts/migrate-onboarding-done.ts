import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      OR: [
        { onboardingStep: { not: "DONE" }, companyId: { not: null } },
        { onboardingStep: "VERIFY_EMAIL", emailVerified: true, companyId: { not: null } },
      ],
    },
    data: { onboardingStep: "DONE" },
  });
  // Existing accounts with a company should be treated as fully onboarded
  const allWithCompany = await prisma.user.updateMany({
    where: { companyId: { not: null } },
    data: { onboardingStep: "DONE" },
  });
  console.log("Updated (first pass):", result.count);
  console.log("Updated (company users → DONE):", allWithCompany.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
