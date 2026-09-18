import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeSaEnterClaim,
  mintSaEnterClaim,
} from "@/auth/sa-enter-claim";
import { prisma } from "@/lib/db";

test("sa enter claim round-trips without embedding session token in ticket", async () => {
  const token = "test-session-token-abc123";
  const ticket = await mintSaEnterClaim(token);
  assert.equal(ticket.includes(token), false);
  const decoded = Buffer.from(ticket.split(".")[0]!, "base64url").toString("utf8");
  assert.doesNotMatch(decoded, /test-session-token/);
  assert.doesNotMatch(decoded, /"st"/);
  assert.match(decoded, /"jti"/);

  const consumed = await consumeSaEnterClaim(ticket);
  assert.equal(consumed, token);

  // Single-use
  assert.equal(await consumeSaEnterClaim(ticket), null);
});

test("sa enter claim rejects tampered or empty tickets", async () => {
  const ticket = await mintSaEnterClaim("real-token");
  assert.equal(await consumeSaEnterClaim(""), null);
  assert.equal(await consumeSaEnterClaim("not-a-ticket"), null);
  assert.equal(await consumeSaEnterClaim(`${ticket}x`), null);
  const [payload, sig] = ticket.split(".");
  assert.ok(payload && sig);
  assert.equal(await consumeSaEnterClaim(`${payload}.deadbeef`), null);

  // Cleanup unused claim from mint above if still pending
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    jti?: string;
  };
  if (parsed.jti) {
    await prisma.saEnterClaim.delete({ where: { id: parsed.jti } }).catch(() => undefined);
  }
});
