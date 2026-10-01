import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";
import { shouldAssignFreeWorkspace } from "@/services/billing/free-workspace";
import { applyFreeWorkspaceCheckoutGuard } from "@/services/billing/free-plan-guard";
import {
  resolveBillingDisplayStatus,
  resolveUserFacingPlanName,
} from "@/services/billing/billing-display";
import {
  hasConsumedFreeWorkspaceFirstSignupTrial,
  pickFreeWorkspaceTrialPlan,
  resolveFirstSignupTrialOffer,
  resolveTrialDurationDays,
  resolveTrialGrantDecision,
  shouldConsumeTrialOnSuccessfulGrant,
  trialPeriodEndFromDays,
  type TrialSourcePlan,
} from "@/services/billing/trial-grant";
import {
  hasDuplicateFreeWorkspacePlans,
  isPublicCommercialPricingPlan,
  listConflictingFreeWorkspacePlans,
  shouldRejectDuplicateFreeWorkspacePlan,
} from "@/services/billing/free-workspace-identity";
import {
  buildFreeWorkspaceSettingsPayload,
  pickExistingFreeWorkspacePlan,
  type AdminPlanRow,
} from "@/application/admin/plan-view-model";
import { resolveTrialGrantPolicy } from "@/services/trial/grant-policy";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const freePlan: TrialSourcePlan = {
  id: "plan_free",
  slug: "free",
  status: "ACTIVE",
  isFree: true,
  trialEligible: true,
  trialDays: 14,
  analysesLimit: 0,
  analysesLimitYearly: null,
};

describe("Free Workspace 14-day trial grant", () => {
  it("prefers the active trial-eligible Free Workspace plan", () => {
    const picked = pickFreeWorkspaceTrialPlan([
      { ...freePlan, id: "plan_trial", slug: "trial", isFree: false, status: "INACTIVE" },
      freePlan,
      { ...freePlan, id: "plan_pro", slug: "pro", isFree: false, trialEligible: false },
    ]);
    assert.equal(picked?.id, "plan_free");
    assert.equal(picked?.slug, "free");
  });

  it("ignores the inactive trial catalog row", () => {
    assert.equal(
      pickFreeWorkspaceTrialPlan([
        {
          id: "plan_trial",
          slug: "trial",
          status: "INACTIVE",
          isFree: false,
          trialEligible: true,
          trialDays: 14,
          analysesLimit: 3,
          analysesLimitYearly: null,
        },
      ]),
      null,
    );
  });

  it("defaults duration to 14 days and respects configured trialDays", () => {
    assert.equal(resolveTrialDurationDays({}), 14);
    assert.equal(resolveTrialDurationDays({ settingsTrialDays: 0 }), 14);
    assert.equal(resolveTrialDurationDays({ planTrialDays: 21, settingsTrialDays: 7 }), 21);
    const start = new Date("2026-09-24T00:00:00.000Z");
    assert.equal(
      trialPeriodEndFromDays(start, 14).toISOString(),
      "2026-10-08T00:00:00.000Z",
    );
  });

  it("shows Free Workspace, not Trial, for a TRIALING subscription on the free plan", () => {
    assert.equal(
      resolveUserFacingPlanName({
        slug: "free",
        isFree: true,
        planName: "Free Workspace",
        fallback: "Trial",
      }),
      "Free Workspace",
    );
    assert.notEqual(
      resolveUserFacingPlanName({
        slug: "free",
        isFree: true,
        planName: "Free Workspace",
      }),
      "Trial",
    );
  });

  it("blocks access when the trial period ends and does not assign Free Workspace", () => {
    const past = new Date("2026-09-01T00:00:00.000Z");
    const access = evaluateSubscriptionAccess({
      status: "TRIALING",
      plan: "TRIAL",
      billingInterval: "MONTH",
      startedAt: past,
      currentPeriodStart: past,
      currentPeriodEnd: past,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: false,
    });
    assert.equal(access.allowed, false);
    assert.equal(access.reason, "trial_expired");
    assert.equal(access.effectiveStatus, "EXPIRED");
    assert.equal(
      shouldAssignFreeWorkspace({ freeWorkspaceEnabled: true, reason: "trial_expired" }),
      false,
    );
  });

  it("keeps paid cancellation and payment-failure downgrades", () => {
    assert.equal(
      shouldAssignFreeWorkspace({ freeWorkspaceEnabled: true, reason: "canceled" }),
      true,
    );
    assert.equal(
      shouldAssignFreeWorkspace({
        freeWorkspaceEnabled: true,
        reason: "past_due_expired",
      }),
      true,
    );
    const stripe = read("src/services/billing/stripe.ts");
    const paypal = read("src/services/billing/paypal.ts");
    assert.match(stripe, /assignFreeWorkspace/);
    assert.match(paypal, /assignFreeWorkspace/);
  });

  it("keeps Free Workspace off paid checkout while allowing trialEligible", () => {
    const guarded = applyFreeWorkspaceCheckoutGuard({
      slug: "free",
      isFree: true,
      stripeEnabled: true,
      paypalEnabled: true,
      trialEligible: true,
      monthlyPriceCents: 1900,
      annualPriceCents: 19000,
    });
    assert.equal(guarded.stripeEnabled, false);
    assert.equal(guarded.paypalEnabled, false);
    assert.equal(guarded.monthlyPriceCents, 0);
    assert.equal(guarded.trialEligible, true);
  });

  it("does not persist EXPIRED when the trial cannot be granted yet", () => {
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: false,
      }),
      { action: "skip", reason: "config_unavailable" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: false,
        hasEligiblePlan: true,
      }),
      { action: "skip", reason: "config_unavailable" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: false,
        trialEnabled: true,
        hasEligiblePlan: true,
      }),
      { action: "skip", reason: "grant_not_allowed" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        existing: { status: "EXPIRED", plan: "TRIAL" },
      }),
      { action: "skip", reason: "locked" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        existing: { status: "ACTIVE", plan: "PRO" },
      }),
      { action: "skip", reason: "locked" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        existing: { status: "CANCELED", plan: "STARTER" },
      }),
      { action: "skip", reason: "locked" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        existing: { status: "TRIALING", plan: "TRIAL" },
      }),
      { action: "skip", reason: "already_trialing" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
      }),
      { action: "grant" },
    );
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        existing: null,
      }),
      { action: "grant" },
    );
  });

  it("keeps temporary risk delays retryable and permanent blocks from granting", () => {
    const delayed = resolveTrialGrantPolicy({
      trialEnabled: true,
      highRiskBlockTrial: true,
      mediumRiskRequireBusinessEmail: false,
      mediumRiskTrialDelayHours: 24,
      risk: { score: 40, verdict: "REVIEW", signals: {} },
      email: "ops@company.com",
      companyCreatedAt: new Date("2026-09-25T00:00:00.000Z"),
      now: new Date("2026-09-25T01:00:00.000Z"),
    });
    assert.equal(delayed.kind, "deferred");
    assert.equal(delayed.allow, false);
    assert.equal(
      resolveTrialGrantDecision({
        grant: delayed.allow,
        trialEnabled: true,
        hasEligiblePlan: true,
      }).action,
      "skip",
    );

    const afterDelay = resolveTrialGrantPolicy({
      trialEnabled: true,
      highRiskBlockTrial: true,
      mediumRiskRequireBusinessEmail: false,
      mediumRiskTrialDelayHours: 24,
      risk: { score: 40, verdict: "REVIEW", signals: {} },
      email: "ops@company.com",
      companyCreatedAt: new Date("2026-09-25T00:00:00.000Z"),
      now: new Date("2026-09-26T01:00:00.000Z"),
    });
    assert.equal(afterDelay.kind, "allowed");
    assert.equal(
      resolveTrialGrantDecision({
        grant: afterDelay.allow,
        trialEnabled: true,
        hasEligiblePlan: true,
      }).action,
      "grant",
    );

    const blocked = resolveTrialGrantPolicy({
      trialEnabled: true,
      highRiskBlockTrial: true,
      mediumRiskRequireBusinessEmail: false,
      mediumRiskTrialDelayHours: 0,
      risk: { score: 90, verdict: "BLOCK", signals: {} },
      email: "ops@company.com",
      companyCreatedAt: new Date("2026-09-25T00:00:00.000Z"),
    });
    assert.equal(blocked.kind, "blocked");
    assert.deepEqual(
      resolveTrialGrantDecision({
        grant: blocked.allow,
        trialEnabled: true,
        hasEligiblePlan: true,
      }),
      { action: "skip", reason: "grant_not_allowed" },
    );
  });

  it("shows expired trial as expired, not an active Free Workspace", () => {
    assert.equal(
      resolveBillingDisplayStatus({
        status: "TRIALING",
        slug: "free",
        isFree: true,
        plan: "TRIAL",
      }),
      "TRIALING",
    );
    assert.equal(
      resolveBillingDisplayStatus({
        status: "EXPIRED",
        effectiveStatus: "EXPIRED",
        reason: "trial_expired",
        slug: "free",
        isFree: true,
        plan: "TRIAL",
      }),
      "EXPIRED",
    );
    assert.equal(
      resolveBillingDisplayStatus({
        status: "TRIALING",
        effectiveStatus: "EXPIRED",
        reason: "trial_expired",
        slug: "free",
        isFree: true,
        plan: "TRIAL",
      }),
      "EXPIRED",
    );
    assert.equal(
      resolveBillingDisplayStatus({
        status: "ACTIVE",
        plan: "FREE",
        slug: "free",
        isFree: true,
      }),
      "FREE_WORKSPACE",
    );
    assert.equal(
      resolveBillingDisplayStatus({ status: "PAYMENT_FAILED", plan: "STARTER" }),
      "PAYMENT_FAILED",
    );
  });

  it("wires onboarding to a dated TRIALING grant, not an open-ended ACTIVE FREE row", () => {
    const grant = read("src/services/billing/subscription-state.ts");
    assert.match(grant, /pickFreeWorkspaceTrialPlan/);
    assert.match(grant, /resolveFirstSignupTrialOffer/);
    assert.match(grant, /status: "TRIALING"/);
    assert.match(grant, /plan: "TRIAL"/);
    assert.match(grant, /findFreeWorkspaceTrialPlan/);
    assert.doesNotMatch(grant, /requirePaymentMethodForTrial/);
    assert.doesNotMatch(grant, /trialsOn \? "TRIALING" : "EXPIRED"/);
    const auth = read("src/application/auth-service.ts");
    assert.match(auth, /redirectTo: "\/dashboard"/);
    const activate = auth.slice(
      auth.indexOf("export async function activateFreeOrTrialPlanAction"),
      auth.indexOf("function isLikelyPersonalEmail"),
    );
    assert.match(activate, /ensureTrialSubscription/);
    assert.doesNotMatch(activate, /assignFreeWorkspace/);
    assert.doesNotMatch(activate, /onboarding_free/);
    const reconcile = read("src/services/billing/reconcile.ts");
    assert.match(reconcile, /shouldAssignFreeWorkspace/);
  });

  it("keeps Tender Analysis Super Admin-only and tenant-scoped entitlements", () => {
    const planService = read("src/application/admin/plan-service.ts");
    assert.match(planService, /setPlanFeature\(planId, "tender_analysis", false\)/);
    const entitlements = read("src/services/entitlements/index.ts");
    assert.match(entitlements, /companyId/);
    assert.match(entitlements, /PlanFeature rows are authoritative/);
  });

  it("reproduces required Super Admin and production-safe wiring", () => {
    const form = read("src/components/super-admin/plan-form.tsx");
    assert.match(form, /defaultChecked=\{initial\?\.trialEligible \?\? false\}/);
    assert.match(form, /Eligible for first-signup trial/);
    assert.match(form, /defaultValue=\{initial\?\.trialDays \?\? 14\}/);
    assert.match(form, /automatic first-signup trial/);
    assert.doesNotMatch(
      form,
      /name="trialEligible"[\s\S]{0,120}disabled=\{isFree\}/,
    );
    assert.doesNotMatch(form, /trialEligible: isFree \? false/);
    assert.match(form, /monthlyPriceCents: isFree \? 0/);
    assert.match(form, /monthly or yearly price/);
    const avatar = read("src/components/brand/company-avatar.tsx");
    assert.match(avatar, /unoptimized=\{isCustom\}/);
    const middleware = read("src/middleware.ts");
    assert.match(middleware, /\/api\/auth\/google\/start/);
    assert.match(middleware, /\/api\/auth\/google\/callback/);
  });

  it("uses the Free Workspace catalog plan as the configurable default first-signup trial", () => {
    assert.equal(pickFreeWorkspaceTrialPlan([freePlan])?.slug, "free");
    assert.equal(resolveTrialDurationDays({ planTrialDays: 14 }), 14);
    assert.equal(
      pickFreeWorkspaceTrialPlan([
        { ...freePlan, status: "INACTIVE" },
        { ...freePlan, id: "off", trialEligible: false },
      ]),
      null,
    );
    const grant = read("src/services/billing/subscription-state.ts");
    assert.match(grant, /P2002/);
    assert.match(grant, /already_trialing/);
    assert.doesNotMatch(grant, /requirePaymentMethodForTrial/);
    const entitlements = read("src/services/entitlements/index.ts");
    assert.match(entitlements, /PlanFeature rows are authoritative/);
    assert.match(entitlements, /source: "billing_plan"/);
    const layout = read("src/app/(app)/layout.tsx");
    assert.match(layout, /loadAppChromeSnapshot/);
    assert.match(layout, /FreeWorkspaceTrialBanner/);
    assert.match(layout, /formatFreeWorkspaceTrialBanner/);
    const card = read("src/components/dashboard/workspace-plan-card.tsx");
    assert.match(card, /isExpiredTrial/);
    assert.match(card, /\/upgrade\?reason=trial_expired/);
    assert.doesNotMatch(card, /14 days remaining/);
    const saPage = read(
      "src/app/(super-admin)/[saKey]/(panel)/plans/free-workspace/page.tsx",
    );
    assert.match(saPage, /pickExistingFreeWorkspacePlan/);
    assert.match(saPage, /FreeWorkspaceSettings/);
    assert.match(saPage, /Free Workspace Trial Settings/);
    assert.doesNotMatch(saPage, /PlansManager/);
    assert.doesNotMatch(saPage, /Create plan/);
    const settings = read(
      "src/components/super-admin/free-workspace-settings.tsx",
    );
    assert.match(settings, /Save Free Workspace settings/);
    assert.match(settings, /Enable first-signup trial/);
    assert.match(settings, /Trial duration \(days\)/);
    assert.match(settings, /saUpsertPlan/);
    assert.match(settings, /buildFreeWorkspaceSettingsPayload/);
    assert.doesNotMatch(settings, /Create plan/);
    assert.doesNotMatch(settings, /Stripe checkout/);
    assert.doesNotMatch(settings, /PayPal checkout/);
    assert.doesNotMatch(settings, /Monthly price/);
    assert.doesNotMatch(settings, /highlighted/);
    assert.doesNotMatch(settings, /name="analysesLimit"/);
    assert.doesNotMatch(settings, />\s*Analyses\s*</);
    const shell = read("src/components/super-admin/sa-shell.tsx");
    assert.match(shell, /\/plans\/free-workspace/);
    const reconcile = read("src/services/billing/reconcile.ts");
    assert.match(reconcile, /shouldAssignFreeWorkspace/);
    assert.equal(
      shouldAssignFreeWorkspace({
        freeWorkspaceEnabled: true,
        reason: "trial_expired",
      }),
      false,
    );
  });

  it("updates the existing Free Workspace plan without creating a commercial catalog row", () => {
    const existing: AdminPlanRow = {
      id: "plan_free",
      slug: "free",
      name: "Free Workspace",
      description: "Official first-signup trial",
      monthlyPriceCents: 0,
      annualPriceCents: null,
      annualMonths: 12,
      monthlyEnabled: false,
      annualEnabled: false,
      analysesLimit: 3,
      analysesLimitYearly: null,
      seatsLimit: 1,
      seatsLimitYearly: null,
      aiTokensLimit: null,
      storageMbLimit: 256,
      isFree: true,
      visibleToPublic: false,
      stripeEnabled: false,
      paypalEnabled: false,
      status: "ACTIVE",
      trialEligible: true,
      trialDays: 14,
      graceDays: null,
      currency: "usd",
      sortOrder: 0,
      highlighted: false,
      preferEntitlementLabels: true,
      featureList: [],
      featureKeys: ["company_profile"],
      translations: null,
      subscriptionsCount: 2,
    };
    const paid: AdminPlanRow = {
      ...existing,
      id: "plan_pro",
      slug: "pro",
      name: "Pro",
      isFree: false,
      trialEligible: false,
    };
    assert.equal(pickExistingFreeWorkspacePlan([paid, existing])?.id, "plan_free");
    assert.equal(pickExistingFreeWorkspacePlan([paid]), null);
    const payload = buildFreeWorkspaceSettingsPayload(
      existing,
      {
        trialEligible: true,
        trialDays: 21,
        featureKeys: [
          "company_profile",
          "document_compliance",
          "tender_analysis",
        ],
        seatsLimit: 2,
        aiTokensLimit: 0,
        storageMbLimit: 128,
      },
      ["company_profile", "document_compliance"],
    );
    assert.equal(payload.id, "plan_free");
    assert.equal(payload.slug, "free");
    assert.equal(payload.trialDays, 21);
    assert.equal(payload.analysesLimit, existing.analysesLimit);
    assert.deepEqual(payload.featureKeys, [
      "company_profile",
      "document_compliance",
    ]);
    assert.equal(payload.stripeEnabled, false);
    assert.equal(payload.paypalEnabled, false);
    assert.equal(payload.isFree, true);
  });

  it("grants the designated Free Workspace plan once and never any isFree row", () => {
    assert.equal(pickFreeWorkspaceTrialPlan([freePlan])?.id, "plan_free");
    assert.equal(
      pickFreeWorkspaceTrialPlan([
        {
          ...freePlan,
          id: "ssasa",
          slug: "ssasa",
          isFree: true,
        },
      ]),
      null,
    );
    assert.equal(
      pickFreeWorkspaceTrialPlan([
        { ...freePlan, isFree: false },
      ]),
      null,
    );
    const first = resolveFirstSignupTrialOffer({
      grant: true,
      trialEnabled: true,
      hasEligiblePlan: true,
      consumedAt: null,
      existing: null,
    });
    assert.deepEqual(first, { action: "grant" });
    assert.equal(shouldConsumeTrialOnSuccessfulGrant(first), true);
    assert.equal(
      hasConsumedFreeWorkspaceFirstSignupTrial({ consumedAt: null, existing: null }),
      false,
    );
  });

  it("sets consumption after a successful grant and refuses a second onboarding", () => {
    const consumedAt = new Date("2026-09-01T00:00:00.000Z");
    assert.equal(
      hasConsumedFreeWorkspaceFirstSignupTrial({ consumedAt, existing: null }),
      true,
    );
    assert.deepEqual(
      resolveFirstSignupTrialOffer({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        consumedAt,
        existing: null,
      }),
      { action: "skip", reason: "already_consumed" },
    );
    assert.equal(
      shouldConsumeTrialOnSuccessfulGrant({
        action: "skip",
        reason: "already_consumed",
      }),
      false,
    );
  });

  it("treats existing EXPIRED+TRIAL and TRIALING as permanently consumed", () => {
    assert.equal(
      hasConsumedFreeWorkspaceFirstSignupTrial({
        consumedAt: null,
        existing: { status: "EXPIRED", plan: "TRIAL" },
      }),
      true,
    );
    assert.equal(
      hasConsumedFreeWorkspaceFirstSignupTrial({
        consumedAt: null,
        existing: { status: "TRIALING", plan: "TRIAL" },
      }),
      true,
    );
    assert.deepEqual(
      resolveFirstSignupTrialOffer({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        consumedAt: null,
        existing: { status: "EXPIRED", plan: "TRIAL" },
      }),
      { action: "skip", reason: "already_consumed" },
    );
    assert.deepEqual(
      resolveFirstSignupTrialOffer({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: true,
        consumedAt: null,
        existing: { status: "TRIALING", plan: "TRIAL" },
      }),
      { action: "skip", reason: "already_consumed" },
    );
  });

  it("keeps consumption across later subscription states, login, and onboarding", () => {
    const consumedAt = new Date("2026-01-01T00:00:00.000Z");
    for (const existing of [
      null,
      { status: "EXPIRED", plan: "TRIAL" },
      { status: "ACTIVE", plan: "FREE" },
      { status: "ACTIVE", plan: "PRO" },
      { status: "CANCELED", plan: "STARTER" },
    ] as const) {
      assert.deepEqual(
        resolveFirstSignupTrialOffer({
          grant: true,
          trialEnabled: true,
          hasEligiblePlan: true,
          consumedAt,
          existing,
        }),
        { action: "skip", reason: "already_consumed" },
      );
    }
  });

  it("does not consume the trial when grant, config, or policy fail", () => {
    const skips = [
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: true,
        hasEligiblePlan: false,
      }),
      resolveTrialGrantDecision({
        grant: true,
        trialEnabled: false,
        hasEligiblePlan: true,
      }),
      resolveTrialGrantDecision({
        grant: false,
        trialEnabled: true,
        hasEligiblePlan: true,
      }),
    ];
    for (const decision of skips) {
      assert.equal(decision.action, "skip");
      assert.equal(shouldConsumeTrialOnSuccessfulGrant(decision), false);
    }
    assert.deepEqual(
      resolveTrialGrantPolicy({
        trialEnabled: true,
        highRiskBlockTrial: true,
        mediumRiskRequireBusinessEmail: false,
        mediumRiskTrialDelayHours: 0,
        risk: { score: 90, verdict: "BLOCK", signals: {} },
        email: "owner@example.com",
        companyCreatedAt: new Date(),
      }),
      { kind: "blocked", allow: false },
    );
    assert.equal(
      resolveTrialGrantPolicy({
        trialEnabled: true,
        highRiskBlockTrial: false,
        mediumRiskRequireBusinessEmail: false,
        mediumRiskTrialDelayHours: 24,
        risk: { score: 40, verdict: "REVIEW", signals: {} },
        email: "owner@example.com",
        companyCreatedAt: new Date(),
      }).kind,
      "deferred",
    );
    const grant = read("src/services/billing/subscription-state.ts");
    const skipReturn = grant.indexOf("decision.action !== \"grant\" || !trialPlan");
    const consumeWrite = grant.indexOf("persistConsumedMarkerIfMissing(companyId, null)");
    assert.ok(skipReturn > 0 && consumeWrite > skipReturn);
    assert.match(grant, /\$transaction/);
    assert.match(grant, /updateMany/);
    assert.match(grant, /P2002/);
    assert.doesNotMatch(
      grant.slice(0, skipReturn),
      /data: \{ freeWorkspaceTrialConsumedAt:/,
    );
  });

  it("does not block paid cancellation or payment-failure Free Workspace fallback", () => {
    assert.equal(
      shouldAssignFreeWorkspace({
        freeWorkspaceEnabled: true,
        reason: "canceled",
      }),
      true,
    );
    assert.equal(
      shouldAssignFreeWorkspace({
        freeWorkspaceEnabled: true,
        reason: "past_due_expired",
      }),
      true,
    );
    const assigner = read("src/services/billing/free-workspace.ts");
    assert.doesNotMatch(assigner, /freeWorkspaceTrialConsumedAt/);
    assert.doesNotMatch(assigner, /already_consumed/);
  });

  it("hides Free Workspace from public commercial pricing and trial CTA after consume", () => {
    assert.equal(
      isPublicCommercialPricingPlan({ isFree: true, slug: "free" }),
      false,
    );
    assert.equal(
      isPublicCommercialPricingPlan({ isFree: false, slug: "pro" }),
      true,
    );
    const catalog = read("src/services/billing/catalog.ts");
    assert.match(catalog, /isPublicCommercialPricingPlan/);
    assert.match(catalog, /notIn: \["trial", "free"\]/);
    assert.doesNotMatch(
      catalog,
      /OR: \[\{ visibleToPublic: true \}, \{ isFree: true, slug: "free" \}\]/,
    );
    const pricing = read("src/app/(marketing)/(site)/pricing/page.tsx");
    assert.match(pricing, /showFirstSignupTrialCta/);
    assert.match(pricing, /canOfferFirstSignupFreeWorkspaceTrial/);
    assert.match(pricing, /startTrial/);
    const landing = read("src/app/(marketing)/(site)/page.tsx");
    assert.match(landing, /showFirstSignupTrialCta/);
    assert.match(landing, /startTrial/);
    const picker = read("src/components/onboarding/plan-picker.tsx");
    assert.match(picker, /showFirstSignupTrialCta/);
    assert.doesNotMatch(picker, /freePlans\.map/);
    const grid = read("src/components/marketing/pricing-grid.tsx");
    assert.match(grid, /commercialPlans/);
  });

  it("rejects a second designated Free Workspace and reports existing extras", () => {
    const designated = {
      id: "plan_free",
      slug: "free",
      isFree: true,
      name: "Free Workspace",
    };
    const extra = { id: "ssasa", slug: "ssasa", isFree: true, name: "ssasa" };
    assert.equal(hasDuplicateFreeWorkspacePlans([designated, extra]), true);
    assert.deepEqual(
      listConflictingFreeWorkspacePlans([designated, extra]).map((p) => p.id),
      ["ssasa"],
    );
    assert.equal(
      shouldRejectDuplicateFreeWorkspacePlan({
        incoming: { slug: "ssasa", isFree: true },
        previous: null,
        existingCandidates: [designated],
      }),
      true,
    );
    assert.equal(
      shouldRejectDuplicateFreeWorkspacePlan({
        incoming: { slug: "free", isFree: true },
        previous: designated,
        existingCandidates: [designated],
      }),
      false,
    );
    const planService = read("src/application/admin/plan-service.ts");
    assert.match(planService, /assertUniqueDesignatedFreeWorkspace/);
    assert.match(planService, /Only one Free Workspace system plan can exist/);
    const saPlans = read("src/app/(super-admin)/[saKey]/(panel)/plans/page.tsx");
    assert.match(saPlans, /Duplicate Free Workspace plans detected/);
    assert.match(
      read("src/app/(super-admin)/[saKey]/(panel)/plans/free-workspace/page.tsx"),
      /Duplicate Free Workspace plans detected/,
    );
  });

  it("changing trialDays never resets an already consumed first-signup trial", () => {
    const consumed = resolveFirstSignupTrialOffer({
      grant: true,
      trialEnabled: true,
      hasEligiblePlan: true,
      consumedAt: new Date("2026-02-01T00:00:00.000Z"),
      existing: { status: "EXPIRED", plan: "TRIAL" },
    });
    assert.deepEqual(consumed, { action: "skip", reason: "already_consumed" });
    assert.equal(resolveTrialDurationDays({ planTrialDays: 30 }), 30);
    assert.equal(resolveTrialDurationDays({ planTrialDays: 7 }), 7);
    const grant = read("src/services/billing/subscription-state.ts");
    assert.doesNotMatch(grant, /data: \{ freeWorkspaceTrialConsumedAt: null \}/);
  });
});
