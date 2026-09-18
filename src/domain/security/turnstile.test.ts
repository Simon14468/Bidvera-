import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  assertLoginTurnstileIfRequired,
  assertTurnstileToken,
  evaluateTurnstileSiteverify,
  extractTurnstileToken,
  getTurnstilePublicConfig,
  getTurnstileServerConfig,
  loginTurnstileRequiredFromRemaining,
  setTurnstileFetchForTests,
  TURNSTILE_SITEVERIFY_URL,
} from "@/services/security/turnstile";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const ENABLED_ENV = {
  NODE_ENV: "test",
  TURNSTILE_ENABLED: "true",
  TURNSTILE_SITE_KEY: "1x00000000000000000000BB",
  TURNSTILE_SECRET_KEY: "secret_live_never_public",
  NEXT_PUBLIC_APP_URL: "https://app.bidvera.com",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  setTurnstileFetchForTests(null);
});

describe("Turnstile configuration", () => {
  it("requires verification in production even if keys are missing (fail closed)", () => {
    const cfg = getTurnstileServerConfig({ NODE_ENV: "production" });
    assert.equal(cfg.required, true);
    assert.equal(cfg.production, true);
  });

  it("skips verification in local/test when keys are unset", () => {
    const cfg = getTurnstileServerConfig({ NODE_ENV: "test" });
    assert.equal(cfg.required, false);
    assert.equal(getTurnstileServerConfig({ NODE_ENV: "development" }).required, false);
  });

  it("never exposes the secret on the public config", () => {
    const pub = getTurnstilePublicConfig(ENABLED_ENV);
    assert.equal(pub.enabled, true);
    assert.equal(pub.siteKey, ENABLED_ENV.TURNSTILE_SITE_KEY);
    assert.equal("secretKey" in pub, false);
    assert.equal(JSON.stringify(pub).includes("secret_live_never_public"), false);
  });

  it("does not put the secret in NEXT_PUBLIC_ or client widgets", () => {
    const example = readSrc(".env.example");
    assert.match(example, /TURNSTILE_SECRET_KEY/);
    assert.match(example, /TURNSTILE_SITE_KEY/);
    assert.doesNotMatch(example, /NEXT_PUBLIC_TURNSTILE_SECRET/);
    const widget = readSrc("src/components/security/turnstile-field.tsx");
    assert.doesNotMatch(widget, /TURNSTILE_SECRET_KEY/);
    assert.doesNotMatch(widget, /verified\s*===?\s*true/);
    const pub = readSrc("src/services/security/turnstile.ts");
    assert.match(pub, /never includes the secret/);
    assert.doesNotMatch(pub, /NEXT_PUBLIC_TURNSTILE_SECRET/);
  });
});

describe("Turnstile Siteverify evaluation", () => {
  it("accepts a valid token with matching action and hostname", () => {
    const result = evaluateTurnstileSiteverify({
      result: {
        success: true,
        hostname: "app.bidvera.com",
        action: "signup",
        challenge_ts: new Date().toISOString(),
      },
      expectedAction: "signup",
      expectedHostname: "app.bidvera.com",
      skipBinding: false,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects invalid verification", () => {
    const result = evaluateTurnstileSiteverify({
      result: { success: false, "error-codes": ["invalid-input-response"] },
      expectedAction: "signup",
      expectedHostname: "app.bidvera.com",
      skipBinding: false,
    });
    assert.deepEqual(result, { ok: false, reason: "invalid" });
  });

  it("rejects expired or already-used tokens", () => {
    const duplicate = evaluateTurnstileSiteverify({
      result: { success: false, "error-codes": ["timeout-or-duplicate"] },
      expectedAction: "login",
      expectedHostname: null,
      skipBinding: false,
    });
    assert.equal(duplicate.ok, false);
    if (duplicate.ok) throw new Error("expected failure");
    assert.equal(duplicate.reason, "expired");

    const stale = evaluateTurnstileSiteverify({
      result: {
        success: true,
        action: "signup",
        hostname: "app.bidvera.com",
        challenge_ts: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      expectedAction: "signup",
      expectedHostname: "app.bidvera.com",
      skipBinding: false,
      now: Date.now(),
    });
    assert.equal(stale.ok, false);
    if (stale.ok) throw new Error("expected failure");
    assert.equal(stale.reason, "expired");
  });

  it("ignores a client verified=true flag", () => {
    assert.equal(extractTurnstileToken({ verified: true }), undefined);
    assert.equal(extractTurnstileToken({ verified: true, turnstileToken: "tok_abc" }), "tok_abc");
  });
});

describe("Turnstile server assertion", () => {
  it("rejects a missing token when Turnstile is required", async () => {
    await assert.rejects(
      () =>
        assertTurnstileToken({
          token: undefined,
          action: "signup",
          env: ENABLED_ENV,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.FORBIDDEN &&
        error.status === 403,
    );
  });

  it("rejects an invalid token from Siteverify", async () => {
    setTurnstileFetchForTests(async () =>
      jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    await assert.rejects(
      () =>
        assertTurnstileToken({
          token: "bad-token",
          action: "signup",
          env: ENABLED_ENV,
        }),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("rejects expired Siteverify results", async () => {
    setTurnstileFetchForTests(async () =>
      jsonResponse({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    );
    await assert.rejects(
      () =>
        assertTurnstileToken({
          token: "spent-token",
          action: "checkout",
          env: ENABLED_ENV,
        }),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
  });

  it("allows the protected action when Siteverify succeeds", async () => {
    let postedTo = "";
    let postedSecret = "";
    setTurnstileFetchForTests(async (url, init) => {
      postedTo = String(url);
      const body = typeof init?.body === "string" ? init.body : String(init?.body ?? "");
      postedSecret = body;
      return jsonResponse({
        success: true,
        hostname: "app.bidvera.com",
        action: "signup",
        challenge_ts: new Date().toISOString(),
      });
    });
    await assertTurnstileToken({
      token: "ok-token",
      action: "signup",
      env: ENABLED_ENV,
    });
    assert.equal(postedTo, TURNSTILE_SITEVERIFY_URL);
    assert.match(postedSecret, /secret=/);
    assert.match(postedSecret, /response=ok-token/);
  });

  it("fails closed in production when the secret is missing", async () => {
    await assert.rejects(
      () =>
        assertTurnstileToken({
          token: "ok-token",
          action: "signup",
          env: { NODE_ENV: "production", TURNSTILE_SITE_KEY: "site" },
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.UPSTREAM &&
        error.status === 503,
    );
  });
});

describe("Login challenge is conditional; other protections stay in place", () => {
  it("does not require Turnstile on the first login attempts", () => {
    assert.equal(loginTurnstileRequiredFromRemaining(30), false);
    assert.equal(loginTurnstileRequiredFromRemaining(29), false);
    assert.equal(loginTurnstileRequiredFromRemaining(28), true);
  });

  it("skips login Turnstile when remaining attempts are high and no token is sent", async () => {
    await assertLoginTurnstileIfRequired({
      token: undefined,
      remainingIp: 30,
      remainingEmail: 30,
      env: ENABLED_ENV,
    });
  });

  it("requires login Turnstile after prior attempts even with no token", async () => {
    await assert.rejects(
      () =>
        assertLoginTurnstileIfRequired({
          token: "",
          remainingIp: 28,
          remainingEmail: 30,
          env: ENABLED_ENV,
        }),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
  });

  it("wires Turnstile after existing rate limits on protected actions", () => {
    const auth = readSrc("src/application/auth-service.ts");
    const signup = auth.slice(auth.indexOf("export async function createAccountAction"));
    const signupLimit = signup.indexOf("authRateLimiter.check");
    const signupTurnstile = signup.indexOf('action: "signup"');
    assert.ok(signupLimit >= 0);
    assert.ok(signupTurnstile > signupLimit);

    const login = auth.slice(auth.indexOf("export async function loginAction"));
    assert.match(login, /authRateLimiter\.check\(`login:\$\{meta\.ip/);
    assert.match(login, /assertLoginTurnstileIfRequired/);
    assert.match(login, /verifyPasswordAgainstKnownOrDummy/);

    const trial = auth.slice(auth.indexOf("export async function activateFreeOrTrialPlanAction"));
    const trialTurnstile = trial.indexOf('action: "trial"');
    const trialRisk = trial.indexOf("assessTrialRisk");
    assert.ok(trialTurnstile >= 0);
    assert.ok(trialRisk > trialTurnstile);

    const checkout = readSrc("src/app/actions.ts");
    const start = checkout.slice(checkout.indexOf("export async function startCheckoutAction"));
    assert.match(start, /assertCanManageBilling/);
    assert.match(start, /assertTurnstileToken/);
    assert.match(start, /createCheckoutSession/);
    const turnstileIdx = start.indexOf("assertTurnstileToken");
    const sessionIdx = start.indexOf("createCheckoutSession");
    assert.ok(turnstileIdx >= 0 && sessionIdx > turnstileIdx);
  });

  it("does not replace trial risk scoring", () => {
    const auth = readSrc("src/application/auth-service.ts");
    assert.match(auth, /assessTrialRisk/);
    assert.match(auth, /enforceTrialGrantPolicy/);
    assert.match(auth, /persistTrialRisk/);
    const risk = readSrc("src/services/trial/risk.ts");
    assert.match(risk, /ipVelocity/);
    assert.match(risk, /Single signals never hard-block/);
  });
});
