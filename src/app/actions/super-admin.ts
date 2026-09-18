"use server";

import {
  getCompanyMatchingReadinessForAdmin,
  rebuildMatchingProfileForAdmin,
} from "@/application/admin/matching-readiness";
import {
  getEmailSettingsForAdmin,
  saveEmailSettingsForAdmin,
  sendResendTestEmailForAdmin,
} from "@/application/admin/email-service";
import {
  getMatchingAiSettingsForAdmin,
  saveMatchingAiSettingsForAdmin,
  testMatchingAiConnectionForAdmin,
} from "@/application/admin/matching-ai-service";
import {
  getMatchingSponsorshipAdminSnapshot,
  saCreateMatchingSponsorship as createMatchingSponsorshipForAdmin,
  saSetMatchingSponsorshipGlobal as setMatchingSponsorshipGlobalForAdmin,
  saTransitionMatchingSponsorship as transitionMatchingSponsorshipForAdmin,
} from "@/application/admin/matching-sponsorship-service";
import {
  getMatchingSponsorshipPricingAdminSnapshot,
  saReorderMatchingSponsorshipPricingPlans as reorderMatchingSponsorshipPricingPlansForAdmin,
  saSetMatchingSponsorshipPricingPlanStatus as setMatchingSponsorshipPricingPlanStatusForAdmin,
  saUpsertMatchingSponsorshipPricingPlan as upsertMatchingSponsorshipPricingPlanForAdmin,
} from "@/application/admin/matching-sponsorship-pricing-service";
import {
  adminLoginAction,
  adminLogoutAction,
  confirmAdminPassword,
} from "@/application/admin/auth-service";
import {
  deleteCompanyForAdmin,
  getCompanyDetailForAdmin,
  listCompaniesForAdmin,
  setCompanySuspended,
  upsertCompanyPlanOverride,
} from "@/application/admin/company-service";
import {
  adminIssueCompanyUserPasswordReset,
  adminSetCompanySubscriptionPlan,
} from "@/application/admin/company-credentials";
import {
  deleteTestimonialForAdmin,
  listLandingVideosForAdmin,
  listTestimonialsForAdmin,
  reorderTestimonialsForAdmin,
  saveLandingUpload,
  setTestimonialEnabled,
  updateLandingVideoForAdmin,
  upsertTestimonialForAdmin,
} from "@/application/admin/landing-service";
import { getAiCostBreakdown, getPlatformOverview } from "@/application/admin/metrics-service";
import {
  archivePlan,
  listPlansForAdmin,
  listSubscriptionsForAdmin,
  setPlanStatusForAdmin,
  updatePlanTranslationsForAdmin,
  upsertPlanForAdmin,
} from "@/application/admin/plan-service";
import { updatePlanGatewaysForAdmin } from "@/application/admin/plan-gateway-service";
import {
  getPaymentsAdminDashboard,
  updateBillingGatewaySettingsForAdmin,
} from "@/application/admin/payments-service";
import {
  getBackupDashboardForAdmin,
  restoreTestBackupForAdmin,
  runBackupNowForAdmin,
  saveBackupSettingsForAdmin,
  verifyBackupForAdmin,
} from "@/application/admin/backup-service";
import {
  assignAiModel,
  listAdminAuditLogs,
  listAiCatalog,
  listFeatures,
  listPublicSettings,
  rollbackAiModelVersion,
  saveAiProviderKey,
  switchAiModelVersion,
  testAiModelConnection,
  toggleAiModel,
  toggleAiProvider,
  toggleFeatureForAdmin,
  updateSystemSettingForAdmin,
  upsertAiModel,
} from "@/application/admin/platform-service";
import {
  requestIpHash,
  requireFullSuperAdmin,
  requireSuperAdmin,
  requireWritableSuperAdmin,
} from "@/auth/super-admin-session";
import { toSafeClientError } from "@/lib/errors";
import { z } from "zod";

export async function saLogin(raw: unknown) {
  try {
    return { ok: true as const, data: await adminLoginAction(raw) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saLogout() {
  try {
    await adminLogoutAction();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetOverview() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await getPlatformOverview() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saListCompanies(filters?: unknown) {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listCompaniesForAdmin(filters) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetCompany(companyId: string) {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await getCompanyDetailForAdmin(companyId) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetMatchingReadiness(companyId: string) {
  try {
    await requireSuperAdmin();
    return {
      ok: true as const,
      data: await getCompanyMatchingReadinessForAdmin(companyId),
    };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

/** Explicit SA rebuild — existing rebuildMatchingProfileForCompany only. */
export async function saRebuildMatchingProfile(input: {
  companyId: string;
  password: string;
}) {
  try {
    const ctx = await requireWritableSuperAdmin();
    await confirmAdminPassword(ctx, {
      password: input.password,
      confirm: true,
    });
    const data = await rebuildMatchingProfileForAdmin(input.companyId);
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSuspendCompany(input: {
  companyId: string;
  suspend: boolean;
  reason?: string;
  password: string;
}) {
  try {
    const ctx = await requireWritableSuperAdmin();
    await confirmAdminPassword(ctx, { password: input.password, confirm: true });
    const data = await setCompanySuspended({
      ctx,
      companyId: input.companyId,
      suspend: input.suspend,
      reason: input.reason,
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saDeleteCompany(input: {
  companyId: string;
  confirmSlug: string;
  password: string;
}) {
  try {
    const ctx = await requireFullSuperAdmin();
    await confirmAdminPassword(ctx, { password: input.password, confirm: true });
    const data = await deleteCompanyForAdmin({
      ctx,
      companyId: input.companyId,
      confirmSlug: input.confirmSlug,
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpsertOverride(raw: unknown, password: string) {
  try {
    const ctx = await requireFullSuperAdmin();
    await confirmAdminPassword(ctx, { password, confirm: true });
    const data = await upsertCompanyPlanOverride(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saIssueCompanyUserPasswordReset(input: {
  companyId: string;
  userId: string;
  password: string;
}) {
  try {
    const ctx = await requireWritableSuperAdmin();
    await confirmAdminPassword(ctx, { password: input.password, confirm: true });
    const data = await adminIssueCompanyUserPasswordReset({
      ctx,
      companyId: input.companyId,
      userId: input.userId,
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSetCompanyPlan(input: {
  companyId: string;
  planId: "free" | "trial" | "starter" | "pro" | "business";
  status?:
    | "TRIALING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "INCOMPLETE"
    | "UNPAID"
    | "EXPIRED"
    | "PAYMENT_FAILED";
  password: string;
}) {
  try {
    const ctx = await requireWritableSuperAdmin();
    await confirmAdminPassword(ctx, { password: input.password, confirm: true });
    const data = await adminSetCompanySubscriptionPlan({
      ctx,
      companyId: input.companyId,
      planId: input.planId,
      status: input.status,
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saListPlans() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listPlansForAdmin() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpsertPlan(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await upsertPlanForAdmin(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpdatePlanTranslations(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await updatePlanTranslationsForAdmin(ctx, raw, await requestIpHash());
    return {
      ok: true as const,
      data: {
        id: data.id,
        translations: data.translations,
      },
    };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSetPlanStatus(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await setPlanStatusForAdmin(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saArchivePlan(planId: string, password: string) {
  try {
    const ctx = await requireFullSuperAdmin();
    await confirmAdminPassword(ctx, { password, confirm: true });
    const data = await archivePlan(ctx, planId, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saListSubscriptions() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listSubscriptionsForAdmin() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saListFeatures() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listFeatures() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saToggleFeature(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await toggleFeatureForAdmin(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saAiCatalog() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listAiCatalog() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpsertAiModel(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await upsertAiModel(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saAssignAiModel(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await assignAiModel(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saToggleAiProvider(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await toggleAiProvider(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveAiProviderKey(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await saveAiProviderKey(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saToggleAiModel(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await toggleAiModel(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSwitchAiVersion(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await switchAiModelVersion(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saRollbackAiVersion(modelId: string) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await rollbackAiModelVersion(ctx, modelId, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saTestAiModel(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await testAiModelConnection(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saAiCosts() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await getAiCostBreakdown() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saListSettings() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listPublicSettings() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpdateSetting(raw: unknown, password: string) {
  try {
    const ctx = await requireFullSuperAdmin();
    await confirmAdminPassword(ctx, { password, confirm: true });
    const data = await updateSystemSettingForAdmin(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saAuditLogs() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listAdminAuditLogs() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetLandingVideo() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listLandingVideosForAdmin() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpdateLandingVideo(raw: unknown) {
  try {
    await requireWritableSuperAdmin();
    return { ok: true as const, data: await updateLandingVideoForAdmin(raw) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUploadLandingAsset(formData: FormData) {
  try {
    await requireWritableSuperAdmin();
    const kind = String(formData.get("kind") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false as const, error: { message: "No file uploaded.", code: "VALIDATION" } };
    }
    if (kind !== "video" && kind !== "poster" && kind !== "avatar") {
      return { ok: false as const, error: { message: "Invalid upload kind.", code: "VALIDATION" } };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveLandingUpload({
      kind,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      body: buf,
    });
    return { ok: true as const, data: { url } };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saListTestimonials() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await listTestimonialsForAdmin() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpsertTestimonial(raw: unknown) {
  try {
    await requireWritableSuperAdmin();
    return { ok: true as const, data: await upsertTestimonialForAdmin(raw) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saDeleteTestimonial(id: string) {
  try {
    await requireWritableSuperAdmin();
    await deleteTestimonialForAdmin(id);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saToggleTestimonial(id: string, enabled: boolean) {
  try {
    await requireWritableSuperAdmin();
    return { ok: true as const, data: await setTestimonialEnabled(id, enabled) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saReorderTestimonials(raw: unknown) {
  try {
    await requireWritableSuperAdmin();
    return { ok: true as const, data: await reorderTestimonialsForAdmin(raw) };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveBillingGateways(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await updateBillingGatewaySettingsForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpdatePlanGateways(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await updatePlanGatewaysForAdmin(ctx, raw, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveAuthSettings(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const { saveAuthAdminConfig, getAuthAdminSnapshot, AUTH_SETTINGS_KEY } =
      await import("@/services/auth/settings");
    const { writeAdminAudit } = await import("@/services/admin/audit");
    const previous = await getAuthAdminSnapshot();
    const data = await saveAuthAdminConfig(raw);
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "AUTH_SETTINGS_UPDATED",
      targetType: "auth_settings",
      targetId: AUTH_SETTINGS_KEY,
      previousValue: {
        ...previous,
        hasGoogleClientSecret: previous.hasGoogleClientSecret,
        hasMicrosoftClientSecret: previous.hasMicrosoftClientSecret,
      },
      newValue: {
        registrationEnabled: data.registrationEnabled,
        requireEmailVerification: data.requireEmailVerification,
        googleEnabled: data.googleEnabled,
        googleClientId: data.googleClientId,
        hasGoogleClientSecret: data.hasGoogleClientSecret,
        microsoftEnabled: data.microsoftEnabled,
        microsoftClientId: data.microsoftClientId,
        hasMicrosoftClientSecret: data.hasMicrosoftClientSecret,
        mediumRiskTrialDelayHours: data.mediumRiskTrialDelayHours,
        mediumRiskRequireBusinessEmail: data.mediumRiskRequireBusinessEmail,
        highRiskBlockTrial: data.highRiskBlockTrial,
      },
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Invalid auth settings.",
          status: 400,
        },
      };
    }
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveAssistantKnowledge(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const {
      saveAssistantKnowledgeLocale,
      assistantKnowledgeLocaleSaveSchema,
      getAssistantKnowledge,
      ASSISTANT_KNOWLEDGE_KEY,
    } = await import("@/services/ai/assistant-knowledge");
    const { writeAdminAudit } = await import("@/services/admin/audit");
    const previous = await getAssistantKnowledge();
    const value = assistantKnowledgeLocaleSaveSchema.parse(raw);
    const data = await saveAssistantKnowledgeLocale(value);
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "ASSISTANT_KNOWLEDGE_UPDATED",
      targetType: "assistant_knowledge",
      targetId: ASSISTANT_KNOWLEDGE_KEY,
      previousValue: { locale: value.locale, text: previous.byLocale[value.locale] },
      newValue: { locale: value.locale, text: data.byLocale[value.locale] },
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveAssistantControl(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const { saveAssistantAdminConfig, ASSISTANT_SETTINGS_KEY } = await import(
      "@/services/ai/assistant-settings"
    );
    const { writeAdminAudit } = await import("@/services/admin/audit");
    const data = await saveAssistantAdminConfig(raw);
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "ASSISTANT_CONTROL_UPDATED",
      targetType: "assistant_settings",
      targetId: ASSISTANT_SETTINGS_KEY,
      newValue: {
        enabled: data.enabled,
        voiceEnabled: data.voiceEnabled,
        providerKey: data.providerKey,
        modelName: data.modelName,
        baseUrl: data.baseUrl,
        hasAssistantApiKey: data.hasAssistantApiKey,
        hasElevenLabsApiKey: data.hasElevenLabsApiKey,
      },
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Invalid assistant settings.",
          status: 400,
        },
      };
    }
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saTestAssistantConnection(raw: unknown) {
  try {
    await requireWritableSuperAdmin();
    const { testAssistantProviderConnection } = await import(
      "@/services/ai/assistant-settings"
    );
    const data = await testAssistantProviderConnection(raw);
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Invalid test settings.",
          status: 400,
        },
      };
    }
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saTestElevenLabsConnection(raw: unknown) {
  try {
    await requireWritableSuperAdmin();
    const { testElevenLabsConnection } = await import(
      "@/services/ai/assistant-settings"
    );
    const data = await testElevenLabsConnection(raw);
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Invalid ElevenLabs test.",
          status: 400,
        },
      };
    }
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saRevealAssistantSecrets(input: { password: string }) {
  try {
    const ctx = await requireWritableSuperAdmin();
    await confirmAdminPassword(ctx, { password: input.password, confirm: true });
    const { revealAssistantVaultSecrets, ASSISTANT_SETTINGS_KEY } = await import(
      "@/services/ai/assistant-settings"
    );
    const { writeAdminAudit } = await import("@/services/admin/audit");
    const data = await revealAssistantVaultSecrets();
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "ASSISTANT_SECRETS_REVEALED",
      targetType: "assistant_settings",
      targetId: ASSISTANT_SETTINGS_KEY,
      newValue: {
        revealedAssistantApiKey: Boolean(data.assistantApiKey),
        revealedElevenLabsApiKey: Boolean(data.elevenLabsApiKey),
      },
      ipHash: await requestIpHash(),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saPaymentsDashboard() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await getPaymentsAdminDashboard() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetEmailSettings() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await getEmailSettingsForAdmin() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveEmailSettings(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await saveEmailSettingsForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSendResendTestEmail(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await sendResendTestEmailForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetMatchingAiSettings() {
  try {
    await requireSuperAdmin();
    return { ok: true as const, data: await getMatchingAiSettingsForAdmin() };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveMatchingAiSettings(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await saveMatchingAiSettingsForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saTestMatchingAiConnection(raw?: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await testMatchingAiConnectionForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetMatchingSponsorshipSettings() {
  try {
    await requireSuperAdmin();
    return {
      ok: true as const,
      data: await getMatchingSponsorshipAdminSnapshot(),
    };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSetMatchingSponsorshipGlobal(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await setMatchingSponsorshipGlobalForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saCreateMatchingSponsorship(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await createMatchingSponsorshipForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saTransitionMatchingSponsorship(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await transitionMatchingSponsorshipForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetMatchingSponsorshipPricingSnapshot() {
  try {
    await requireSuperAdmin();
    return {
      ok: true as const,
      data: await getMatchingSponsorshipPricingAdminSnapshot(),
    };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saUpsertMatchingSponsorshipPricingPlan(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await upsertMatchingSponsorshipPricingPlanForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSetMatchingSponsorshipPricingPlanStatus(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await setMatchingSponsorshipPricingPlanStatusForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saReorderMatchingSponsorshipPricingPlans(raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await reorderMatchingSponsorshipPricingPlansForAdmin(
      ctx,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saGetBackupDashboard() {
  try {
    await requireSuperAdmin();
    const data = await getBackupDashboardForAdmin();
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saRunBackupNow(password: string) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await runBackupNowForAdmin(ctx, password, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saVerifyBackup(password: string, backupId: string) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await verifyBackupForAdmin(
      ctx,
      password,
      backupId,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saRestoreTestBackup(input: {
  password: string;
  backupId: string;
  acknowledge: boolean;
}) {
  try {
    const ctx = await requireFullSuperAdmin();
    const data = await restoreTestBackupForAdmin(ctx, input, await requestIpHash());
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

export async function saSaveBackupSettings(password: string, raw: unknown) {
  try {
    const ctx = await requireWritableSuperAdmin();
    const data = await saveBackupSettingsForAdmin(
      ctx,
      password,
      raw,
      await requestIpHash(),
    );
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: toSafeClientError(error) };
  }
}

