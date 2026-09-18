/**
 * One-shot: publish suggested Languages copy for every plan that has none.
 * Makes PricingGrid / Paywall read real DB translations instead of phantom maps.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import {
  buildPlanLanguagesDraft,
  MARKETING_LOCALES,
  parsePlanTranslations,
  type PlanLocaleCopy,
} from "../src/services/billing/plan-i18n";

function localeHasCopy(c: PlanLocaleCopy | undefined): boolean {
  if (!c) return false;
  return Boolean(
    c.name?.trim() ||
      c.description?.trim() ||
      (c.features && c.features.length > 0) ||
      (c.monthly?.features && c.monthly.features.length > 0) ||
      (c.yearly?.features && c.yearly.features.length > 0),
  );
}

async function main() {
  const plans = await prisma.plan.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      featureList: true,
      translations: true,
    },
  });

  let updated = 0;
  for (const plan of plans) {
    const existing = parsePlanTranslations(plan.translations);
    const hasAny = MARKETING_LOCALES.some((locale) =>
      localeHasCopy(existing[locale] as PlanLocaleCopy | undefined),
    );

    const draft = buildPlanLanguagesDraft({
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      featureList: plan.featureList,
      // If partial (e.g. name only), rebuild missing features from EN + suggestions
      translations: plan.translations,
    });

    // Always write full draft so features are never missing in DB
    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        translations: draft as unknown as Prisma.InputJsonValue,
      },
    });
    updated += 1;
    console.log(
      `${plan.slug}: ${hasAny ? "normalized" : "seeded"} →`,
      JSON.stringify(draft.ar?.monthly?.features ?? draft.ar?.features),
    );
  }

  console.log(`Done. Updated ${updated} plan(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
