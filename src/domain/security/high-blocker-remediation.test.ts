/**
 * Regression tests for HIGH auth blockers remediated in this pass.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertJobPayloadHasNoAuthBearer,
  EMAIL_CHANGE_UNAVAILABLE_MESSAGE,
  isAuthMailJobPayload,
} from "@/services/auth/tokens";
import { AppError } from "@/lib/errors";
import { encryptDeliverySecret, decryptDeliverySecret } from "@/lib/delivery-secret";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H-AUDIT-02 signup cookie oracle", () => {
  it("existing-email path hashes password and sets decoy session cookie", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(src.indexOf("export async function createAccountAction"));
    const existingBlock = fn.slice(
      fn.indexOf("if (existing)"),
      fn.indexOf("const passwordHash = await hashPassword"),
    );
    assert.match(existingBlock, /hashPassword\(data\.password\)/);
    assert.match(existingBlock, /SESSION\.cookieName/);
    assert.match(existingBlock, /generateToken\(32\)/);
    assert.match(existingBlock, /genericSignupSuccess/);
    assert.doesNotMatch(existingBlock, /createSession\(/);
  });
});

describe("H-AUDIT-03 job-payload tokens", () => {
  it("auth mail jobs use opaque tokenId references", () => {
    const src = readSrc("src/services/auth/tokens.ts");
    assert.match(src, /authMail:\s*\{\s*kind:/);
    assert.match(src, /deliverySecretEnc/);
    assert.match(src, /encryptDeliverySecret/);
    assert.match(src, /assertJobPayloadHasNoAuthBearer/);
    const enqueueStart = src.indexOf("async function enqueueAuthMailJob");
    const enqueueEnd = src.indexOf("export async function materializeAuthMailJob");
    const enqueue = src.slice(enqueueStart, enqueueEnd);
    assert.match(enqueue, /tokenId: input\.tokenId/);
    assert.doesNotMatch(enqueue, /html:\s*/);
    assert.doesNotMatch(enqueue, /template\.html/);
  });

  it("rejects payloads that embed ?token=", () => {
    assert.throws(
      () =>
        assertJobPayloadHasNoAuthBearer({
          html: '<a href="https://x/verify-email?token=abc">x</a>',
        }),
      (e: unknown) => e instanceof AppError,
    );
    assert.doesNotThrow(() =>
      assertJobPayloadHasNoAuthBearer({
        authMail: { kind: "verification", tokenId: "cuid_x" },
      }),
    );
  });

  it("isAuthMailJobPayload accepts only opaque refs", () => {
    assert.equal(
      isAuthMailJobPayload({ authMail: { kind: "verification", tokenId: "t1" } }),
      true,
    );
    assert.equal(
      isAuthMailJobPayload({ to: "a@b.c", subject: "x", html: "<p>hi</p>" }),
      false,
    );
  });

  it("delivery secret round-trips and worker refuses legacy token HTML", () => {
    const enc = encryptDeliverySecret("raw-bearer-token");
    assert.equal(decryptDeliverySecret(enc), "raw-bearer-token");
    const worker = readSrc("src/worker/index.ts");
    assert.match(worker, /materializeAuthMailJob/);
    assert.match(worker, /Refusing SEND_EMAIL payload that embeds auth tokens/);
  });
});

describe("H-AUDIT-04 email-existence oracle", () => {
  it("email-change uses generic unavailable message", () => {
    const src = readSrc("src/services/auth/tokens.ts");
    assert.match(src, /EMAIL_CHANGE_UNAVAILABLE_MESSAGE/);
    assert.doesNotMatch(src, /That email is already in use/);
    assert.equal(
      EMAIL_CHANGE_UNAVAILABLE_MESSAGE.includes("already"),
      false,
    );
  });

  it("signup existing path returns genericSignupSuccess", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(src.indexOf("export async function createAccountAction"));
    assert.match(fn, /genericSignupSuccess\(requireVerify\)/);
  });
});

describe("H-AUDIT-05 Super Admin enter claim", () => {
  it("ticket design stores jti only — no session bearer in mint payload", () => {
    const src = readSrc("src/auth/sa-enter-claim.ts");
    assert.match(src, /jti:\s*row\.id/);
    assert.match(src, /encryptDeliverySecret\(sessionToken\)/);
    assert.match(src, /consumeSaEnterClaim/);
    assert.match(src, /usedAt:\s*null/);
    assert.doesNotMatch(src, /st:\s*sessionToken/);
    assert.match(src, /if \("st" in/);
  });

  it("claim route uses consumeSaEnterClaim (single-use)", () => {
    const route = readSrc("src/app/api/sa-enter-claim/route.ts");
    assert.match(route, /consumeSaEnterClaim/);
    assert.doesNotMatch(route, /verifySaEnterClaim/);
  });

  it("normal user paths cannot mint SA enter claims", () => {
    const mintCallers = [
      "src/app/(super-admin)/[saKey]/(panel)/companies/[companyId]/enter/route.ts",
    ];
    for (const file of mintCallers) {
      const src = readSrc(file);
      assert.match(src, /requireWritableSuperAdmin/);
      assert.match(src, /mintSaEnterClaim/);
    }
    const signup = readSrc("src/application/auth-service.ts");
    assert.doesNotMatch(signup, /mintSaEnterClaim|SaEnterClaim|SUPER_ADMIN/);
  });
});
