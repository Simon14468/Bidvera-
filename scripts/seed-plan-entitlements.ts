/**
 * Idempotent: sync plan entitlements + commercial honesty for live DB.
 * - PlanFeature rows match planDefaultFeatureKeys (stubs disabled)
 * - Feature globals for shipped Pro capabilities turned ON
 * - Unshipped stub Feature rows left in catalog but PlanFeature disabled
 * - Plan.featureList refreshed from honest marketing labels
 */
import { prisma } from "../src/lib/db";
import {
  ENTITLEMENT_CATALOG,
  UNSHIPPED_ENTITLEMENT_KEYS,
  buildEntitlementMarketingLabels,
  planDefaultFeatureKeys,
} from "../src/domain/billing/entitlement-catalog";
import { setPlanFeature } from "../src/services/entitlements";

/** Shipped capabilities that must not stay globally OFF while sold on plans. */
const SHIPPED_MUST_BE_GLOBALLY_ON = [
  "advanced_decision_engine",
  "decision_memory",
  "decision_simulator",
] as const;

async function main() {
  for (const def of ENTITLEMENT_CATALOG) {
    const createGlobal = !UNSHIPPED_ENTITLEMENT_KEYS.includes(
      def.key as (typeof UNSHIPPED_ENTITLEMENT_KEYS)[number],
    );
    await prisma.feature.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        enabledGlobal: createGlobal,
      },
      update: {
        name: def.name,
        description: def.description,
        ...(createGlobal ? {} : { enabledGlobal: false }),
      },
    });
  }

  for (const key of SHIPPED_MUST_BE_GLOBALLY_ON) {
    await prisma.feature.update({
      where: { key },
      data: { enabledGlobal: true },
    });
  }
  const plans = await prisma.plan.findMany({
    include: { planFeatures: { include: { feature: true } } },
  });

  for (const plan of plans) {
    const keys = planDefaultFeatureKeys(plan.slug);
    const keySet = new Set(keys);
    for (const def of ENTITLEMENT_CATALOG) {
      if (def.key === "alerts") {
        await setPlanFeature(plan.id, def.key, keySet.has("smart_alerts"));
        continue;
      }
      await setPlanFeature(plan.id, def.key, keySet.has(def.key));
    }

    const labels = buildEntitlementMarketingLabels({
      analysesLimit: plan.analysesLimit,
      seatsLimit: plan.seatsLimit,
      enabledKeys: keys,
    }).labels;

    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        preferEntitlementLabels: true,
        featureList: labels,
      },
    });

    console.log(`${plan.slug}: ${keys.join(", ")}`);
    console.log(`  featureList: ${labels.join(" | ")}`);
  }

  const globals = await prisma.feature.findMany({
    where: {
      key: {
        in: [
          ...SHIPPED_MUST_BE_GLOBALLY_ON,
          ...UNSHIPPED_ENTITLEMENT_KEYS,
          "document_compliance",
          "supplier_qualification",
          "tender_calendar",
          "tender_analysis",
        ],
      },
    },
    select: { key: true, enabledGlobal: true },
    orderBy: { key: "asc" },
  });
  console.log("globals:", JSON.stringify(globals, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
