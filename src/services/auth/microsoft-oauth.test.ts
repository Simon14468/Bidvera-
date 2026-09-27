import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  MICROSOFT_AUTHORITY_ORIGIN,
  MICROSOFT_DEFAULT_TENANT,
  MICROSOFT_OAUTH_PROVIDER,
  MICROSOFT_OAUTH_SCOPES,
  extractMicrosoftEmail,
  isMicrosoftEmailExplicitlyUnverified,
  isValidMicrosoftIssuer,
  microsoftAuthority,
  microsoftIdClaimsFromPayload,
  microsoftOAuthRedirectUri,
  resolveMicrosoftTenantId,
} from "@/services/auth/microsoft-oauth";
import { safeInternalPath } from "@/domain/security/safe-redirect";

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const SAMPLE_TID = "11111111-2222-3333-4444-555555555555";

describe("microsoft OAuth helpers", () => {
  it("builds callback URI from NEXT_PUBLIC_APP_URL", () => {
    assert.equal(
      microsoftOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
      }),
      "https://getbidvera.com/api/auth/microsoft/callback",
    );
    assert.equal(
      microsoftOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000/",
      }),
      "http://localhost:3000/api/auth/microsoft/callback",
    );
  });

  it("honors MICROSOFT_OAUTH_REDIRECT_URI override", () => {
    assert.equal(
      microsoftOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
        MICROSOFT_OAUTH_REDIRECT_URI:
          "https://staging.example.com/api/auth/microsoft/callback",
      }),
      "https://staging.example.com/api/auth/microsoft/callback",
    );
  });

  it("defaults tenant to common and rejects unsafe tenant values", () => {
    assert.equal(resolveMicrosoftTenantId({}), MICROSOFT_DEFAULT_TENANT);
    assert.equal(resolveMicrosoftTenantId({ MICROSOFT_TENANT_ID: "common" }), "common");
    assert.equal(
      resolveMicrosoftTenantId({ MICROSOFT_TENANT_ID: "organizations" }),
      "organizations",
    );
    assert.equal(
      resolveMicrosoftTenantId({ MICROSOFT_TENANT_ID: "consumers" }),
      "consumers",
    );
    assert.equal(
      resolveMicrosoftTenantId({ MICROSOFT_TENANT_ID: SAMPLE_TID }),
      SAMPLE_TID,
    );
    assert.equal(
      resolveMicrosoftTenantId({ MICROSOFT_TENANT_ID: "../evil" }),
      "common",
    );
    assert.equal(
      microsoftAuthority("common"),
      `${MICROSOFT_AUTHORITY_ORIGIN}/common`,
    );
  });

  it("uses microsoft provider and openid profile email scopes only", () => {
    assert.equal(MICROSOFT_OAUTH_PROVIDER, "microsoft");
    assert.equal(MICROSOFT_OAUTH_SCOPES, "openid profile email");
    assert.doesNotMatch(MICROSOFT_OAUTH_SCOPES, /User\.Read/);
  });
});

describe("microsoft ID token identity mapping", () => {
  it("extracts email claim, then preferred_username when it is an email", () => {
    assert.equal(
      extractMicrosoftEmail({ email: "Owner@Example.com" }),
      "owner@example.com",
    );
    assert.equal(
      extractMicrosoftEmail({ preferred_username: "user@contoso.com" }),
      "user@contoso.com",
    );
    assert.equal(
      extractMicrosoftEmail({ preferred_username: "+15551234567" }),
      "",
    );
    assert.equal(extractMicrosoftEmail({}), "");
  });

  it("rejects missing or invalid email", () => {
    assert.throws(
      () => microsoftIdClaimsFromPayload({ sub: "oid-1" }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.VALIDATION &&
        /usable email/i.test(error.message),
    );
    assert.throws(
      () =>
        microsoftIdClaimsFromPayload({
          sub: "oid-1",
          preferred_username: "not-an-email",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.VALIDATION,
    );
  });

  it("rejects explicitly unverified email (account-linking safety)", () => {
    assert.equal(
      isMicrosoftEmailExplicitlyUnverified({ email_verified: false }),
      true,
    );
    assert.equal(isMicrosoftEmailExplicitlyUnverified({ xms_edov: false }), true);
    assert.equal(isMicrosoftEmailExplicitlyUnverified({ email: "a@b.com" }), false);
    assert.throws(
      () =>
        microsoftIdClaimsFromPayload({
          sub: "oid-1",
          email: "a@b.com",
          email_verified: false,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("accepts signed ID-token email as verified identity", () => {
    const claims = microsoftIdClaimsFromPayload({
      sub: "stable-sub",
      email: "owner@contoso.com",
      name: "Owner",
    });
    assert.equal(claims.sub, "stable-sub");
    assert.equal(claims.email, "owner@contoso.com");
    assert.equal(claims.emailVerified, true);
    assert.equal(claims.name, "Owner");
  });

  it("rejects nonce mismatch", () => {
    assert.throws(
      () =>
        microsoftIdClaimsFromPayload(
          { sub: "s", email: "a@b.com", nonce: "other" },
          "expected",
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.UNAUTHENTICATED,
    );
  });

  it("validates issuer against tid and configured tenant", () => {
    const iss = `${MICROSOFT_AUTHORITY_ORIGIN}/${SAMPLE_TID}/v2.0`;
    assert.equal(isValidMicrosoftIssuer(iss, SAMPLE_TID, "common"), true);
    assert.equal(isValidMicrosoftIssuer(iss, SAMPLE_TID, "organizations"), true);
    assert.equal(isValidMicrosoftIssuer(iss, SAMPLE_TID, SAMPLE_TID), true);
    assert.equal(
      isValidMicrosoftIssuer(iss, SAMPLE_TID, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
      false,
    );
    assert.equal(
      isValidMicrosoftIssuer("https://evil.example/v2.0", SAMPLE_TID, "common"),
      false,
    );
    assert.equal(isValidMicrosoftIssuer(iss, "not-a-guid", "common"), false);
  });
});

describe("microsoft OAuth start route", () => {
  it("builds Entra authorize URL, sets state cookie, and fails closed without credentials", () => {
    const start = readSrc("src/app/api/auth/microsoft/start/route.ts");
    assert.match(start, /buildMicrosoftAuthorizationRequest/);
    assert.match(start, /MICROSOFT_OAUTH_STATE_COOKIE/);
    assert.match(start, /oauth-microsoft-start/);
    assert.match(start, /oauth_error/);
    assert.match(start, /Microsoft sign-in is not available/);
    assert.doesNotMatch(start, /client_secret|clientSecret|console\.(log|info|debug)/);
  });
});

describe("microsoft OAuth callback route", () => {
  it("validates state, handles OAuth error, and creates the same Bidvera session as Google", () => {
    const cb = readSrc("src/app/api/auth/microsoft/callback/route.ts");
    assert.match(cb, /openOAuthStateCookie/);
    assert.match(cb, /payload\.n !== state/);
    assert.match(cb, /Microsoft sign-in expired/);
    assert.match(cb, /access_denied/);
    assert.match(cb, /Microsoft sign-in was cancelled/);
    assert.match(cb, /verifyMicrosoftIdToken/);
    assert.match(cb, /completeMicrosoftOAuthLogin/);
    assert.match(cb, /applySessionCookie/);
    assert.match(cb, /exchangeMicrosoftAuthorizationCode/);
    assert.doesNotMatch(cb, /console\.(log|info|debug).*idToken|client_secret/i);
  });

  it("does not request User.Read", () => {
    const svc = readSrc("src/services/auth/microsoft-oauth.ts");
    assert.match(svc, /openid profile email/);
    assert.doesNotMatch(svc, /User\.Read/);
    assert.doesNotMatch(svc, /graph\.microsoft\.com/);
  });
});

describe("microsoft OAuth account linking (shared with Google)", () => {
  it("reuses shared session/account rules — existing identity, email link, signup, registration flag", () => {
    const shared = readSrc("src/application/oauth-account-service.ts");
    const ms = readSrc("src/application/microsoft-oauth-service.ts");
    const google = readSrc("src/application/google-oauth-service.ts");
    assert.match(ms, /completeOAuthLogin/);
    assert.match(ms, /MICROSOFT_OAUTH_PROVIDER/);
    assert.match(google, /completeOAuthLogin/);
    assert.match(google, /GOOGLE_OAUTH_PROVIDER/);
    assert.match(shared, /registrationEnabled/);
    assert.match(shared, /passwordHash:\s*null/);
    assert.match(shared, /emailVerified:\s*true/);
    assert.match(shared, /OAuthIdentity|oAuthIdentity/);
    assert.match(shared, /providerUserId:\s*claims\.sub/);
    assert.match(shared, /Does not overwrite passwordHash/);
    assert.match(shared, /createSession/);
    assert.doesNotMatch(shared, /clientSecret|id_token|access_token/);
  });
});

describe("microsoftEnabled button behavior", () => {
  it("AuthForm shows a live Microsoft start link only when microsoftEnabled is true", () => {
    const src = readSrc("src/components/auth/auth-form.tsx");
    assert.match(src, /\/api\/auth\/microsoft\/start/);
    assert.match(src, /labels\.continueMicrosoft/);
    assert.match(src, /\{microsoftEnabled \?/);
    assert.doesNotMatch(src, /microsoftComingSoon/);
    assert.doesNotMatch(src, /coming soon/i);
  });

  it("login and signup hide the button unless credentials resolve", () => {
    const login = readSrc("src/app/(marketing)/(auth)/login/page.tsx");
    const signup = readSrc("src/app/(marketing)/(auth)/signup/page.tsx");
    assert.match(login, /resolveMicrosoftOAuthCredentials/);
    assert.match(login, /microsoftEnabled=\{microsoftReady\}/);
    assert.match(signup, /resolveMicrosoftOAuthCredentials/);
    assert.match(signup, /microsoftEnabled=\{microsoftReady\}/);
  });

  it("middleware treats Microsoft start/callback as public", () => {
    const mw = readSrc("src/middleware.ts");
    assert.match(mw, /"\/api\/auth\/microsoft\/start"/);
    assert.match(mw, /"\/api\/auth\/microsoft\/callback"/);
  });
});

describe("microsoft redirect sanitization", () => {
  it("uses the same safeInternalPath default as Google", () => {
    assert.equal(safeInternalPath("//evil.com", "/dashboard"), "/dashboard");
    assert.equal(safeInternalPath("/tenders", "/dashboard"), "/tenders");
  });
});
