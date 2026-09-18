import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const c = await p.company.findUnique({
    where: { slug: "meridian-integrated-facilities" },
    include: {
      profile: true,
      users: { select: { email: true, role: true } },
      subscription: true,
      usage: true,
      _count: { select: { tenders: true } },
    },
  });
  const demo = await p.company.findFirst({
    where: {
      OR: [{ slug: "bidvera-demo" }, { name: { contains: "Demo" } }],
    },
  });
  console.log(
    JSON.stringify(
      {
        name: c?.name,
        slug: c?.slug,
        status: c?.status,
        plan: c?.subscription?.plan,
        subStatus: c?.subscription?.status,
        provider: c?.subscription?.provider,
        analysesLimit: c?.usage?.analysesLimit,
        completeness: c?.profile?.completeness,
        users: c?.users,
        tenders: c?._count.tenders,
        demoGone: !demo,
      },
      null,
      2,
    ),
  );
}

main()
  .finally(() => p.$disconnect());
