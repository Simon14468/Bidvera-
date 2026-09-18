import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import { hashToken } from "@/lib/crypto";
import {
  assertReportShareActive,
  createLegacyHmacReportShareToken,
  isLegacyReportShareToken,
  verifyLegacyHmacReportShareToken,
  verifyOpaqueReportShareToken,
  verifyReportShareToken,
} from "@/services/reports/share-token";

describe("M5 report share tokens", () => {
  it("legacy HMAC valid tokens still verify", async () => {
    const token = createLegacyHmacReportShareToken({
      companyId: "co_a",
      tenderId: "td_a",
      ttlMs: 60_000,
    });
    assert.equal(isLegacyReportShareToken(token), true);
    const payload = await verifyReportShareToken(token);
    assert.equal(payload.companyId, "co_a");
    assert.equal(payload.tenderId, "td_a");
  });

  it("rejects expired HMAC tokens", async () => {
    const token = createLegacyHmacReportShareToken({
      companyId: "co_a",
      tenderId: "td_a",
      ttlMs: -1,
    });
    await assert.rejects(
      () => verifyReportShareToken(token),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 403 &&
        error.message.includes("expired"),
    );
  });

  it("rejects invalid HMAC tokens", async () => {
    await assert.rejects(
      () => verifyReportShareToken("not.a.valid"),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
    const token = createLegacyHmacReportShareToken({
      companyId: "co_a",
      tenderId: "td_a",
    });
    await assert.rejects(
      () => verifyReportShareToken(`${token}tampered`),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("rejects HMAC tokens with a swapped companyId (cross-tenant)", () => {
    const token = createLegacyHmacReportShareToken({
      companyId: "co_a",
      tenderId: "td_a",
    });
    const [body] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      companyId: string;
      tenderId: string;
      exp: number;
    };
    payload.companyId = "co_other";
    const forged = `${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}.${token.split(".")[1]}`;
    assert.throws(
      () => verifyLegacyHmacReportShareToken(forged),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("opaque tokens honor expiry, revocation, and tenant binding", async () => {
    const token = "opaque-share-token-value";
    const tokenHash = hashToken(token);
    const rows = new Map([
      [
        tokenHash,
        {
          companyId: "co_a",
          tenderId: "td_a",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null as Date | null,
        },
      ],
    ]);
    const lookup = async (hash: string) => rows.get(hash) ?? null;

    const valid = await verifyOpaqueReportShareToken(token, lookup);
    assert.equal(valid.companyId, "co_a");

    await assert.rejects(
      () => verifyOpaqueReportShareToken(token, lookup, { companyId: "co_other" }),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );

    rows.set(tokenHash, { ...rows.get(tokenHash)!, revokedAt: new Date() });
    await assert.rejects(
      () => verifyOpaqueReportShareToken(token, lookup),
      (error: unknown) =>
        error instanceof AppError && error.message.includes("revoked"),
    );

    rows.set(tokenHash, {
      companyId: "co_a",
      tenderId: "td_a",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    });
    await assert.rejects(
      () => verifyOpaqueReportShareToken(token, lookup),
      (error: unknown) =>
        error instanceof AppError && error.message.includes("expired"),
    );

    await assert.rejects(
      () => verifyOpaqueReportShareToken("unknown-token", lookup),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });

  it("assertReportShareActive rejects cross-tenant rows", () => {
    assert.throws(
      () =>
        assertReportShareActive(
          {
            companyId: "co_a",
            tenderId: "td_a",
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
          },
          { companyId: "co_b" },
        ),
      (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
    );
  });
});
