/**
 * Materialize a company Matching Profile via the supported rebuild API.
 * Usage: npx tsx scripts/matching-rebuild-company.ts <company-slug-or-id>
 *
 * Does NOT invent capabilities — calls rebuildMatchingProfileForCompany only.
 */

import { prisma } from "../src/lib/db";
import {
  previewMatchingProfileForCompany,
  rebuildMatchingProfileForCompany,
} from "../src/modules/matching-engine";

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error("Usage: npx tsx scripts/matching-rebuild-company.ts <slug-or-id>");
    process.exit(1);
  }

  const company = await prisma.company.findFirst({
    where: {
      OR: [{ id: key }, { slug: key }],
    },
    select: { id: true, name: true, slug: true },
  });
  if (!company) {
    console.error("Company not found:", key);
    process.exit(1);
  }

  console.log(`Rebuilding Matching Profile for ${company.name} (${company.slug})`);
  const before = await previewMatchingProfileForCompany(company.id);
  console.log(
    `before: stored=${Boolean(before.stored)} derivedEligible=${before.derived.eligible} stale=${before.propagationStale}`,
  );

  const rebuilt = await rebuildMatchingProfileForCompany(company.id);
  const after = await previewMatchingProfileForCompany(company.id);

  console.log(
    JSON.stringify(
      {
        companyId: company.id,
        eligible: rebuilt.eligible,
        completeness: rebuilt.completeness,
        version: rebuilt.version,
        contentHash: rebuilt.contentHash,
        services: rebuilt.snapshot.services.map((s) => s.value),
        geographies: rebuilt.snapshot.geographies.map((g) => g.value),
        propagationStale: after.propagationStale,
        storedExists: Boolean(after.stored),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
