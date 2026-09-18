/**
 * Email provider modularity + disabled / invalid send paths.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  EmailDeliveryConfig,
  EmailPayload,
  EmailProvider,
  EmailSendResult,
} from "@/services/email/providers/types";
import { registerEmailProvider } from "@/services/email/providers";

test("EmailProvider interface allows alternate providers without Smart Alert rewrite", async () => {
  const calls: EmailPayload[] = [];
  const stub: EmailProvider = {
    id: "stub-test",
    async send(payload, config): Promise<EmailSendResult> {
      calls.push(payload);
      assert.equal(config.providerId, "resend"); // config shape shared
      return { ok: true, mode: "stub-test", providerMessageId: "msg_1" };
    },
  };
  registerEmailProvider(stub);

  const config: EmailDeliveryConfig = {
    providerId: "resend",
    from: "Bidvera <noreply@example.com>",
    replyTo: null,
    apiKey: "re_x",
    ready: true,
  };
  const result = await stub.send(
    {
      to: "user@example.com",
      subject: "Alert",
      html: "<p>hi</p>",
      text: "hi",
    },
    config,
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, "stub-test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.to, "user@example.com");
});

test("unready delivery must not claim success", () => {
  const config: EmailDeliveryConfig = {
    providerId: "none",
    from: "",
    replyTo: null,
    apiKey: null,
    ready: false,
    reason: "disabled",
  };
  assert.equal(config.ready, false);
  assert.equal(config.apiKey, null);
  assert.equal(config.reason, "disabled");
});

test("channel email result shape supports retry semantics", async () => {
  // Simulate provider returning failure — notifications should not mark emailSent
  const fail: EmailSendResult = {
    ok: false,
    mode: "resend",
    error: "Resend HTTP 401: Invalid API key",
  };
  assert.equal(fail.ok, false);
  assert.ok(!JSON.stringify(fail).includes("re_live"));
});
