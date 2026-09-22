import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "crypto";
import {
  GOOGLE_OAUTH_PROVIDER,
  googleOAuthRedirectUri,
  openOAuthStateCookie,
  sealOAuthStateCookie,
  type GoogleOAuthStatePayload,
} from "@/services/auth/google-oauth";
import { safeInternalPath } from "@/domain/security/safe-redirect";

describe("google OAuth helpers", () => {
  it("builds callback URI from NEXT_PUBLIC_APP_URL", () => {
    assert.equal(
      googleOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
      }),
      "https://getbidvera.com/api/auth/google/callback",
    );
    assert.equal(
      googleOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000/",
      }),
      "http://localhost:3000/api/auth/google/callback",
    );
  });

  it("honors GOOGLE_OAUTH_REDIRECT_URI override", () => {
    assert.equal(
      googleOAuthRedirectUri({
        NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
        GOOGLE_OAUTH_REDIRECT_URI:
          "https://staging.example.com/api/auth/google/callback",
      }),
      "https://staging.example.com/api/auth/google/callback",
    );
  });

  it("seals and opens state cookies; rejects tampering and expiry", () => {
    const payload: GoogleOAuthStatePayload = {
      n: "nonce-abc",
      cv: "verifier-xyz",
      r: "/dashboard",
      t: Date.now(),
    };
    const sealed = sealOAuthStateCookie(payload);
    const opened = openOAuthStateCookie(sealed);
    assert.ok(opened);
    assert.equal(opened.n, "nonce-abc");
    assert.equal(opened.cv, "verifier-xyz");
    assert.equal(opened.r, "/dashboard");

    const [body] = sealed.split(".");
    const bad = `${body}.tampered`;
    assert.equal(openOAuthStateCookie(bad), null);

    const expired = sealOAuthStateCookie({
      ...payload,
      t: Date.now() - 20 * 60 * 1000,
    });
    assert.equal(openOAuthStateCookie(expired), null);
  });

  it("sanitizes redirect path inside sealed state", () => {
    const sealed = sealOAuthStateCookie({
      n: "n",
      cv: "c",
      r: "//evil.com",
      t: Date.now(),
    });
    const opened = openOAuthStateCookie(sealed);
    assert.ok(opened);
    assert.equal(opened.r, "/dashboard");
    assert.equal(safeInternalPath("https://evil.com", "/dashboard"), "/dashboard");
  });

  it("uses google provider constant for identity links", () => {
    assert.equal(GOOGLE_OAUTH_PROVIDER, "google");
  });

  it("HMAC helper shape is body.signature", () => {
    const sealed = sealOAuthStateCookie({
      n: "n",
      cv: "c",
      r: "/onboarding/company",
      t: Date.now(),
    });
    assert.match(sealed, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    // Signature is not a raw AUTH_SECRET echo
    assert.doesNotMatch(sealed, /AUTH_SECRET|sk_/i);
    void createHmac;
  });
});

describe("google OAuth account linking rules (source)", () => {
  it("service refuses auto-link takeover patterns and respects registration flag", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/application/google-oauth-service.ts"),
      "utf8",
    );
    assert.match(src, /registrationEnabled/);
    assert.match(src, /passwordHash:\s*null/);
    assert.match(src, /emailVerified:\s*true/);
    assert.match(src, /OAuthIdentity|oAuthIdentity/);
    assert.match(src, /providerUserId:\s*claims\.sub/);
    assert.doesNotMatch(src, /clientSecret|id_token|access_token/);
  });

  it("callback validates state and never logs tokens", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const cb = readFileSync(
      join(process.cwd(), "src/app/api/auth/google/callback/route.ts"),
      "utf8",
    );
    const start = readFileSync(
      join(process.cwd(), "src/app/api/auth/google/start/route.ts"),
      "utf8",
    );
    assert.match(cb, /openOAuthStateCookie/);
    assert.match(cb, /payload\.n !== state/);
    assert.match(cb, /verifyGoogleIdToken/);
    assert.match(cb, /applySessionCookie/);
    assert.match(start, /buildGoogleAuthorizationRequest/);
    assert.doesNotMatch(cb, /console\.(log|info|debug).*idToken|client_secret/i);
  });

  it("AuthForm enables live Google start when flag on; Microsoft stays coming soon", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/components/auth/auth-form.tsx"),
      "utf8",
    );
    assert.match(src, /\/api\/auth\/google\/start/);
    assert.match(src, /labels\.continueGoogle/);
    assert.match(src, /microsoftComingSoon/);
    assert.match(src, /oauth_error/);
  });
});
