/**
 * Security regression tests for Account Settings email-change flow.
 * Mix of source contracts + pure template/schema checks (no live DB).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { EMAIL_CHANGE } from "@/config/server";
import { updateAccountProfileSchema } from "@/domain/schemas";
import {
  emailChangeConfirmEmail,
  emailChangeNotifyEmail,
} from "@/services/email";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("email-change security — config & schema", () => {
  it("uses a short configurable confirmation TTL (15–120 minutes, default 45)", () => {
    assert.equal(EMAIL_CHANGE.ttlMinutes, 45);
    assert.ok(EMAIL_CHANGE.ttlMinutes >= 15 && EMAIL_CHANGE.ttlMinutes <= 120);
  });

  it("rate-limits initiate and confirm separately", () => {
    assert.ok(EMAIL_CHANGE.maxRequestsPerUserPerHour >= 1);
    assert.ok(EMAIL_CHANGE.maxConfirmPerIpPerHour >= 5);
    const rateSrc = readSrc("src/lib/rate-limit.ts");
    assert.match(rateSrc, /emailChangeUserRateLimiter/);
    assert.match(rateSrc, /emailChangeConfirmRateLimiter/);
  });

  it("accepts profile updates without password when schema parses name+email only", () => {
    const parsed = updateAccountProfileSchema.parse({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    assert.equal(parsed.currentPassword, undefined);
  });
});

describe("email-change security — source contracts", () => {
  const tokens = readSrc("src/services/auth/tokens.ts");
  const authService = readSrc("src/application/auth-service.ts");
  const issueFn = tokens.slice(tokens.indexOf("export async function issueEmailChange"));
  const consumeFn = tokens.slice(
    tokens.indexOf("export async function consumeEmailChangeToken"),
  );
  const updateFn = authService.slice(
    authService.indexOf("export async function updateAccountProfileAction"),
  );
  const confirmFn = authService.slice(
    authService.indexOf("export async function confirmEmailChangeAction"),
  );

  it("does not update User.email inside issueEmailChange", () => {
    const createBlock = issueFn.slice(
      0,
      issueFn.indexOf("export async function consumeEmailChangeToken"),
    );
    assert.doesNotMatch(createBlock, /prisma\.user\.update\(/);
    assert.match(createBlock, /emailChangeToken\.create/);
    assert.match(createBlock, /hashToken\(raw\)/);
    assert.doesNotMatch(createBlock, /passwordHash|currentPassword/);
  });

  it("stores only hashed tokens and uses cryptographically secure generateToken", () => {
    assert.match(issueFn, /generateToken\(32\)/);
    assert.match(issueFn, /tokenHash:\s*hashToken\(raw\)/);
    assert.doesNotMatch(issueFn, /tokenHash:\s*raw/);
  });

  it("invalidates prior pending requests when a new one is created", () => {
    assert.match(
      issueFn,
      /emailChangeToken\.updateMany\(\s*\{[\s\S]*usedAt:\s*null[\s\S]*usedAt:\s*new Date/,
    );
  });

  it("fails closed when confirmation email cannot be delivered", () => {
    assert.match(issueFn, /confirm_delivery_failed|Could not send the confirmation email/);
    assert.match(issueFn, /usedAt:\s*new Date\(\)/);
    assert.match(issueFn, /ErrorCode\.UPSTREAM/);
  });

  it("sends security notification to current email without secrets", () => {
    assert.match(issueFn, /emailChangeNotifyEmail/);
    assert.match(issueFn, /notify\.to\s*=\s*user\.email/);
    const notifyTpl = readSrc("src/services/email/index.ts");
    const notifyFn = notifyTpl.slice(
      notifyTpl.indexOf("export function emailChangeNotifyEmail"),
    );
    assert.match(notifyFn, /has not changed yet/i);
    assert.doesNotMatch(notifyFn, /confirmUrl|token|passwordHash|session/);
  });

  it("consumes tokens atomically and rejects reuse/expiry", () => {
    assert.match(consumeFn, /\$transaction/);
    assert.match(consumeFn, /updateMany\(\s*\{[\s\S]*usedAt:\s*null/);
    assert.match(consumeFn, /claimed\.count\s*!==\s*1/);
    assert.match(consumeFn, /already_used|expired|malformed_token/);
  });

  it("revokes all sessions after successful email change", () => {
    assert.match(consumeFn, /session\.deleteMany\(\s*\{\s*where:\s*\{\s*userId/);
    assert.match(confirmFn, /clearSessionCookie/);
    assert.match(confirmFn, /login\?notice=email-changed/);
  });

  it("requires password re-authentication before initiating email change", () => {
    assert.match(updateFn, /emailChanging/);
    assert.match(updateFn, /currentPassword/);
    assert.match(updateFn, /verifyPasswordAgainstKnownOrDummy/);
    assert.match(updateFn, /Incorrect password/);
    assert.match(updateFn, /emailChangeUserRateLimiter/);
  });

  it("scopes initiate/cancel/resend to the authenticated session user only", () => {
    assert.match(updateFn, /requireAuthApi/);
    assert.match(updateFn, /auth\.user\.id/);
    assert.doesNotMatch(updateFn, /userId:\s*data\.userId|raw\.userId/);
    const cancelFn = authService.slice(
      authService.indexOf("export async function cancelEmailChangeAction"),
    );
    assert.match(cancelFn, /auth\.user\.id/);
    assert.doesNotMatch(cancelFn, /formData\.get\([\"']userId/);
  });

  it("email-change confirm rejects taken addresses with generic copy", () => {
    assert.match(consumeFn, /EMAIL_CHANGE_UNAVAILABLE_MESSAGE|Unable to use that email/);
    assert.doesNotMatch(consumeFn, /That email is already in use/);
  });

  it("audits request/cancel/confirm/fail without logging raw tokens", () => {
    assert.match(tokens, /EMAIL_CHANGE_REQUESTED/);
    assert.match(tokens, /EMAIL_CHANGE_CANCELLED/);
    assert.match(tokens, /EMAIL_CHANGED/);
    assert.match(tokens, /EMAIL_CHANGE_FAILED/);
    assert.match(tokens, /redactEmailForLog/);
    assert.doesNotMatch(tokens, /metadata:[\s\S]{0,80}raw[Tt]oken/);
    assert.doesNotMatch(tokens, /metadata:[\s\S]{0,80}confirmUrl/);
  });

  it("confirmation page is public and does not accept client userId", () => {
    const page = readSrc(
      "src/app/(marketing)/(auth)/confirm-email-change/page.tsx",
    );
    assert.match(page, /confirmEmailChange\(token\)/);
    assert.doesNotMatch(page, /userId/);
    const mw = readSrc("src/middleware.ts");
    assert.match(mw, /confirm-email-change/);
  });
});

describe("email-change security — mail templates", () => {
  it("confirmation mail includes expiry and no password/session secrets", () => {
    const mail = emailChangeConfirmEmail({
      name: "Ada",
      newEmail: "new@example.com",
      confirmUrl: "https://app.example/confirm-email-change?token=abc",
      expiresMinutes: 45,
    });
    assert.match(mail.text ?? "", /45 minutes/);
    assert.match(mail.html ?? "", /Bidvera/);
    assert.doesNotMatch(mail.text ?? "", /password|session|api[_-]?key/i);
    assert.equal(mail.to, "");
  });

  it("current-email notify states email has not changed and omits confirmation link", () => {
    const mail = emailChangeNotifyEmail({
      name: "Ada",
      newEmail: "new@example.com",
      currentEmail: "old@example.com",
      requestedAt: "2026-09-17T12:00:00.000Z",
    });
    assert.match(mail.text ?? "", /NOT changed yet/);
    assert.doesNotMatch(mail.text ?? "", /confirm-email-change\?token=/);
    assert.match(mail.subject, /Security alert/i);
  });
});
