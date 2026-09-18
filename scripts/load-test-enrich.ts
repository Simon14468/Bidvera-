/**
 * Synthetic related rows for load-test tenants (isolated DB only).
 */
import { prisma } from "../src/lib/db";
import { assertLoadTestTargetSafe } from "../src/services/load-test/safety";

async function main() {
  assertLoadTestTargetSafe({
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    loadTestMode: process.env.LOAD_TEST_MODE,
  });

  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: "loadtest-co-" } },
    take: 150,
    orderBy: { slug: "asc" },
    include: { users: { take: 1 } },
  });

  let docs = 0;
  let reqs = 0;
  let quals = 0;
  let evidence = 0;

  for (const c of companies) {
    const userId = c.users[0]?.id ?? null;

    const category = await prisma.complianceDocumentCategory.upsert({
      where: { companyId_key: { companyId: c.id, key: "legal" } },
      create: {
        companyId: c.id,
        key: "legal",
        label: "Legal",
        sortOrder: 0,
      },
      update: {},
    });

    for (let i = 0; i < 3; i++) {
      await prisma.complianceDocument.create({
        data: {
          companyId: c.id,
          categoryId: category.id,
          name: `LoadDoc ${i} ${c.slug}`,
          status: i === 0 ? "VALID" : "EXPIRING_SOON",
          issueDate: new Date(),
          expiryDate: new Date(Date.now() + 86400000 * (30 + i * 20)),
        },
      });
      docs++;
    }

    await prisma.clientRequest.create({
      data: {
        companyId: c.id,
        clientName: `Client ${c.slug}`,
        title: `Load Request ${c.slug}`,
        description: "Synthetic load-test request",
        deadline: new Date(Date.now() + 86400000 * 14),
        deadlineDateOnly: true,
        status: "PENDING",
        createdByUserId: userId,
      },
    });
    reqs++;

    const profile = await prisma.supplierQualificationProfile.upsert({
      where: { companyId: c.id },
      create: {
        companyId: c.id,
        legalCompanyName: c.name,
        country: "MA",
        businessSectors: ["Facilities"],
        servicesProducts: ["Cleaning"],
      },
      update: {},
    });
    quals++;

    await prisma.supplierQualificationEvidence.create({
      data: {
        companyId: c.id,
        profileId: profile.id,
        title: `Evidence ${c.slug}`,
        kind: "CERTIFICATE",
        description: "Synthetic evidence",
        verified: false,
      },
    });
    evidence++;
  }

  const counts = {
    companies: await prisma.company.count({
      where: { slug: { startsWith: "loadtest-co-" } },
    }),
    users: await prisma.user.count({
      where: { email: { endsWith: "@bidvera.loadtest" } },
    }),
    complianceDocuments: await prisma.complianceDocument.count(),
    clientRequests: await prisma.clientRequest.count(),
    sqProfiles: await prisma.supplierQualificationProfile.count(),
    sqEvidence: await prisma.supplierQualificationEvidence.count(),
    sessions: await prisma.session.count(),
  };

  console.log(JSON.stringify({ enriched: { docs, reqs, quals, evidence }, counts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
