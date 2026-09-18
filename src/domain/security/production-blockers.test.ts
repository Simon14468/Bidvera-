import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  assertCanManageBilling,
  canManageBilling,
} from "@/auth/billing-access";
import {
  assertEligibleExistingCompanyOnboarding,
  mayAssignOwnerOnCompanyCreate,
} from "@/auth/onboarding-privilege";
import {
  assertCompanyActiveForAppAccess,
  isCompanySuspended,
} from "@/auth/company-suspension";
import {
  isLocalDevelopmentSeed,
  resolveSeedSuperAdminEmail,
  resolveSeedSuperAdminPassword,
  assertProductionSuperAdminEnvConfigured,
} from "@/application/admin/seed-super-admin-password";
import { BASELINE_SECURITY_HEADERS, CSP_REPORT_ONLY } from "@/config/security-headers";
import {
  assertDrainJobsAllowed,
  isDrainJobsAllowed,
} from "@/services/jobs/drain-guard";
import {
  isInternalPipelineSmokeDisabled,
  resolvePipelineSmokeCompanyId,
} from "@/app/api/internal/cps-pipeline-smoke/guard";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H1 drainJobsAction production guard", () => {
  it("rejects authenticated callers in production before the global worker runs", () => {
    const authenticated = true;
    assert.equal(isDrainJobsAllowed("production"), false);
    assert.throws(
      () => assertDrainJobsAllowed("production"),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.FORBIDDEN &&
        error.status === 403,
    );
    assert.equal(authenticated && isDrainJobsAllowed("production"), false);
  });

  it("still allows the local/dev helper outside production", () => {
    assert.equal(isDrainJobsAllowed("development"), true);
    assert.equal(isDrainJobsAllowed("test"), true);
    assert.doesNotThrow(() => assertDrainJobsAllowed("development"));
  });

  it("wires the production guard into drainJobsAction before processJobsOnce", () => {
    const src = readSrc("src/app/actions.ts");
    const drainIdx = src.indexOf("export async function drainJobsAction");
    assert.ok(drainIdx >= 0);
    const body = src.slice(drainIdx, src.indexOf("export async function uploadTenderAction"));
    const guardIdx = body.indexOf("assertDrainJobsAllowed()");
    const workerIdx = body.indexOf("processJobsOnce");
    assert.ok(guardIdx >= 0);
    assert.ok(workerIdx > guardIdx);
  });
});

describe("H2 Super Admin demo credentials", () => {
  it("does not embed demo credentials in the Super Admin login client", () => {
    const src = readSrc("src/components/super-admin/sa-login-form.tsx");
    assert.doesNotMatch(src, /DEMO_SA/);
    assert.doesNotMatch(src, /BidveraSuperAdmin1!/);
    assert.doesNotMatch(src, /superadmin@bidvera\.com/);
    assert.match(src, /useState\(""\)/);
  });

  it("requires SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD for every seed — no silent fallback", () => {
    assert.throws(
      () => resolveSeedSuperAdminPassword({ NODE_ENV: "development" }),
      /SUPER_ADMIN_PASSWORD must be set/,
    );
    assert.throws(
      () => resolveSeedSuperAdminPassword({ NODE_ENV: "production" }),
      /SUPER_ADMIN_PASSWORD must be set/,
    );
    assert.throws(
      () => resolveSeedSuperAdminEmail({ NODE_ENV: "production" }),
      /SUPER_ADMIN_EMAIL must be set/,
    );
    assert.throws(
      () =>
        resolveSeedSuperAdminEmail({
          NODE_ENV: "production",
          SUPER_ADMIN_EMAIL: "superadmin@bidvera.com",
        }),
      /placeholder|demo/i,
    );
    assert.equal(
      resolveSeedSuperAdminPassword({
        NODE_ENV: "development",
        SUPER_ADMIN_PASSWORD: "local-only-strong-pass",
      }),
      "local-only-strong-pass",
    );
    assert.equal(
      resolveSeedSuperAdminEmail({
        NODE_ENV: "production",
        SUPER_ADMIN_EMAIL: "ops@acme.example",
      }),
      "ops@acme.example",
    );
  });

  it("rejects the known demo password outside local development", () => {
    assert.equal(
      isLocalDevelopmentSeed({ NODE_ENV: "production", SUPER_ADMIN_PASSWORD: "x" }),
      false,
    );
    assert.equal(isLocalDevelopmentSeed({ NODE_ENV: "development", VERCEL: "1" }), false);
    assert.throws(
      () =>
        resolveSeedSuperAdminPassword({
          NODE_ENV: "production",
          SUPER_ADMIN_PASSWORD: "BidveraSuperAdmin1!",
        }),
      /known local demo password/,
    );
  });

  it("seed and sync never fall back to a hardcoded Super Admin email", () => {
    const src = readSrc("prisma/seed.ts");
    assert.doesNotMatch(src, /superadmin@bidvera\.com/);
    assert.doesNotMatch(src, /SUPER_ADMIN_EMAIL \?\?/);
    assert.match(src, /syncSuperAdminFromEnv/);
    assert.match(src, /resolveSeedSuperAdminEmail/);
    const sync = readSrc("scripts/sync-super-admin.ts");
    assert.match(sync, /syncSuperAdminFromEnv/);
    assert.doesNotMatch(sync, /console\.log\([^)]*SUPER_ADMIN_PASSWORD[^)]*\$\{/);
    assert.doesNotMatch(sync, /console\.log\([^)]*result\.(email|password)/);
  });

  it("production readiness fails closed without SUPER_ADMIN_EMAIL/PASSWORD", () => {
    assert.equal(
      assertProductionSuperAdminEnvConfigured({ NODE_ENV: "development" }).ok,
      true,
    );
    const missing = assertProductionSuperAdminEnvConfigured({ NODE_ENV: "production" });
    assert.equal(missing.ok, false);
    const ok = assertProductionSuperAdminEnvConfigured({
      NODE_ENV: "production",
      SUPER_ADMIN_EMAIL: "ops@acme.example",
      SUPER_ADMIN_PASSWORD: "production-grade-pass-12",
    });
    assert.equal(ok.ok, true);
  });

  it("SA login keeps rate limits and never logs passwords", () => {
    const src = readSrc("src/application/admin/auth-service.ts");
    const login = src.slice(src.indexOf("export async function adminLoginAction"));
    assert.match(login, /sa-login:\$\{ip\}/);
    assert.match(login, /sa-login-email:\$\{hashIdentifier/);
    assert.match(login, /recordFailedLoginAttempt/);
    assert.match(login, /Invalid credentials/);
    assert.doesNotMatch(login, /console\.(log|info|error).*password/i);
    assert.match(src, /adminSession\.deleteMany/);
    assert.match(src, /ensureSeedAdminUser/);
    assert.doesNotMatch(src, /prisma\.user\.(create|update).*SUPER_ADMIN/);
  });
});

describe("H3 baseline security headers", () => {
  it("exports HSTS, nosniff, frame deny, referrer policy, and report-only CSP", () => {
    const keys = BASELINE_SECURITY_HEADERS.map((h) => h.key);
    assert.ok(keys.includes("Strict-Transport-Security"));
    assert.ok(keys.includes("X-Content-Type-Options"));
    assert.ok(keys.includes("X-Frame-Options"));
    assert.ok(keys.includes("Referrer-Policy"));
    assert.ok(keys.includes("Content-Security-Policy-Report-Only"));
    assert.equal(
      BASELINE_SECURITY_HEADERS.find((h) => h.key === "X-Content-Type-Options")?.value,
      "nosniff",
    );
    assert.equal(
      BASELINE_SECURITY_HEADERS.find((h) => h.key === "X-Frame-Options")?.value,
      "DENY",
    );
    assert.match(CSP_REPORT_ONLY, /frame-ancestors 'none'/);
    assert.equal(keys.includes("Content-Security-Policy"), false);
  });

  it("applies baseline headers globally in next.config", () => {
    const src = readSrc("next.config.ts");
    assert.match(src, /BASELINE_SECURITY_HEADERS/);
    assert.match(src, /source: "\/:path\*"/);
  });
});

describe("H4 billing OWNER/ADMIN authorization", () => {
  it("allows OWNER and ADMIN and rejects MEMBER and VIEWER", () => {
    assert.equal(canManageBilling("OWNER"), true);
    assert.equal(canManageBilling("ADMIN"), true);
    assert.equal(canManageBilling("MEMBER"), false);
    assert.equal(canManageBilling("VIEWER"), false);
    assert.doesNotThrow(() => assertCanManageBilling("OWNER"));
    assert.doesNotThrow(() => assertCanManageBilling("ADMIN"));
    assert.throws(
      () => assertCanManageBilling("MEMBER"),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
    assert.throws(
      () => assertCanManageBilling("VIEWER"),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("gates checkout, portal, cancel, and activate routes", () => {
    const actions = readSrc("src/app/actions.ts");
    for (const name of [
      "startCheckoutAction",
      "openBillingPortalAction",
      "cancelSubscriptionAction",
    ]) {
      const idx = actions.indexOf(`export async function ${name}`);
      assert.ok(idx >= 0, name);
      const slice = actions.slice(idx, idx + 600);
      assert.match(slice, /assertCanManageBilling/);
    }
    const activate = readSrc("src/app/api/billing/activate/route.ts");
    assert.match(activate, /requireCompanyIdApi/);
    assert.match(activate, /assertCanManageBilling\(auth\.user\.role\)/);
  });
});

describe("H6 Super Admin secret reveal step-up", () => {
  it("requires confirmAdminPassword before revealing vault secrets", () => {
    const src = readSrc("src/app/actions/super-admin.ts");
    const fnIdx = src.indexOf("export async function saRevealAssistantSecrets");
    assert.ok(fnIdx >= 0);
    const slice = src.slice(fnIdx, fnIdx + 900);
    const confirmIdx = slice.indexOf("confirmAdminPassword");
    const revealIdx = slice.indexOf("revealAssistantVaultSecrets");
    assert.ok(confirmIdx >= 0);
    assert.ok(revealIdx > confirmIdx);
    assert.match(slice, /password: input\.password/);
    assert.match(slice, /confirm: true/);
  });

  it("UI does not call reveal without a password argument", () => {
    const ui = readSrc("src/components/super-admin/assistant-control-panel.tsx");
    assert.doesNotMatch(ui, /saRevealAssistantSecrets\(\s*\)/);
    assert.match(ui, /saRevealAssistantSecrets\(\{ password: revealPassword \}\)/);
  });
});

describe("H7 internal pipeline smoke production 404", () => {
  it("returns the production-disabled signal regardless of secret", () => {
    assert.equal(isInternalPipelineSmokeDisabled("production"), true);
    assert.equal(isInternalPipelineSmokeDisabled("development"), false);
    assert.equal(isInternalPipelineSmokeDisabled("test"), false);
  });

  it("does not target the oldest tenant — requires an explicit company id", () => {
    assert.equal(resolvePipelineSmokeCompanyId({}), null);
    assert.equal(
      resolvePipelineSmokeCompanyId({ CPS_SMOKE_COMPANY_ID: " company-1 " }),
      "company-1",
    );
    const src = readSrc("src/app/api/internal/cps-pipeline-smoke/route.ts");
    assert.match(src, /isInternalPipelineSmokeDisabled/);
    assert.match(src, /status: 404/);
    assert.doesNotMatch(src, /findFirst/);
    assert.match(src, /resolvePipelineSmokeCompanyId/);
    assert.match(src, /findUnique/);
  });
});

describe("C-01 onboarding never promotes existing members to OWNER", () => {
  it("rejects MEMBER/VIEWER/ADMIN and already-onboarded states", () => {
    for (const role of ["MEMBER", "VIEWER", "ADMIN"] as const) {
      assert.throws(
        () =>
          assertEligibleExistingCompanyOnboarding({
            companyId: "co_1",
            role,
            onboardingStep: "COMPANY",
          }),
        (error: unknown) =>
          error instanceof AppError &&
          error.status === 403 &&
          /workspace owner/i.test(error.message),
      );
    }

    assert.throws(
      () =>
        assertEligibleExistingCompanyOnboarding({
          companyId: "co_1",
          role: "OWNER",
          onboardingStep: "DONE",
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 403 &&
        /already complete/i.test(error.message),
    );

    assert.throws(
      () =>
        assertEligibleExistingCompanyOnboarding({
          companyId: "co_1",
          role: "OWNER",
          onboardingStep: "VERIFY_EMAIL",
        }),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );

    assert.doesNotThrow(() =>
      assertEligibleExistingCompanyOnboarding({
        companyId: "co_1",
        role: "OWNER",
        onboardingStep: "COMPANY",
      }),
    );
    assert.equal(mayAssignOwnerOnCompanyCreate({ companyId: null }), true);
    assert.equal(mayAssignOwnerOnCompanyCreate({ companyId: "co_1" }), false);
  });

  it("completeCompanyOnboardingAction preserves role on existing-company path", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(
      src.indexOf("export async function completeCompanyOnboardingAction"),
      src.indexOf("export async function skipCompanyOnboardingAction"),
    );
    assert.match(fn, /assertEligibleExistingCompanyOnboarding\(user\)/);
    assert.match(fn, /mayAssignOwnerOnCompanyCreate\(user\)/);
    const existingBranch = fn.slice(
      fn.indexOf("if (user.companyId)"),
      fn.indexOf("if (!mayAssignOwnerOnCompanyCreate"),
    );
    assert.doesNotMatch(
      existingBranch,
      /role:\s*["']OWNER["']/,
    );
    assert.match(existingBranch, /onboardingStep:\s*["']DONE["']/);
    assert.match(fn, /role:\s*["']OWNER["']/);
  });

  it("skipCompanyOnboardingAction gates existing company and never promotes role", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(
      src.indexOf("export async function skipCompanyOnboardingAction"),
      src.indexOf("export async function activateFreeOrTrialPlanAction"),
    );
    assert.match(fn, /assertEligibleExistingCompanyOnboarding\(user\)/);
    const existingBranch = fn.slice(
      fn.indexOf("if (user.companyId)"),
      fn.indexOf("const fallbackName"),
    );
    assert.doesNotMatch(existingBranch, /role:\s*["']OWNER["']/);
  });
});

describe("H-01 free/trial activation requires OWNER/ADMIN", () => {
  it("gates activateFreeOrTrialPlanAction with assertCanManageBilling", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(
      src.indexOf("export async function activateFreeOrTrialPlanAction"),
      src.indexOf("function isLikelyPersonalEmail"),
    );
    const billingIdx = fn.indexOf("assertCanManageBilling(auth.user.role)");
    const freeIdx = fn.indexOf("assignFreeWorkspace");
    const turnstileIdx = fn.indexOf("assertTurnstileToken");
    assert.ok(billingIdx >= 0);
    assert.ok(turnstileIdx > billingIdx);
    assert.ok(freeIdx > turnstileIdx);
    assert.match(fn, /assertTurnstileToken/);
    assert.throws(
      () => assertCanManageBilling("MEMBER"),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
    assert.throws(
      () => assertCanManageBilling("VIEWER"),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
  });
});

describe("H-02 suspended companies lose normal app access", () => {
  it("asserts suspended status and keeps helpers fail-closed", () => {
    assert.equal(isCompanySuspended("ACTIVE"), false);
    assert.equal(isCompanySuspended("SUSPENDED"), true);
    assert.doesNotThrow(() => assertCompanyActiveForAppAccess("ACTIVE"));
    assert.throws(
      () => assertCompanyActiveForAppAccess("SUSPENDED"),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 403 &&
        /suspended/i.test(error.message),
    );
  });

  it("enforces suspension at login, session resolve, and suspend revoke", () => {
    const authSrc = readSrc("src/application/auth-service.ts");
    const login = authSrc.slice(authSrc.indexOf("export async function loginAction"));
    assert.match(login, /assertCompanyActiveForAppAccess/);

    const session = readSrc("src/auth/session.ts");
    assert.match(session, /isCompanySuspended/);
    assert.match(session, /isAuthorizedSaEnterFingerprint/);
    assert.match(session, /company:\s*\{\s*select:\s*\{\s*status:\s*true/);

    const suspend = readSrc("src/application/admin/company-service.ts");
    const fn = suspend.slice(suspend.indexOf("export async function setCompanySuspended"));
    assert.match(fn, /session\.deleteMany/);
    assert.match(fn, /companyId: input\.companyId/);
  });
});

describe("SA company delete is gated and confirm-slug locked", () => {
  it("requires slug confirmation, clears restrict children, and audits", () => {
    const svc = readSrc("src/application/admin/company-service.ts");
    const fn = svc.slice(svc.indexOf("export async function deleteCompanyForAdmin"));
    assert.match(fn, /confirmSlug/);
    assert.match(fn, /matchingSponsorshipPricingRequest\.deleteMany/);
    assert.match(fn, /complianceDocument\.deleteMany/);
    assert.match(fn, /COMPANY_DELETED/);
    assert.match(fn, /company\.delete/);

    const actions = readSrc("src/app/actions/super-admin.ts");
    const del = actions.slice(actions.indexOf("export async function saDeleteCompany"));
    assert.match(del, /requireFullSuperAdmin/);
    assert.match(del, /confirmAdminPassword/);
    assert.match(del, /deleteCompanyForAdmin/);
  });
});
