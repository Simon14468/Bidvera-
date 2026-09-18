import {
  aiAssignmentSchema,
  aiModelToggleSchema,
  aiModelUpsertSchema,
  aiProviderKeySchema,
  aiProviderToggleSchema,
  aiSwitchVersionSchema,
  aiTestModelSchema,
  featureToggleSchema,
  systemSettingSchema,
} from "@/domain/schemas/admin";
import { AI_PROVIDER_OPTIONS, getProviderOption } from "@/config/ai-providers";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  setCompanyFeature,
  setFeatureGlobal,
  setPlanFeature,
  listFeatures,
} from "@/services/entitlements";
import { listKnownProviders, testProviderModelConnection } from "@/services/ai/providers";
import {
  clearProviderApiKey,
  saveProviderApiKey,
} from "@/services/ai/provider-keys";
import { listPublicSettings, setSetting } from "@/services/settings";
import type { SuperAdminContext } from "@/auth/super-admin-session";

const DEFAULT_PROVIDER_MODELS: Record<
  "openai" | "anthropic" | "google",
  { name: string; displayName: string }
> = {
  openai: { name: "gpt-4o-mini", displayName: "GPT-4o mini (default)" },
  anthropic: {
    name: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet (default)",
  },
  google: { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash (default)" },
};

export async function listAiCatalog() {
  await ensureDefaultProviders();
  await ensureDefaultModels();
  const [providers, models, assignments, known] = await Promise.all([
    prisma.aiProvider.findMany({ orderBy: { key: "asc" } }),
    prisma.aiModel.findMany({
      include: {
        provider: true,
        versionHistory: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
    }),
    prisma.aiModelAssignment.findMany({
      include: {
        model: { include: { provider: true } },
        fallbackModel: { include: { provider: true } },
      },
    }),
    listKnownProviders(),
  ]);
  return { providers, models, assignments, knownProviders: known };
}

async function ensureDefaultProviders() {
  for (const p of AI_PROVIDER_OPTIONS) {
    await prisma.aiProvider.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        name: p.name,
        baseUrl: p.defaultBaseUrl,
        apiKeyEnvVar: p.apiKeyEnvVar,
        active: p.key === "openai",
      },
      update: {
        name: p.name,
        apiKeyEnvVar: p.apiKeyEnvVar,
        baseUrl: p.defaultBaseUrl,
      },
    });
  }
}

/** Ensure each provider has at least one active model for Assign / Test. */
async function ensureDefaultModels() {
  for (const option of AI_PROVIDER_OPTIONS) {
    const provider = await prisma.aiProvider.findUnique({ where: { key: option.key } });
    if (!provider) continue;
    const count = await prisma.aiModel.count({ where: { providerId: provider.id } });
    if (count > 0) continue;
    const defaults = DEFAULT_PROVIDER_MODELS[option.key];
    await prisma.aiModel.create({
      data: {
        providerId: provider.id,
        name: defaults.name,
        displayName: defaults.displayName,
        active: true,
        isDefault: true,
        temperature: 0.2,
        notes: "Auto-created default for Super Admin setup",
      },
    });
  }
}

export async function upsertAiModel(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiModelUpsertSchema.parse(raw);
  const option = getProviderOption(data.providerKey);
  const provider = await prisma.aiProvider.upsert({
    where: { key: data.providerKey },
    create: {
      key: data.providerKey,
      name: option?.name ?? data.providerKey,
      baseUrl: option?.defaultBaseUrl ?? null,
      apiKeyEnvVar: option?.apiKeyEnvVar ?? null,
      active: true,
    },
    update: {
      name: option?.name ?? data.providerKey,
      apiKeyEnvVar: option?.apiKeyEnvVar ?? undefined,
    },
  });

  const previous = data.id
    ? await prisma.aiModel.findUnique({ where: { id: data.id } })
    : null;

  if (data.isDefault) {
    await prisma.aiModel.updateMany({
      where: { providerId: provider.id },
      data: { isDefault: false },
    });
  }

  const versionChanged = Boolean(
    previous && data.version && previous.version && data.version !== previous.version,
  );

  const model = data.id
    ? await prisma.aiModel.update({
        where: { id: data.id },
        data: {
          name: data.name,
          version: data.version ?? null,
          latestVersion: data.latestVersion ?? data.version ?? null,
          previousVersion: versionChanged ? previous!.version : previous?.previousVersion,
          displayName: data.displayName,
          active: data.active,
          isDefault: data.isDefault,
          maxTokens: data.maxTokens ?? null,
          temperature: data.temperature ?? null,
          inputCostPer1k: data.inputCostPer1k ?? null,
          outputCostPer1k: data.outputCostPer1k ?? null,
          notes: data.notes ?? null,
        },
      })
    : await prisma.aiModel.create({
        data: {
          providerId: provider.id,
          name: data.name,
          version: data.version ?? null,
          latestVersion: data.latestVersion ?? data.version ?? null,
          displayName: data.displayName,
          active: data.active,
          isDefault: data.isDefault,
          maxTokens: data.maxTokens ?? null,
          temperature: data.temperature ?? null,
          inputCostPer1k: data.inputCostPer1k ?? null,
          outputCostPer1k: data.outputCostPer1k ?? null,
          notes: data.notes ?? null,
        },
      });

  if (versionChanged && data.version) {
    await prisma.aiModelVersionHistory.create({
      data: {
        modelId: model.id,
        version: data.version,
        note: "Version switched via Super Admin",
        changedBy: ctx.admin.id,
      },
    });
  }

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: previous ? "AI_MODEL_UPDATED" : "AI_MODEL_CREATED",
    targetType: "ai_model",
    targetId: model.id,
    previousValue: previous
      ? { name: previous.name, version: previous.version, active: previous.active }
      : undefined,
    newValue: {
      name: model.name,
      version: model.version,
      active: model.active,
      provider: data.providerKey,
    },
    ipHash,
  });

  return model;
}

export async function toggleAiProvider(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiProviderToggleSchema.parse(raw);
  await ensureDefaultProviders();
  const provider = await prisma.aiProvider.update({
    where: { key: data.providerKey },
    data: { active: data.active },
  });
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: data.active ? "AI_PROVIDER_ENABLED" : "AI_PROVIDER_DISABLED",
    targetType: "ai_provider",
    targetId: provider.id,
    newValue: { key: data.providerKey, active: data.active },
    ipHash,
  });
  return provider;
}

export async function saveAiProviderKey(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiProviderKeySchema.parse(raw);
  await ensureDefaultProviders();
  await ensureDefaultModels();

  if (data.clear) {
    await clearProviderApiKey(data.providerKey);
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "AI_PROVIDER_KEY_CLEARED",
      targetType: "ai_provider",
      targetId: data.providerKey,
      ipHash,
    });
    return { providerKey: data.providerKey, configured: false, cleared: true };
  }

  const apiKey = (data.apiKey ?? "").trim();
  if (!apiKey) {
    throw new AppError(ErrorCode.VALIDATION, "API key is required.", 400);
  }

  await saveProviderApiKey(data.providerKey, apiKey);

  // Enable provider so assignments and tender analysis can use it immediately.
  const provider = await prisma.aiProvider.update({
    where: { key: data.providerKey },
    data: { active: true },
  });

  const defaultModel =
    (await prisma.aiModel.findFirst({
      where: { providerId: provider.id, isDefault: true, active: true },
    })) ??
    (await prisma.aiModel.findFirst({
      where: { providerId: provider.id, active: true },
      orderBy: { createdAt: "asc" },
    }));

  let assignedTasks = 0;
  if (defaultModel) {
    const existing = await prisma.aiModelAssignment.count();
    if (existing === 0) {
      const tasks = [
        "PDF_EXTRACTION",
        "REQUIREMENT_EXTRACTION",
        "CLASSIFICATION",
        "COMPANY_MATCHING",
        "RISK_ANALYSIS",
        "FINAL_REASONING",
      ] as const;
      for (const task of tasks) {
        await prisma.aiModelAssignment.upsert({
          where: { task },
          create: {
            task,
            modelId: defaultModel.id,
            active: true,
            priority: 100,
          },
          update: {
            modelId: defaultModel.id,
            active: true,
          },
        });
        assignedTasks += 1;
      }
    }
  }

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "AI_PROVIDER_KEY_SAVED",
    targetType: "ai_provider",
    targetId: provider.id,
    newValue: {
      key: data.providerKey,
      active: true,
      hasKey: true,
      assignedTasks,
    },
    ipHash,
  });

  return {
    providerKey: data.providerKey,
    configured: true,
    cleared: false,
    assignedTasks,
  };
}

export async function toggleAiModel(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiModelToggleSchema.parse(raw);
  const model = await prisma.aiModel.update({
    where: { id: data.modelId },
    data: { active: data.active },
  });
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: data.active ? "AI_MODEL_ACTIVATED" : "AI_MODEL_DEACTIVATED",
    targetType: "ai_model",
    targetId: model.id,
    newValue: { active: data.active },
    ipHash,
  });
  return model;
}

export async function switchAiModelVersion(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiSwitchVersionSchema.parse(raw);
  const model = await prisma.aiModel.findUnique({ where: { id: data.modelId } });
  if (!model) throw new AppError(ErrorCode.NOT_FOUND, "Model not found.", 404);

  const updated = await prisma.aiModel.update({
    where: { id: data.modelId },
    data: {
      previousVersion: model.version,
      version: data.version,
      latestVersion: model.latestVersion ?? data.version,
    },
  });

  await prisma.aiModelVersionHistory.create({
    data: {
      modelId: model.id,
      version: data.version,
      note: data.note ?? "Manual version switch",
      changedBy: ctx.admin.id,
    },
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "AI_MODEL_VERSION_SWITCHED",
    targetType: "ai_model",
    targetId: model.id,
    previousValue: { version: model.version },
    newValue: { version: data.version },
    ipHash,
  });

  return updated;
}

export async function rollbackAiModelVersion(
  ctx: SuperAdminContext,
  modelId: string,
  ipHash?: string | null,
) {
  const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
  if (!model) throw new AppError(ErrorCode.NOT_FOUND, "Model not found.", 404);
  if (!model.previousVersion) {
    throw new AppError(ErrorCode.VALIDATION, "No previous version to roll back to.", 400);
  }

  const updated = await prisma.aiModel.update({
    where: { id: modelId },
    data: {
      previousVersion: model.version,
      version: model.previousVersion,
    },
  });

  await prisma.aiModelVersionHistory.create({
    data: {
      modelId,
      version: model.previousVersion,
      note: "Rollback",
      changedBy: ctx.admin.id,
    },
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "AI_MODEL_VERSION_ROLLBACK",
    targetType: "ai_model",
    targetId: modelId,
    previousValue: { version: model.version },
    newValue: { version: model.previousVersion },
    ipHash,
  });

  return updated;
}

export async function assignAiModel(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiAssignmentSchema.parse(raw);
  const model = await prisma.aiModel.findUnique({
    where: { id: data.modelId },
    include: { provider: true },
  });
  if (!model || !model.active) {
    throw new AppError(ErrorCode.VALIDATION, "Active model required.", 400);
  }
  if (!model.provider.active) {
    throw new AppError(ErrorCode.VALIDATION, "Provider is disabled.", 400);
  }

  const previous = await prisma.aiModelAssignment.findUnique({
    where: { task: data.task },
  });

  const row = await prisma.aiModelAssignment.upsert({
    where: { task: data.task },
    create: {
      task: data.task,
      modelId: data.modelId,
      fallbackModelId: data.fallbackModelId ?? null,
      active: data.active,
      priority: data.priority,
    },
    update: {
      modelId: data.modelId,
      fallbackModelId: data.fallbackModelId ?? null,
      active: data.active,
      priority: data.priority,
    },
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "AI_MODEL_ASSIGNED",
    targetType: "ai_assignment",
    targetId: data.task,
    previousValue: previous
      ? { modelId: previous.modelId, fallbackModelId: previous.fallbackModelId }
      : undefined,
    newValue: {
      modelId: row.modelId,
      fallbackModelId: row.fallbackModelId,
    },
    ipHash,
  });

  return row;
}

export async function testAiModelConnection(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = aiTestModelSchema.parse(raw);
  let providerKey = data.providerKey;
  let modelName = data.modelName;
  let baseUrl: string | null = null;
  let apiKeyEnvVar: string | null = null;

  if (data.modelId) {
    const model = await prisma.aiModel.findUnique({
      where: { id: data.modelId },
      include: { provider: true },
    });
    if (!model) throw new AppError(ErrorCode.NOT_FOUND, "Model not found.", 404);
    providerKey = model.provider.key as "openai" | "anthropic" | "google";
    modelName = model.name;
    baseUrl = model.provider.baseUrl;
    apiKeyEnvVar = model.provider.apiKeyEnvVar;
  }

  if (!providerKey || !modelName) {
    throw new AppError(ErrorCode.VALIDATION, "providerKey and modelName required.", 400);
  }

  const result = await testProviderModelConnection({
    providerKey,
    baseUrl,
    apiKeyEnvVar,
    model: modelName,
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "AI_MODEL_TESTED",
    targetType: "ai_model",
    targetId: data.modelId ?? modelName,
    newValue: result as never,
    ipHash,
  });

  return result;
}

export async function toggleFeatureForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = featureToggleSchema.parse(raw);
  let result: unknown;
  if (data.scope === "GLOBAL") {
    result = await setFeatureGlobal(data.featureKey, data.enabled);
  } else if (data.scope === "PLAN") {
    if (!data.planId) throw new AppError(ErrorCode.VALIDATION, "planId required", 400);
    result = await setPlanFeature(data.planId, data.featureKey, data.enabled);
  } else {
    if (!data.companyId) {
      throw new AppError(ErrorCode.VALIDATION, "companyId required", 400);
    }
    result = await setCompanyFeature(data.companyId, data.featureKey, data.enabled);
  }

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "FEATURE_TOGGLED",
    targetType: "feature",
    targetId: data.featureKey,
    newValue: data as never,
    ipHash,
  });

  return result;
}

export { listFeatures };

export async function updateSystemSettingForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = systemSettingSchema.parse(raw);
  const previous = await prisma.systemSetting.findUnique({ where: { key: data.key } });
  const row = await setSetting(data.key, data.value, data.description);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "SYSTEM_SETTING_UPDATED",
    targetType: "system_setting",
    targetId: data.key,
    previousValue: previous?.value as never,
    newValue: data.value as never,
    ipHash,
  });
  return row;
}

export { listPublicSettings };

export async function listAdminAuditLogs(take = 100) {
  return prisma.adminAuditLog.findMany({
    include: {
      adminUser: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}
