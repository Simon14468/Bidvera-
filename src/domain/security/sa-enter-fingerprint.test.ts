/**
 * Regression: client cannot forge Super Admin enter-company fingerprints.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReservedSaEnterFingerprint,
  sanitizePublicDeviceFingerprint,
  SA_ENTER_FINGERPRINT_PREFIX,
} from "@/auth/super-admin-enter";
import { loginSchema, createAccountSchema } from "@/domain/schemas";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("SA enter fingerprint hardening", () => {
  it("rejects reserved sa-enter prefix from public fingerprints", () => {
    assert.equal(isReservedSaEnterFingerprint("sa-enter:admin123"), true);
    assert.equal(isReservedSaEnterFingerprint("SA-ENTER:x"), true);
    assert.equal(isReservedSaEnterFingerprint("browser-fp-abc"), false);
    assert.equal(
      sanitizePublicDeviceFingerprint("sa-enter:forged"),
      null,
    );
    assert.equal(
      sanitizePublicDeviceFingerprint("normal-device"),
      "normal-device",
    );
  });

  it("login/signup schemas reject forged sa-enter fingerprints", () => {
    assert.throws(() =>
      loginSchema.parse({
        email: "a@b.com",
        password: "x",
        deviceFingerprint: `${SA_ENTER_FINGERPRINT_PREFIX}x`,
      }),
    );
    assert.throws(() =>
      createAccountSchema.parse({
        email: "a@b.com",
        password: "password12ab",
        acceptTerms: true,
        deviceFingerprint: "sa-enter:spoof",
      }),
    );
    assert.doesNotThrow(() =>
      loginSchema.parse({
        email: "a@b.com",
        password: "x",
        deviceFingerprint: "ok-fp",
      }),
    );
  });

  it("module access gates verify admin id instead of prefix-only trust", () => {
    const modules = [
      "matching-engine",
      "tender-analysis",
      "document-compliance",
      "supplier-qualification",
      "tender-calendar",
      "client-requests",
      "questionnaire-assistant",
    ];
    for (const mod of modules) {
      const src = readFileSync(
        join(ROOT, "src/modules", mod, "access.ts"),
        "utf8",
      );
      assert.match(src, /isVerifiedSuperAdminEnterSession/);
      assert.doesNotMatch(
        src,
        /deviceFingerprint\?\.startsWith\(SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX\)/,
      );
    }
    const helper = readFileSync(
      join(ROOT, "src/auth/super-admin-enter.ts"),
      "utf8",
    );
    assert.match(helper, /adminUser\.findFirst/);
    assert.match(helper, /SUPER_ADMIN/);
  });
});
