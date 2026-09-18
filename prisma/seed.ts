import { hashPassword } from "../src/auth/password";
import { PLANS } from "../src/config/plans";
import { planDefaultFeatureKeys, type EntitlementFeatureKey } from "../src/domain/billing/entitlement-catalog";
import { PrismaClient } from "@prisma/client";
import { MERIDIAN_TEST_ORG } from "./seed-data/meridian-company";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

function profileCompleteness(profile: (typeof MERIDIAN_TEST_ORG)["profile"]): number {
  const checks = [
    !!profile.industry,
    !!profile.country,
    !!profile.companySize,
    profile.services.length > 0,
    !!profile.experienceLevel || profile.experienceYears != null,
    profile.certifications.length > 0,
    !!profile.revenueRange,
    !!profile.employeeRange,
    profile.geographicCoverage.length > 0,
    profile.contractSizeMin != null || profile.contractSizeMax != null,
    profile.customQualificationRules.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function envPassword(key: string, fallback: string) {
  return process.env[key]?.trim() || fallback;
}

async function seedMeridianCompany() {
  const org = MERIDIAN_TEST_ORG;
  const completeness = profileCompleteness(org.profile);
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const ownerHash = await hashPassword(
    envPassword(org.users.owner.passwordEnvKey, org.users.owner.defaultPassword),
  );
  const adminHash = await hashPassword(
    envPassword(org.users.admin.passwordEnvKey, org.users.admin.defaultPassword),
  );
  const memberHash = await hashPassword(
    envPassword(org.users.member.passwordEnvKey, org.users.member.defaultPassword),
  );

  const company = await prisma.company.create({
    data: {
      name: org.name,
      slug: org.slug,
      domain: org.domain,
      country: org.country,
      companySize: org.companySize,
      status: "ACTIVE",
      globalLearningConsent: true,
      profile: {
        create: {
          industry: org.profile.industry,
          country: org.profile.country,
          companySize: org.profile.companySize,
          experienceLevel: org.profile.experienceLevel,
          services: [...org.profile.services],
          certifications: [...org.profile.certifications],
          experienceYears: org.profile.experienceYears,
          revenueRange: org.profile.revenueRange,
          employeeRange: org.profile.employeeRange,
          geographicCoverage: [...org.profile.geographicCoverage],
          contractSizeMin: org.profile.contractSizeMin,
          contractSizeMax: org.profile.contractSizeMax,
          customQualificationRules: [...org.profile.customQualificationRules],
          completeness,
        },
      },
      usage: {
        create: {
          analysesUsed: 0,
          analysesLimit: PLANS.business.analysesLimit,
        },
      },
      subscription: {
        create: {
          plan: "BUSINESS",
          status: "ACTIVE",
          provider: "manual_admin",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      },
      users: {
        create: [
          {
            name: org.users.owner.name,
            email: org.users.owner.email,
            passwordHash: ownerHash,
            role: org.users.owner.role,
            emailVerified: true,
            onboardingStep: "DONE",
          },
          {
            name: org.users.admin.name,
            email: org.users.admin.email,
            passwordHash: adminHash,
            role: org.users.admin.role,
            emailVerified: true,
            onboardingStep: "DONE",
          },
          {
            name: org.users.member.name,
            email: org.users.member.email,
            passwordHash: memberHash,
            role: org.users.member.role,
            emailVerified: true,
            onboardingStep: "DONE",
          },
        ],
      },
      auditLogs: {
        create: {
          action: "COMPANY_CREATED",
          metadata: {
            note: "Primary internal production-quality test organization (fictional).",
            legalType: org.legalType,
            foundedYear: org.foundedYear,
            city: org.city,
            website: org.website,
          },
        },
      },
    },
  });

  // Persist sample company evidence files under local storage (production-compatible paths).
  const knowledgeRoot = path.join(
    process.env.STORAGE_ROOT ?? ".data/uploads",
    company.id,
    "company-knowledge",
  );
  await mkdir(knowledgeRoot, { recursive: true });
  for (const doc of org.sampleDocuments) {
    await writeFile(path.join(knowledgeRoot, doc.fileName), doc.body, "utf8");
  }

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      action: "PROFILE_UPDATED",
      metadata: {
        documentCount: org.sampleDocuments.length,
        historicalTenders: org.historicalTenders.length,
        storagePath: knowledgeRoot,
        completeness,
      },
    },
  });

  for (const [index, ht] of org.historicalTenders.entries()) {
    const analyzedAt = new Date();
    analyzedAt.setMonth(analyzedAt.getMonth() - (index + 1));
    const deadline = new Date(analyzedAt);
    deadline.setDate(deadline.getDate() + 21);

    const tender = await prisma.tender.create({
      data: {
        companyId: company.id,
        title: ht.title,
        client: ht.client,
        country: ht.country,
        region: ht.region,
        industry: ht.industry,
        estimatedValue: ht.estimatedValue,
        deadline,
        status: "ACTIVE",
        analysisStatus: "COMPLETED",
        analyzedAt,
        outcome: ht.outcome,
        outcomeRecordedAt: ht.outcome ? analyzedAt : null,
        decision: {
          create: {
            companyId: company.id,
            decision: ht.decision,
            fitScore: ht.fitScore,
            confidence: ht.confidence,
            reasoning: ht.reasoning,
            isAiSuggested: true,
          },
        },
        requirements: {
          create: Array.from({ length: Math.max(3, ht.missingMandatory + 2) }, (_, i) => ({
            category: i < ht.missingMandatory ? "CERTIFICATION" : "CAPABILITY",
            description:
              i < ht.missingMandatory
                ? `Mandatory certification gap item ${i + 1} (fictional test requirement)`
                : `Capability requirement ${i + 1} aligned to FM services (fictional)`,
            mandatory: true,
            status: i < ht.missingMandatory ? "MISSING" : "MATCHED",
            sortOrder: i,
          })),
        },
      },
    });

    if (ht.outcome) {
      const { recordTenderOutcome } = await import("../src/services/learning");
      await recordTenderOutcome({
        tenderId: tender.id,
        companyId: company.id,
        outcome: ht.outcome,
      });
    }
  }

  return company;
}

async function main() {
  await prisma.session.deleteMany({});
  await prisma.emailVerificationToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.adminAuditLog.deleteMany({});
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await prisma.aiUsageLog.deleteMany({});
  await prisma.aiModelAssignment.deleteMany({});
  await prisma.aiModel.deleteMany({});
  await prisma.aiProvider.deleteMany({});
  await prisma.companyFeatureOverride.deleteMany({});
  await prisma.planFeature.deleteMany({});
  await prisma.companyPlanOverride.deleteMany({});
  await prisma.feature.deleteMany({});
  await prisma.subscriptionEvent.deleteMany({});
  await prisma.billingPayment.deleteMany({});
  await prisma.billingInvoice.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.usageRecord.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.nextAction.deleteMany({});
  await prisma.missingDocument.deleteMany({});
  await prisma.tenderEvidence.deleteMany({});
  await prisma.tenderRisk.deleteMany({});
  await prisma.tenderRequirement.deleteMany({});
  await prisma.learningContribution.deleteMany({});
  await prisma.aggregatedLearningPattern.deleteMany({});
  await prisma.tenderDecision.deleteMany({});
  await prisma.tenderDocument.deleteMany({});
  await prisma.tender.deleteMany({});
  await prisma.trialRiskSignal.deleteMany({});
  await prisma.companyUsage.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.companyProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});

  const company = await seedMeridianCompany();

  // Limited trial sandbox for paywall flow testing (separate org — not Meridian)
  const trialHash = await hashPassword("BidveraTrial1!");
  await prisma.company.create({
    data: {
      name: "Trial Sandbox Ltd",
      slug: "trial-sandbox",
      domain: "example.com",
      profile: { create: { completeness: 20 } },
      usage: {
        create: {
          analysesUsed: 0,
          analysesLimit: PLANS.trial.analysesLimit,
        },
      },
      subscription: {
        create: {
          plan: "TRIAL",
          status: "TRIALING",
          provider: "manual_admin",
          currentPeriodStart: new Date(),
        },
      },
      users: {
        create: {
          name: "Trial User",
          email: "trial@bidvera.com",
          passwordHash: trialHash,
          role: "OWNER",
          emailVerified: true,
          onboardingStep: "DONE",
        },
      },
    },
  });

  console.log("Seeded primary test company:", company.slug, company.name);
  console.log("MERIDIAN LOGIN (Owner)");
  console.log("  Email:   ", MERIDIAN_TEST_ORG.users.owner.email);
  console.log(
    "  Password:",
    envPassword(
      MERIDIAN_TEST_ORG.users.owner.passwordEnvKey,
      MERIDIAN_TEST_ORG.users.owner.defaultPassword,
    ),
  );
  console.log("MERIDIAN LOGIN (Admin)");
  console.log("  Email:   ", MERIDIAN_TEST_ORG.users.admin.email);
  console.log("MERIDIAN LOGIN (Member)");
  console.log("  Email:   ", MERIDIAN_TEST_ORG.users.member.email);
  console.log("  Plan:     BUSINESS · ACTIVE ·", PLANS.business.analysesLimit, "analyses");
  console.log("Trial sandbox: trial@bidvera.com / BidveraTrial1!");

  // ── Super Admin platform seed ──────────────────────────────────────────────
  const { FEATURE_KEYS } = await import("../src/services/entitlements");
  const { ensureDefaultSettings } = await import("../src/services/settings");

  const { resolveSeedSuperAdminEmail, resolveSeedSuperAdminPassword } = await import(
    "../src/application/admin/seed-super-admin-password"
  );
  const { syncSuperAdminFromEnv } = await import("../src/application/admin/auth-service");
  // Resolve first so missing env fails closed before any DB write.
  resolveSeedSuperAdminEmail();
  resolveSeedSuperAdminPassword();
  await syncSuperAdminFromEnv();

  await ensureDefaultSettings();

  for (const key of FEATURE_KEYS) {
    await prisma.feature.upsert({
      where: { key },
      create: {
        key,
        name: key
          .split("_")
          .map((w) => w[0]!.toUpperCase() + w.slice(1))
          .join(" "),
        enabledGlobal: true,
      },
      update: {},
    });
  }

  const planDefs = [
    {
      slug: "free",
      name: "Free Workspace",
      monthlyPriceCents: 0,
      analysesLimit: 0,
      seatsLimit: 1,
      aiTokensLimit: 0,
      trialEligible: false,
      isFree: true,
      visibleToPublic: false,
      legacyEnum: "FREE" as const,
      featureList: PLANS.free.features,
    },
    {
      slug: "trial",
      name: "Trial",
      monthlyPriceCents: 0,
      analysesLimit: 3,
      seatsLimit: 1,
      trialEligible: true,
      visibleToPublic: false,
      legacyEnum: "TRIAL" as const,
      featureList: PLANS.trial.features,
    },
    {
      slug: "starter",
      name: "Starter",
      monthlyPriceCents: 1900,
      annualPriceCents: 19000,
      analysesLimit: 20,
      seatsLimit: 2,
      trialEligible: true,
      trialDays: 14,
      legacyEnum: "STARTER" as const,
      featureList: PLANS.starter.features,
    },
    {
      slug: "pro",
      name: "Pro",
      monthlyPriceCents: 4900,
      annualPriceCents: 49000,
      analysesLimit: 75,
      seatsLimit: 5,
      trialEligible: true,
      trialDays: 14,
      highlighted: true,
      legacyEnum: "PRO" as const,
      featureList: PLANS.pro.features,
    },
    {
      slug: "business",
      name: "Business",
      monthlyPriceCents: 9900,
      annualPriceCents: 99000,
      analysesLimit: 250,
      seatsLimit: 15,
      trialEligible: true,
      trialDays: 14,
      legacyEnum: "BUSINESS" as const,
      featureList: PLANS.business.features,
    },
  ];

  for (const [i, p] of planDefs.entries()) {
    const plan = await prisma.plan.create({
      data: {
        slug: p.slug,
        name: p.name,
        monthlyPriceCents: p.monthlyPriceCents,
        annualPriceCents: "annualPriceCents" in p ? p.annualPriceCents : null,
        analysesLimit: p.analysesLimit,
        seatsLimit: p.seatsLimit,
        trialEligible: "trialEligible" in p ? Boolean(p.trialEligible) : false,
        trialDays: "trialDays" in p ? p.trialDays : null,
        aiTokensLimit: "aiTokensLimit" in p ? p.aiTokensLimit : null,
        isFree: "isFree" in p ? Boolean(p.isFree) : false,
        visibleToPublic: "visibleToPublic" in p ? Boolean(p.visibleToPublic) : true,
        highlighted: "highlighted" in p ? Boolean(p.highlighted) : false,
        legacyEnum: p.legacyEnum,
        featureList: p.featureList,
        status: "ACTIVE",
        sortOrder: i,
      },
    });
    const features = await prisma.feature.findMany();
    const enabledKeys = new Set(planDefaultFeatureKeys(p.slug));
    for (const f of features) {
      const key = (f.key === "alerts" ? "smart_alerts" : f.key) as EntitlementFeatureKey;
      await prisma.planFeature.create({
        data: {
          planId: plan.id,
          featureId: f.id,
          enabled: enabledKeys.has(key) || (f.key === "alerts" && enabledKeys.has("smart_alerts")),
        },
      });
    }
    await prisma.subscription.updateMany({
      where: { plan: p.legacyEnum },
      data: { planId: plan.id },
    });
  }

  const provider = await prisma.aiProvider.create({
    data: {
      key: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnvVar: "OPENAI_API_KEY",
      active: true,
    },
  });
  await prisma.aiProvider.create({
    data: {
      key: "anthropic",
      name: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com",
      apiKeyEnvVar: "ANTHROPIC_API_KEY",
      active: false,
    },
  });
  await prisma.aiProvider.create({
    data: {
      key: "google",
      name: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKeyEnvVar: "GOOGLE_AI_API_KEY",
      active: false,
    },
  });
  const luna = await prisma.aiModel.create({
    data: {
      providerId: provider.id,
      name: process.env.AI_MODEL_EXTRACTION ?? "gpt-5.6-luna",
      version: "5.6",
      latestVersion: "5.6",
      displayName: "Luna (extraction)",
      active: true,
      isDefault: true,
      temperature: 0.1,
      inputCostPer1k: 0.002,
      outputCostPer1k: 0.008,
    },
  });
  const sol = await prisma.aiModel.create({
    data: {
      providerId: provider.id,
      name: process.env.AI_MODEL_REASONING ?? "gpt-5.6-sol",
      version: "5.6",
      latestVersion: "5.6",
      displayName: "Sol (reasoning)",
      active: true,
      temperature: 0.2,
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
    },
  });
  const terra = await prisma.aiModel.create({
    data: {
      providerId: provider.id,
      name: "gpt-5.6-terra",
      version: "5.6",
      latestVersion: "5.6",
      displayName: "Terra (balanced)",
      active: true,
      temperature: 0.15,
      inputCostPer1k: 0.005,
      outputCostPer1k: 0.015,
      notes: "Mid-tier fallback between Luna and Sol",
    },
  });

  const assignments: Array<{
    task:
      | "PDF_EXTRACTION"
      | "REQUIREMENT_EXTRACTION"
      | "CLASSIFICATION"
      | "COMPANY_MATCHING"
      | "RISK_ANALYSIS"
      | "FINAL_REASONING";
    modelId: string;
    fallbackModelId: string;
  }> = [
    { task: "PDF_EXTRACTION", modelId: luna.id, fallbackModelId: terra.id },
    { task: "REQUIREMENT_EXTRACTION", modelId: luna.id, fallbackModelId: terra.id },
    { task: "CLASSIFICATION", modelId: luna.id, fallbackModelId: terra.id },
    { task: "COMPANY_MATCHING", modelId: luna.id, fallbackModelId: terra.id },
    { task: "RISK_ANALYSIS", modelId: sol.id, fallbackModelId: terra.id },
    { task: "FINAL_REASONING", modelId: sol.id, fallbackModelId: terra.id },
  ];
  for (const a of assignments) {
    await prisma.aiModelAssignment.create({ data: { ...a, active: true, priority: 100 } });
  }

  console.log("SUPER ADMIN LOGIN");
  console.log("  Path:    /" + (process.env.SUPER_ADMIN_PATH ?? "(set SUPER_ADMIN_PATH)"));
  console.log("  Email:   (from SUPER_ADMIN_EMAIL)");
  console.log("  Password: (from SUPER_ADMIN_PASSWORD)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
