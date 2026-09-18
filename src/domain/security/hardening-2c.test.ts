import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { createAccountSchema, loginSchema, PASSWORD_MIN_LENGTH, resetPasswordSchema } from "@/domain/schemas";
import {
  DECISION_GUARDIAN_CLIENT_MESSAGE,
  toSafeClientError,
} from "@/lib/errors";
import {
  HTTP_BODY_SIZE_LIMIT,
  HTTP_BODY_SIZE_LIMIT_BYTES,
  UPLOAD_LIMITS,
} from "@/config/server";
import { middleware } from "@/middleware";
import { sanitizeAuditMetadata } from "@/services/billing/audit";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("M5 revocable report shares", () => {
  it("stores hashed opaque tokens and supports tenant-scoped revocation", () => {
    const service = readSrc("src/services/reports/share-token.ts");
    assert.match(service, /prisma\.reportShare\.create/);
    assert.match(service, /hashToken\(token\)/);
    assert.match(service, /revokedAt/);
    assert.match(service, /revokeReportSharesForTender/);
    assert.match(service, /where:\s*\{[\s\S]*companyId[\s\S]*tenderId/);
    const actions = readSrc("src/app/actions/reports.ts");
    assert.match(actions, /await createReportShareToken/);
    assert.match(actions, /revokeReportSharesForTender\(companyId, tenderId\)/);
    assert.match(readSrc("src/app/share/report/[token]/page.tsx"), /await verifyReportShareToken/);
  });
});

describe("M6 request body limit", () => {
  it("aligns Next.js body protection with the 25MB file / 100MB package product caps", () => {
    assert.equal(UPLOAD_LIMITS.maxFileBytes, 25 * 1024 * 1024);
    assert.ok(UPLOAD_LIMITS.maxPackageBytes <= HTTP_BODY_SIZE_LIMIT_BYTES);
    assert.equal(HTTP_BODY_SIZE_LIMIT, "110mb");
    assert.ok(HTTP_BODY_SIZE_LIMIT_BYTES < 130 * 1024 * 1024);
    const nextConfig = readSrc("next.config.ts");
    assert.doesNotMatch(nextConfig, /130mb/);
    assert.match(nextConfig, /HTTP_BODY_SIZE_LIMIT/);
    assert.ok(25 * 1024 * 1024 < HTTP_BODY_SIZE_LIMIT_BYTES);
  });

  it("documents that oversized bodies are rejected by the 110mb ceiling", () => {
    const oversize = 130 * 1024 * 1024;
    assert.equal(oversize > HTTP_BODY_SIZE_LIMIT_BYTES, true);
    assert.equal(25 * 1024 * 1024 > HTTP_BODY_SIZE_LIMIT_BYTES, false);
  });
});

describe("L1 login timing", () => {
  it("always runs bcrypt compare, including missing-user paths", () => {
    const login = readSrc("src/application/auth-service.ts");
    const fn = login.slice(login.indexOf("export async function loginAction"));
    assert.match(fn, /verifyPasswordAgainstKnownOrDummy/);
    assert.doesNotMatch(
      fn.slice(0, fn.indexOf("throw new AppError(ErrorCode.UNAUTHENTICATED")),
      /verifyPassword\(data\.password, user\.passwordHash\)/,
    );
    const password = readSrc("src/auth/password.ts");
    assert.match(password, /DUMMY_PASSWORD_HASH/);
    assert.match(password, /bcrypt\.compare/);
    assert.match(password, /ROUNDS = 12/);
  });
});

describe("L2 password policy", () => {
  it("enforces 12+ characters on new and reset passwords, not login", () => {
    assert.equal(PASSWORD_MIN_LENGTH, 12);
    assert.throws(() =>
      createAccountSchema.parse({
        email: "a@b.com",
        password: "password1",
        acceptTerms: true,
      }),
    );
    assert.doesNotThrow(() =>
      createAccountSchema.parse({
        email: "a@b.com",
        password: "password12ab",
        acceptTerms: true,
      }),
    );
    assert.throws(() =>
      resetPasswordSchema.parse({ token: "x".repeat(20), password: "shortpass" }),
    );
    assert.doesNotThrow(() =>
      loginSchema.parse({ email: "a@b.com", password: "old8chr!" }),
    );
    const login = readSrc("src/application/auth-service.ts");
    const loginFn = login.slice(login.indexOf("export async function loginAction"));
    assert.doesNotMatch(loginFn, /PASSWORD_MIN_LENGTH/);
    assert.doesNotMatch(loginFn, /at least 12/);
  });
});

describe("L3 revoke other sessions", () => {
  it("deletes other sessions for the same user and keeps the current session", () => {
    const session = readSrc("src/auth/session.ts");
    const fn = session.slice(session.indexOf("export async function revokeOtherSessions"));
    assert.match(fn, /userId/);
    assert.match(fn, /id:\s*\{\s*not:\s*currentSessionId/);
    assert.doesNotMatch(fn, /clearSessionCookie/);
    const action = readSrc("src/application/auth-service.ts");
    assert.match(action, /revokeOtherSessions\(ctx\.user\.id, ctx\.sessionId\)/);
    const settings = readSrc("src/app/(app)/settings/page.tsx");
    assert.match(settings, /revokeOtherSessions/);
  });
});

describe("L4 billing audit sanitizer casing", () => {
  it("redacts sensitive keys regardless of case", () => {
    const out = sanitizeAuditMetadata({
      apiKey: "sk_live_aaa",
      APIKEY: "sk_live_bbb",
      rawPayload: "{\"card\":\"4242\"}",
      RawPayload: "secret-json",
      fingerprint: "fp_123",
      CVC: "123",
      plan: "pro",
    });
    assert.equal("apiKey" in out, false);
    assert.equal("APIKEY" in out, false);
    assert.equal("rawPayload" in out, false);
    assert.equal("RawPayload" in out, false);
    assert.equal("fingerprint" in out, false);
    assert.equal("CVC" in out, false);
    assert.equal(out.plan, "pro");
  });
});

describe("L5 DecisionGuardian client errors", () => {
  it("returns a generic client message without internal codes or explanations", () => {
    const error = new Error(
      "Decision Guardian blocked release: [REPORT_DATASET_MISMATCH] Web/PDF mismatch",
    );
    error.name = "DecisionGuardianError";
    (error as Error & { result: { blockingFailures: Array<{ validationCode: string; explanation: string }> } }).result =
      {
        blockingFailures: [
          {
            validationCode: "REPORT_DATASET_MISMATCH",
            explanation: "Web/PDF mismatch",
          },
        ],
      };
    const safe = toSafeClientError(error);
    assert.equal(safe.status, 409);
    assert.equal(safe.code, "DECISION_GUARDIAN_FAILED");
    assert.equal(safe.message, DECISION_GUARDIAN_CLIENT_MESSAGE);
    assert.doesNotMatch(safe.message, /REPORT_DATASET|mismatch|Guardian blocked/i);
    const page = readSrc("src/app/(app)/tenders/[id]/report/page.tsx");
    const guardianUi = page.slice(page.lastIndexOf("if (error instanceof DecisionGuardianError)"));
    assert.match(guardianUi, /reportNotReadyBody/);
    assert.doesNotMatch(guardianUi, /body=\{error\.message\}/);
  });
});

describe("L7 share-download filename", () => {
  it("uses the shared sanitizer on the public share download route", () => {
    const src = readSrc(
      "src/app/api/share/client-request/[token]/files/[itemId]/route.ts",
    );
    assert.match(src, /safeContentDispositionFilename/);
    assert.doesNotMatch(src, /fileName\.replace\(/);
  });
});

describe("L8 assistant middleware defense-in-depth", () => {
  it("does not skip /api/assistant from the session cookie gate", () => {
    const src = readSrc("src/middleware.ts");
    assert.doesNotMatch(src, /\/api\/assistant\//);
  });

  it("rejects unauthenticated assistant requests at the edge", async () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/ask", {
      method: "POST",
    });
    const response = middleware(request);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "Unauthenticated");
  });

  it("lets cookie-bearing assistant requests through to route-level auth", () => {
    const request = new NextRequest("http://localhost:3000/api/assistant/tts", {
      method: "POST",
      headers: { cookie: "bidvera_session=opaque-session-token" },
    });
    const response = middleware(request);
    assert.notEqual(response.status, 401);
    const ask = readSrc("src/app/api/assistant/ask/route.ts");
    const tts = readSrc("src/app/api/assistant/tts/route.ts");
    for (const src of [ask, tts]) {
      assert.match(src, /resolveAuthContext/);
      assert.match(src, /ErrorCode\.UNAUTHENTICATED/);
      assert.match(src, /auth\?\.user\?\.id/);
    }
  });
});
