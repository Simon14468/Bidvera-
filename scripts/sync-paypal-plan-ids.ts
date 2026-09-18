import { prisma } from "../src/lib/db";

const map = [
  { slug: "starter", env: "PAYPAL_PLAN_STARTER" },
  { slug: "pro", env: "PAYPAL_PLAN_PRO" },
  { slug: "business", env: "PAYPAL_PLAN_BUSINESS" },
] as const;

async function main() {
  for (const row of map) {
    const id = process.env[row.env];
    if (!id) {
      console.log("skip", row.slug, "(env missing)");
      continue;
    }
    await prisma.plan.updateMany({
      where: { slug: row.slug },
      data: {
        paypalPlanMonthly: id,
        paypalPlanIdEnv: row.env,
        paypalEnabled: true,
      },
    });
    console.log("synced", row.slug);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
