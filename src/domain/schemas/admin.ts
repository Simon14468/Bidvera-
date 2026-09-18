import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const adminReauthSchema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal(true),
});

export const planUpsertSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  monthlyPriceCents: z.number().int().min(0).max(10_000_000),
  annualPriceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  annualMonths: z.number().int().min(1).max(36).default(12),
  monthlyEnabled: z.boolean().default(true),
  annualEnabled: z.boolean().default(true),
  analysesLimit: z.number().int().min(0).max(1_000_000),
  analysesLimitYearly: z.number().int().min(0).max(1_000_000).optional().nullable(),
  aiTokensLimit: z.number().int().min(0).optional().nullable(),
  storageMbLimit: z.number().int().min(0).optional().nullable(),
  seatsLimit: z.number().int().min(1).max(10_000),
  seatsLimitYearly: z.number().int().min(1).max(10_000).optional().nullable(),
  trialEligible: z.boolean().default(false),
  trialDays: z.number().int().min(0).max(365).optional().nullable(),
  /** Per-plan payment-failure grace; null = use global billing.graceDays */
  graceDays: z.number().int().min(0).max(90).optional().nullable(),
  isFree: z.boolean().optional(),
  visibleToPublic: z.boolean().optional(),
  stripeEnabled: z.boolean().optional(),
  paypalEnabled: z.boolean().optional(),
  stripePriceMonthly: z.string().max(200).optional().nullable(),
  stripePriceAnnual: z.string().max(200).optional().nullable(),
  paypalPlanMonthly: z.string().max(200).optional().nullable(),
  paypalPlanAnnual: z.string().max(200).optional().nullable(),
  currency: z.string().min(3).max(8).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  highlighted: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  /** Display-only extras (not entitlements). Marked as such in Admin. */
  featureList: z.array(z.string().max(200)).max(50).default([]),
  preferEntitlementLabels: z.boolean().optional().default(true),
  /** Structured entitlement feature keys enabled for this plan */
  featureKeys: z.array(z.string().max(80)).max(50).default([]),
  legacyEnum: z.enum(["TRIAL", "STARTER", "PRO", "BUSINESS"]).optional().nullable(),
  translations: z
    .record(
      z.string(),
      z.object({
        name: z.string().max(120).optional(),
        description: z.string().max(2000).optional().nullable(),
        features: z.array(z.string().max(200)).max(50).optional(),
        monthly: z
          .object({
            name: z.string().max(120).optional(),
            description: z.string().max(2000).optional().nullable(),
            features: z.array(z.string().max(200)).max(50).optional(),
          })
          .optional(),
        yearly: z
          .object({
            name: z.string().max(120).optional(),
            description: z.string().max(2000).optional().nullable(),
            features: z.array(z.string().max(200)).max(50).optional(),
          })
          .optional(),
      }),
    )
    .optional()
    .nullable(),
});

export const billingGatewayAdminSchema = z.object({
  stripeEnabled: z.boolean(),
  paypalEnabled: z.boolean(),
  defaultGateway: z.enum(["stripe", "paypal"]),
  trialEnabled: z.boolean(),
  trialDays: z.number().int().min(0).max(365),
  freeWorkspaceEnabled: z.boolean().default(true),
  requirePaymentMethodForTrial: z.boolean().default(true),
  graceDays: z.number().int().min(0).max(90).default(3),
  cancelSubsOnPlanDisable: z.boolean(),
  cancelSubsOnGatewayDisable: z.boolean(),
});

export const planStatusSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

export const planTranslationsUpdateSchema = z.object({
  planId: z.string().min(1),
  translations: z
    .record(
      z.string(),
      z.object({
        name: z.string().max(120).optional(),
        description: z.string().max(2000).optional().nullable(),
        features: z.array(z.string().max(200)).max(50).optional(),
        monthly: z
          .object({
            name: z.string().max(120).optional(),
            description: z.string().max(2000).optional().nullable(),
            features: z.array(z.string().max(200)).max(50).optional(),
          })
          .optional(),
        yearly: z
          .object({
            name: z.string().max(120).optional(),
            description: z.string().max(2000).optional().nullable(),
            features: z.array(z.string().max(200)).max(50).optional(),
          })
          .optional(),
      }),
    )
    .nullable(),
});

export const companyOverrideSchema = z.object({
  companyId: z.string().min(1),
  planId: z.string().optional().nullable(),
  customName: z.string().max(120).optional().nullable(),
  monthlyPriceCents: z.number().int().min(0).optional().nullable(),
  analysesLimit: z.number().int().min(0).optional().nullable(),
  aiTokensLimit: z.number().int().min(0).optional().nullable(),
  storageMbLimit: z.number().int().min(0).optional().nullable(),
  seatsLimit: z.number().int().min(1).optional().nullable(),
  features: z.array(z.string().max(200)).max(50).default([]),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  active: z.boolean().default(true),
});

export const featureToggleSchema = z.object({
  featureKey: z.string().min(1).max(80),
  enabled: z.boolean(),
  scope: z.enum(["GLOBAL", "PLAN", "COMPANY"]),
  planId: z.string().optional(),
  companyId: z.string().optional(),
});

export const aiModelUpsertSchema = z.object({
  id: z.string().optional(),
  providerKey: z.enum(["openai", "anthropic", "google"]),
  name: z.string().min(1).max(120),
  version: z.string().max(64).optional().nullable(),
  latestVersion: z.string().max(64).optional().nullable(),
  displayName: z.string().min(1).max(160),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  maxTokens: z.number().int().min(1).optional().nullable(),
  temperature: z.number().min(0).max(2).optional().nullable(),
  inputCostPer1k: z.number().min(0).optional().nullable(),
  outputCostPer1k: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const aiAssignmentSchema = z.object({
  task: z.enum([
    "PDF_EXTRACTION",
    "REQUIREMENT_EXTRACTION",
    "CLASSIFICATION",
    "COMPANY_MATCHING",
    "RISK_ANALYSIS",
    "FINAL_REASONING",
  ]),
  modelId: z.string().min(1),
  fallbackModelId: z.string().optional().nullable(),
  active: z.boolean().default(true),
  priority: z.number().int().default(100),
});

export const aiProviderToggleSchema = z.object({
  providerKey: z.enum(["openai", "anthropic", "google"]),
  active: z.boolean(),
});

export const aiProviderKeySchema = z.object({
  providerKey: z.enum(["openai", "anthropic", "google"]),
  apiKey: z.string().max(500).optional().nullable(),
  clear: z.boolean().optional().default(false),
});

export const aiModelToggleSchema = z.object({
  modelId: z.string().min(1),
  active: z.boolean(),
});

export const aiSwitchVersionSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1).max(64),
  note: z.string().max(500).optional().nullable(),
});

export const aiTestModelSchema = z.object({
  modelId: z.string().min(1).optional(),
  providerKey: z.enum(["openai", "anthropic", "google"]).optional(),
  modelName: z.string().min(1).max(120).optional(),
});

export const systemSettingSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
  description: z.string().max(500).optional().nullable(),
});

export const companyFilterSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["ALL", "ACTIVE", "SUSPENDED"]).default("ALL"),
  plan: z.string().optional(),
  subscriptionStatus: z.string().optional(),
});
