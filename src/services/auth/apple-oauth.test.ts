import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, generateKeyPairSync } from "crypto";
import { importSPKI, jwtVerify } from "jose";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  APPLE_AUTHORIZE_URL,
  APPLE_ISSUER,
  APPLE_OAUTH_PROVIDER,
  APPLE_OAUTH_SCOPES,
  appleIdClaimsFromPayload,
  appleOAuthRedirectUri,
  createAppleClientSecret,
  extractAppleEmail,
  isAppleEmailExplicitlyUnverified,
  isApplePrivateRelayEmail,
  normalizeApplePrivateKey,
  parseAppleUserName,
  verifyAppleIdToken,
} from "@/services/auth/apple-oauth";
import { safeInternalPath } from "@/domain/security/safe-redirect";

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("apple OAuth helpers", () => {
  it("builds callback URI from NEXT_PUBLIC_APP_URL", () => {
    assert.equal(
      appleOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
      }),
      "https://getbidvera.com/api/auth/apple/callback",
    );
    assert.equal(
      appleOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000/",
      }),
      "http://localhost:3000/api/auth/apple/callback",
    );
  });

  it("honors APPLE_OAUTH_REDIRECT_URI override", () => {
    assert.equal(
      appleOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
        APPLE_OAUTH_REDIRECT_URI:
          "https://staging.example.com/api/auth/apple/callback",
      }),
      "https://staging.example.com/api/auth/apple/callback",
    );
  });

  it("uses apple provider and name email scopes only", () => {
    assert.equal(APPLE_OAUTH_PROVIDER, "apple");
    assert.equal(APPLE_OAUTH_SCOPES, "name email");
    assert.equal(APPLE_AUTHORIZE_URL, "https://appleid.apple.com/auth/authorize");
  });

  it("accepts Apple private relay addresses", () => {
    assert.equal(
      isApplePrivateRelayEmail("abc123@privaterelay.appleid.com"),
      true,
    );
    assert.equal(isApplePrivateRelayEmail("owner@contoso.com"), false);
    const claims = appleIdClaimsFromPayload({
      sub: "001234.abc",
      email: "abc123@privaterelay.appleid.com",
      email_verified: "true",
    });
    assert.equal(claims.email, "abc123@privaterelay.appleid.com");
    assert.equal(claims.emailVerified, true);
  });
});

describe("apple ID token identity mapping", () => {
  it("extracts a usable email and rejects missing/invalid email", () => {
    assert.equal(extractAppleEmail({ email: "Owner@Example.com" }), "owner@example.com");
    assert.equal(extractAppleEmail({}), "");
    assert.throws(
      () => appleIdClaimsFromPayload({ sub: "apple-sub" }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.VALIDATION &&
        /usable email/i.test(error.message),
    );
    assert.throws(
      () => appleIdClaimsFromPayload({ sub: "apple-sub", email: "not-an-email" }),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.VALIDATION,
    );
  });

  it("rejects explicitly unverified email (account-linking safety)", () => {
    assert.equal(isAppleEmailExplicitlyUnverified({ email_verified: false }), true);
    assert.equal(isAppleEmailExplicitlyUnverified({ email_verified: "false" }), true);
    assert.equal(isAppleEmailExplicitlyUnverified({ email_verified: "true" }), false);
    assert.throws(
      () =>
        appleIdClaimsFromPayload({
          sub: "apple-sub",
          email: "a@b.com",
          email_verified: false,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("accepts signed ID-token email as verified identity", () => {
    const claims = appleIdClaimsFromPayload({
      sub: "001234.stable",
      email: "owner@icloud.com",
    });
    assert.equal(claims.sub, "001234.stable");
    assert.equal(claims.email, "owner@icloud.com");
    assert.equal(claims.emailVerified, true);
    assert.equal(claims.name, null);
  });

  it("rejects an invalid ID token", async () => {
    await assert.rejects(
      () => verifyAppleIdToken("not-a-valid-id-token", "com.bidvera.web"),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.UNAUTHENTICATED,
    );
  });

  it("rejects nonce mismatch (raw or sha256)", () => {
    assert.throws(
      () =>
        appleIdClaimsFromPayload(
          { sub: "s", email: "a@b.com", nonce: "other" },
          "expected",
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === ErrorCode.UNAUTHENTICATED,
    );
    const expected = "nonce-value";
    const hashed = createHash("sha256").update(expected).digest("hex");
    const claims = appleIdClaimsFromPayload(
      { sub: "s", email: "a@b.com", nonce: hashed },
      expected,
    );
    assert.equal(claims.email, "a@b.com");
  });
});

describe("apple first-authorization name", () => {
  it("parses name only when Apple sends the user form payload", () => {
    assert.equal(
      parseAppleUserName(
        JSON.stringify({ name: { firstName: "Ada", lastName: "Lovelace" } }),
      ),
      "Ada Lovelace",
    );
    assert.equal(parseAppleUserName(null), null);
    assert.equal(parseAppleUserName(""), null);
    assert.equal(parseAppleUserName("{not-json"), null);
    assert.equal(
      parseAppleUserName(JSON.stringify({ email: "a@b.com" })),
      null,
    );
  });
});

describe("apple client_secret JWT", () => {
  it("signs a short-lived ES256 JWT and never embeds the PEM", async () => {
    const pair = generateKeyPairSync("ec", {
      namedCurve: "P-256",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const token = await createAppleClientSecret({
      clientId: "com.bidvera.web",
      teamId: "TEAM12ID34",
      keyId: "KEYID12345",
      privateKey: pair.privateKey,
    });
    assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.doesNotMatch(token, /BEGIN PRIVATE KEY|APPLE_PRIVATE_KEY/i);
    const verifyKey = await importSPKI(pair.publicKey, "ES256");
    const { payload, protectedHeader } = await jwtVerify(token, verifyKey, {
      issuer: "TEAM12ID34",
      audience: APPLE_ISSUER,
      subject: "com.bidvera.web",
    });
    assert.equal(protectedHeader.alg, "ES256");
    assert.equal(protectedHeader.kid, "KEYID12345");
    assert.equal(payload.iss, "TEAM12ID34");
    assert.equal(payload.sub, "com.bidvera.web");
    void normalizeApplePrivateKey;
  });

  it("rejects an unusable private key without leaking it", async () => {
    await assert.rejects(
      () =>
        createAppleClientSecret({
          clientId: "com.bidvera.web",
          teamId: "TEAM12ID34",
          keyId: "KEYID12345",
          privateKey: "not-a-key",
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.FORBIDDEN &&
        !/not-a-key|BEGIN/.test(error.message),
    );
  });
});

describe("apple OAuth start route", () => {
  it("builds Apple authorize URL, sets state cookie, and fails closed without credentials", () => {
    const start = readSrc("src/app/api/auth/apple/start/route.ts");
    const svc = readSrc("src/services/auth/apple-oauth.ts");
    assert.match(start, /buildAppleAuthorizationRequest/);
    assert.match(start, /APPLE_OAUTH_STATE_COOKIE/);
    assert.match(start, /oauth-apple-start/);
    assert.match(start, /Apple sign-in is not available/);
    assert.match(svc, /response_mode:\s*"form_post"/);
    assert.match(svc, /response_type:\s*"code"/);
    assert.match(svc, /resolveAppleOAuthCredentials/);
    assert.doesNotMatch(start, /privateKey|client_secret|APPLE_PRIVATE_KEY|console\.(log|info|debug)/);
  });
});

describe("apple OAuth callback route", () => {
  it("validates state, handles OAuth error, and creates the same Bidvera session as Google", () => {
    const cb = readSrc("src/app/api/auth/apple/callback/route.ts");
    assert.match(cb, /export async function GET/);
    assert.match(cb, /export async function POST/);
    assert.match(cb, /openOAuthStateCookie|resolveAppleState/);
    assert.match(cb, /Apple sign-in expired/);
    assert.match(cb, /access_denied|user_cancelled_authorize/);
    assert.match(cb, /verifyAppleIdToken/);
    assert.match(cb, /completeAppleOAuthLogin/);
    assert.match(cb, /applySessionCookie/);
    assert.match(cb, /exchangeAppleAuthorizationCode/);
    assert.match(cb, /parseAppleUserName/);
    assert.doesNotMatch(cb, /console\.(log|info|debug).*idToken|privateKey|client_secret/i);
  });
});

describe("apple OAuth account linking (shared with Google)", () => {
  it("reuses shared session/account rules — existing identity, email link, signup", () => {
    const shared = readSrc("src/application/oauth-account-service.ts");
    const apple = readSrc("src/application/apple-oauth-service.ts");
    assert.match(apple, /completeOAuthLogin/);
    assert.match(apple, /APPLE_OAUTH_PROVIDER/);
    assert.match(shared, /registrationEnabled/);
    assert.match(shared, /passwordHash:\s*null/);
    assert.match(shared, /emailVerified:\s*true/);
    assert.match(shared, /OAuthIdentity|oAuthIdentity/);
    assert.match(shared, /providerUserId:\s*claims\.sub/);
    assert.match(shared, /Does not overwrite passwordHash/);
    assert.match(shared, /createSession/);
    assert.doesNotMatch(shared, /APPLE_PRIVATE_KEY|client_secret|privateKey/);
  });
});

describe("appleEnabled button behavior", () => {
  it("AuthForm shows a live Apple start link only when appleEnabled is true", () => {
    const src = readSrc("src/components/auth/auth-form.tsx");
    assert.match(src, /\/api\/auth\/apple\/start/);
    assert.match(src, /labels\.continueApple/);
    assert.match(src, /\{appleEnabled \?/);
    assert.doesNotMatch(src, /appleComingSoon|coming soon/i);
  });

  it("login and signup hide the button unless credentials resolve", () => {
    const login = readSrc("src/app/(marketing)/(auth)/login/page.tsx");
    const signup = readSrc("src/app/(marketing)/(auth)/signup/page.tsx");
    assert.match(login, /resolveAppleOAuthCredentials/);
    assert.match(login, /appleEnabled=\{appleReady\}/);
    assert.match(signup, /resolveAppleOAuthCredentials/);
    assert.match(signup, /appleEnabled=\{appleReady\}/);
  });

  it("middleware treats Apple start/callback as public", () => {
    const mw = readSrc("src/middleware.ts");
    assert.match(mw, /"\/api\/auth\/apple\/start"/);
    assert.match(mw, /"\/api\/auth\/apple\/callback"/);
  });

  it("Super Admin stores Apple identifiers and a vaulted private key", () => {
    const settings = readSrc("src/services/auth/settings.ts");
    const admin = readSrc("src/components/super-admin/auth-admin.tsx");
    assert.match(settings, /AUTH_APPLE_VAULT_KEY\s*=\s*"auth\.apple\.vault"/);
    assert.match(settings, /appleEnabled/);
    assert.match(settings, /appleClientId/);
    assert.match(settings, /resolveAppleOAuthCredentials/);
    assert.match(settings, /APPLE_CLIENT_ID/);
    assert.match(settings, /APPLE_TEAM_ID/);
    assert.match(settings, /APPLE_KEY_ID/);
    assert.match(settings, /APPLE_PRIVATE_KEY/);
    assert.match(admin, /Apple login/);
    assert.match(admin, /appleEnabled/);
    assert.doesNotMatch(settings, /console\.(log|info|debug)/);
  });
});

describe("apple redirect sanitization", () => {
  it("uses the same safeInternalPath default as Google", () => {
    assert.equal(safeInternalPath("//evil.com", "/dashboard"), "/dashboard");
    assert.equal(safeInternalPath("/tenders", "/dashboard"), "/tenders");
  });
});
