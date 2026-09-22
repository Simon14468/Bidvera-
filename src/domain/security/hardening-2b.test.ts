import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import { hashIdentifier } from "@/lib/crypto";
import { redactEmailForLog } from "@/lib/safe-log";
import { isUnsafeProductionMemoryRateLimit } from "@/lib/rate-limit";
import {
  assertCanManageCompanySettings,
  canManageCompanySettings,
} from "@/auth/company-settings-access";
import { genericSignupSuccess } from "@/application/auth-service";
import {
  isLocalDevelopmentSeed,
  resolveSeedSuperAdminPassword,
} from "@/application/admin/seed-super-admin-password";
import { failedLoginAuditPayload } from "@/services/auth/failed-login";
import {
  assertBillingWebhookSignatureHeaders,
  hasBillingWebhookSignatureHeaders,
} from "@/services/billing/webhook-guard";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H5 company profile authorization", () => {
  it("allows OWNER/ADMIN and rejects MEMBER/VIEWER", () => {
    assert.equal(canManageCompanySettings("OWNER"), true);
    assert.equal(canManageCompanySettings("ADMIN"), true);
    assert.equal(canManageCompanySettings("MEMBER"), false);
    assert.equal(canManageCompanySettings("VIEWER"), false);
    assert.throws(
      () => assertCanManageCompanySettings("MEMBER"),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
    assert.throws(
      () => assertCanManageCompanySettings("VIEWER"),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("gates updateCompanyProfileAction after tenant resolution", () => {
    const src = readSrc("src/application/company-service.ts");
    const fn = src.slice(src.indexOf("export async function updateCompanyProfileAction"));
    assert.match(fn, /requireCompanyId/);
    assert.match(fn, /assertCanManageCompanySettings\(auth\.user\.role\)/);
  });
});

describe("M1 Super Admin enter is POST-only", () => {
  it("GET is a no-op 405 and POST performs the session mutation", () => {
    const src = readSrc(
      "src/app/(super-admin)/[saKey]/(panel)/companies/[companyId]/enter/route.ts",
    );
    assert.match(src, /export async function GET/);
    assert.match(src, /status: 405/);
    const getBody = src.slice(
      src.indexOf("export async function GET"),
      src.indexOf("export async function POST"),
    );
    assert.doesNotMatch(getBody, /adminEnterCompanyAccount/);
    assert.doesNotMatch(getBody, /setSessionCookie|applySessionCookie/);
    const postBody = src.slice(src.indexOf("export async function POST"));
    assert.match(postBody, /adminEnterCompanyAccount/);
    assert.match(postBody, /requireWritableSuperAdmin/);
    assert.match(postBody, /mintSaEnterClaim/);
    assert.match(postBody, /wantsClaimJson/);
    // Cookie must stay on the request origin (localhost vs 127.0.0.1, etc.).
    assert.match(postBody, /NextResponse\.redirect\(`\$\{origin\}\/dashboard`/);
    assert.match(postBody, /applySessionCookie\(response,\s*sessionToken\)/);
    assert.doesNotMatch(postBody, /NEXT_PUBLIC_APP_URL/);
    assert.doesNotMatch(postBody, /setSessionCookie\(/);
  });

  it("Super Admin UI opens enter via POST in a new tab (not GET /enter)", () => {
    const list = readSrc("src/app/(super-admin)/[saKey]/(panel)/companies/page.tsx");
    const detail = readSrc(
      "src/app/(super-admin)/[saKey]/(panel)/companies/[companyId]/page.tsx",
    );
    const form = readSrc("src/components/super-admin/enter-company-form.tsx");
    for (const src of [list, detail]) {
      assert.match(src, /EnterCompanyForm/);
      assert.doesNotMatch(src, /href=\{saHref\(`\/companies\/\$\{.*\}\/enter`\)\}/);
    }
    assert.match(form, /window\.open\("about:blank"/);
    assert.match(form, /method="POST"/);
    assert.match(form, /bidvera-sa-enter/);
    assert.doesNotMatch(form, /setPending|useState/);
    assert.doesNotMatch(form, /X-Bidvera-Enter-Mode/);
    assert.doesNotMatch(form, /target="_blank"/);
    assert.match(form, />\s*Enter account\s*</);
  });
});

describe("M2 login per-email rate limit", () => {
  it("user login uses IP and hashed-email buckets", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(src.indexOf("export async function loginAction"));
    assert.match(fn, /authRateLimiter\.check\(`login:\$\{meta\.ip/);
    assert.match(fn, /login-email:\$\{hashIdentifier\(email\)/);
    assert.match(fn, /Invalid email or password/);
  });

  it("rate-limit key is hashed, not the raw email", () => {
    const email = "Owner@Example.com";
    const key = `login-email:${hashIdentifier(email.toLowerCase())}`;
    assert.doesNotMatch(key, /owner@example\.com/i);
    assert.match(key, /^login-email:[a-f0-9]{64}$/);
  });
});

describe("M3 signup enumeration", () => {
  it("existing-account response matches a successful signup shape", () => {
    const verified = genericSignupSuccess(true);
    const open = genericSignupSuccess(false);
    assert.equal(verified.ok, true);
    assert.equal(open.ok, true);
    assert.equal(verified.onboardingStep, "VERIFY_EMAIL");
    assert.equal(open.onboardingStep, "COMPANY");
    assert.ok(verified.redirectTo.startsWith("/"));
  });

  it("createAccountAction no longer reveals that an email exists", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(
      src.indexOf("export async function createAccountAction"),
      src.indexOf("export async function signupAction"),
    );
    assert.doesNotMatch(fn, /already exists/);
    assert.doesNotMatch(fn, /ErrorCode\.CONFLICT/);
    assert.match(fn, /genericSignupSuccess\(requireVerify\)/);
  });
});

describe("M4 company settings authorization", () => {
  it("PATCH settings and learning consent require OWNER/ADMIN; GET stays read-only", () => {
    const compliance = readSrc("src/app/api/document-compliance/settings/route.ts");
    const calendar = readSrc("src/app/api/tender-calendar/settings/route.ts");
    const actions = readSrc("src/app/actions.ts");
    const complianceGet = compliance.slice(
      compliance.indexOf("export async function GET"),
      compliance.indexOf("export async function PATCH"),
    );
    assert.doesNotMatch(complianceGet, /assertCanManageCompanySettings/);
    assert.match(compliance, /assertCanManageCompanySettings\(auth\.user\.role\)/);
    assert.match(calendar, /assertCanManageCompanySettings\(auth\.user\.role\)/);
    const consent = actions.slice(
      actions.indexOf("export async function setGlobalLearningConsentAction"),
    );
    assert.match(consent, /assertCanManageCompanySettings\(auth\.user\.role\)/);
    assert.throws(() => assertCanManageCompanySettings("VIEWER"));
  });

  it("tender calendar POST/PUT/DELETE require OWNER/ADMIN; GET stays read-only", () => {
    const tenders = readSrc("src/app/api/tender-calendar/tenders/route.ts");
    const tenderId = readSrc("src/app/api/tender-calendar/tenders/[id]/route.ts");
    const milestones = readSrc("src/app/api/tender-calendar/milestones/route.ts");
    const tendersGet = tenders.slice(
      tenders.indexOf("export async function GET"),
      tenders.indexOf("export async function POST"),
    );
    assert.doesNotMatch(tendersGet, /assertCanManageCompanySettings/);
    assert.match(tenders, /assertCanManageCompanySettings\(auth\.user\.role\)/);
    for (const method of ["PUT", "DELETE", "POST"] as const) {
      const start = tenderId.indexOf(`export async function ${method}`);
      assert.ok(start >= 0, `missing ${method} on tender id route`);
      const chunk = tenderId.slice(start, start + 280);
      assert.match(chunk, /assertCanManageCompanySettings\(auth\.user\.role\)/);
    }
    assert.match(milestones, /assertCanManageCompanySettings\(auth\.user\.role\)/);
  });

  it("saveNotificationPrefsAction requires OWNER/ADMIN", () => {
    const src = readSrc("src/app/actions/reports.ts");
    const fn = src.slice(src.indexOf("export async function saveNotificationPrefsAction"));
    assert.match(fn, /assertCanManageCompanySettings\(auth\.user\.role\)/);
  });
});

describe("Public marketing does not advertise Tender Discovery", () => {
  it("landing dictionaries omit Tender Discovery product naming", () => {
    const dict = readSrc("src/i18n/dictionaries.ts");
    assert.doesNotMatch(dict, /Tender Discovery/);
    assert.doesNotMatch(dict, /Descubrimiento de licitaciones/);
    assert.doesNotMatch(dict, /招标发现/);
    assert.doesNotMatch(dict, /اكتشاف المناقصات/);
    assert.doesNotMatch(dict, /Découverte d’AO/);
    assert.doesNotMatch(dict, /découverte d’AO/);
  });
});

describe("OAuth login buttons respect Super Admin auth flags", () => {
  it("AuthForm only renders OAuth when googleEnabled / microsoftEnabled", () => {
    const src = readSrc("src/components/auth/auth-form.tsx");
    assert.match(src, /googleEnabled/);
    assert.match(src, /microsoftEnabled/);
    assert.match(src, /\{googleEnabled \?/);
    assert.match(src, /\{microsoftEnabled \?/);
    assert.match(src, /registrationEnabled/);
    // Google is live when enabled; Microsoft remains Coming Soon.
    assert.match(src, /\/api\/auth\/google\/start/);
    assert.match(src, /labels\.continueGoogle/);
    assert.match(src, /microsoftComingSoon/);
  });
});

describe("M7 production email PII logging", () => {
  it("redacts the local part and never echoes the full address", () => {
    const redacted = redactEmailForLog("owner@bidvera.com");
    assert.doesNotMatch(redacted, /owner@bidvera\.com/);
    assert.match(redacted, /\*\*\*@bidvera\.com#[a-f0-9]{12}/);
    assert.equal(redactEmailForLog(""), "unknown");
  });

  it("production email send paths log the redacted form", () => {
    const resend = readSrc("src/services/email/providers/resend.ts");
    const mailer = readSrc("src/services/email/index.ts");
    assert.match(resend, /redactEmailForLog\(payload\.to\)/);
    assert.match(mailer, /redactEmailForLog\(payload\.to\)/);
    assert.doesNotMatch(resend, /to: payload\.to/);
    assert.doesNotMatch(mailer, /to: payload\.to/);
  });
});

describe("M8 billing webhook rate limit and signature fail-fast", () => {
  it("rejects missing signature headers before provider verification", () => {
    assert.equal(hasBillingWebhookSignatureHeaders(new Headers()), false);
    assert.equal(
      hasBillingWebhookSignatureHeaders(new Headers({ "stripe-signature": "t=1,v1=x" })),
      true,
    );
    assert.equal(
      hasBillingWebhookSignatureHeaders(
        new Headers({ "paypal-transmission-id": "id-1" }),
      ),
      true,
    );
    assert.throws(
      () => assertBillingWebhookSignatureHeaders(new Headers()),
      (error: unknown) => error instanceof AppError && error.status === 400,
    );
  });

  it("webhook route rate-limits after the signature-header check", () => {
    const src = readSrc("src/app/api/billing/webhook/route.ts");
    const headerIdx = src.indexOf("assertBillingWebhookSignatureHeaders");
    const limitIdx = src.indexOf("webhookRateLimiter.check");
    const bodyIdx = src.indexOf("request.text()");
    assert.ok(headerIdx >= 0);
    assert.ok(limitIdx > headerIdx);
    assert.ok(bodyIdx > limitIdx);
    assert.match(src, /handleWebhook\(rawBody, request\.headers\)/);
  });
});

describe("M9 production memory rate-limit backend is refused", () => {
  it("flags memory backend only in production", () => {
    assert.equal(
      isUnsafeProductionMemoryRateLimit({
        NODE_ENV: "production",
        RATE_LIMIT_BACKEND: "memory",
      }),
      true,
    );
    assert.equal(
      isUnsafeProductionMemoryRateLimit({
        NODE_ENV: "development",
        RATE_LIMIT_BACKEND: "memory",
      }),
      false,
    );
    assert.equal(
      isUnsafeProductionMemoryRateLimit({
        NODE_ENV: "production",
        RATE_LIMIT_BACKEND: "durable",
      }),
      false,
    );
    assert.equal(isUnsafeProductionMemoryRateLimit({ NODE_ENV: "test" }), false);
  });
});

describe("M10 failed-login audit", () => {
  it("hashes identifiers and never includes a password", () => {
    const payload = failedLoginAuditPayload({
      email: "Owner@Example.com",
      ip: "203.0.113.10",
      scope: "user",
    });
    assert.equal(payload.emailHash, hashIdentifier("owner@example.com"));
    assert.equal(payload.ipHash, hashIdentifier("203.0.113.10"));
    assert.equal("password" in payload, false);
    assert.doesNotMatch(JSON.stringify(payload), /Owner@Example\.com/i);
  });

  it("user and Super Admin login record failures before returning 401", () => {
    const user = readSrc("src/application/auth-service.ts");
    const admin = readSrc("src/application/admin/auth-service.ts");
    assert.match(user, /recordFailedLoginAttempt/);
    assert.match(admin, /recordFailedLoginAttempt/);
    assert.match(admin, /scope: "super_admin"/);
    const helper = readSrc("src/services/auth/failed-login.ts");
    assert.match(helper, /result: "failed"/);
    assert.doesNotMatch(helper, /password/);
  });
});

describe("M11 seed Super Admin password", () => {
  it("never silently falls back to the known demo password", () => {
    assert.throws(() => resolveSeedSuperAdminPassword({ NODE_ENV: "development" }));
    assert.throws(() =>
      resolveSeedSuperAdminPassword({
        NODE_ENV: "production",
        SUPER_ADMIN_PASSWORD: "BidveraSuperAdmin1!",
      }),
    );
    assert.equal(isLocalDevelopmentSeed({ NODE_ENV: "production" }), false);
    const seed = readSrc("prisma/seed.ts");
    assert.match(seed, /resolveSeedSuperAdminPassword/);
    assert.match(seed, /resolveSeedSuperAdminEmail/);
    assert.doesNotMatch(seed, /saPassword \?\? "/);
    assert.doesNotMatch(seed, /superadmin@bidvera\.com/);
  });
});
