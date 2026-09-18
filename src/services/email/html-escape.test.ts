import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml } from "@/lib/html";
import {
  emailChangeConfirmEmail,
  emailChangeNotifyEmail,
  passwordResetEmail,
  verificationEmail,
} from "@/services/email";
import { buildRenewalReminderMessage } from "@/services/billing/renewal-reminders";

describe("L6 email HTML escaping", () => {
  it("escapes names and URLs in verification email HTML", () => {
    const mail = verificationEmail({
      name: `<img src=x onerror=alert(1)>`,
      verifyUrl: `https://app.example/" onclick="alert(1)`,
    });
    assert.equal(mail.html?.includes("<img"), false);
    assert.equal(mail.html?.includes('onclick="'), false);
    assert.match(mail.html ?? "", /&lt;img/);
    assert.match(mail.html ?? "", /href="https:\/\/app\.example\/&quot;/);
    assert.doesNotMatch(mail.text ?? "", /&lt;/);
  });

  it("escapes password-reset URLs in attribute and text contexts", () => {
    const mail = passwordResetEmail({
      name: `O'Brien & Co`,
      resetUrl: `https://x.test/reset?next="><script>alert(1)</script>`,
    });
    assert.equal(mail.html?.includes("<script>"), false);
    assert.match(mail.html ?? "", /&#39;/);
    assert.match(mail.html ?? "", /&amp;/);
    assert.match(mail.html ?? "", /&quot;/);
    assert.match(mail.html ?? "", /&lt;script&gt;/);
  });

  it("does not double-escape trusted static markup", () => {
    const mail = verificationEmail({
      name: "Ada",
      verifyUrl: "https://app.example/verify",
    });
    assert.match(mail.html ?? "", /<p>Hi Ada,<\/p>/);
    assert.match(mail.html ?? "", /<a href="https:\/\/app.example\/verify">Verify email<\/a>/);
    assert.doesNotMatch(mail.html ?? "", /&lt;p&gt;/);
  });

  it("escapes plan names before they are interpolated into reminder HTML", () => {
    const { title, message } = buildRenewalReminderMessage({
      stage: "7d",
      planName: `Pro</p><script>alert(1)</script>`,
      amountCents: 1000,
      currency: "USD",
      interval: "MONTH",
      provider: "paypal",
      renewsAt: new Date("2026-10-01T00:00:00.000Z"),
    });
    const html = `<p>${escapeHtml(title)}</p><p>${escapeHtml(message)}</p>`;
    assert.equal(html.includes("<script>"), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it("escapes email-change confirmation HTML", () => {
    const confirm = emailChangeConfirmEmail({
      name: `<b>Ada</b>`,
      newEmail: `evil"@x.test`,
      confirmUrl: `https://app.example/confirm?x="><script>`,
    });
    assert.equal(confirm.html?.includes("<script>"), false);
    assert.match(confirm.html ?? "", /&lt;b&gt;/);
    const notify = emailChangeNotifyEmail({
      name: `O'Brien`,
      newEmail: `<img src=x>`,
      currentEmail: "old@x.test",
      requestedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(notify.html?.includes("<img"), false);
    assert.match(notify.html ?? "", /&#39;/);
    assert.match(notify.text ?? "", /has NOT changed yet/i);
    assert.doesNotMatch(notify.text ?? "", /token=/i);
    assert.doesNotMatch(notify.html ?? "", /confirm-email-change\?token=/i);
  });
});
