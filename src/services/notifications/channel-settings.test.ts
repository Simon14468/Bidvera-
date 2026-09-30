import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SECRET_SETTING_KEYS } from "@/config/super-admin";
import {
  applyPlatformChannelGates,
  decryptChannelVault,
  DEFAULT_NOTIFICATION_CHANNEL_SETTINGS,
  encryptChannelVault,
  isOptionalChannelVisible,
  notificationChannelAdminSaveSchema,
  notificationChannelAuditSafeSnapshot,
  notificationChannelSettingsSchema,
  NOTIFICATION_CHANNEL_VAULT_KEY,
  secretHint,
} from "@/services/notifications/channel-settings";

test("notification channel settings default all optional channels hidden", () => {
  assert.deepEqual(DEFAULT_NOTIFICATION_CHANNEL_SETTINGS.whatsappVisible, false);
  assert.deepEqual(DEFAULT_NOTIFICATION_CHANNEL_SETTINGS.smsVisible, false);
  assert.deepEqual(DEFAULT_NOTIFICATION_CHANNEL_SETTINGS.pushVisible, false);
  assert.equal(DEFAULT_NOTIFICATION_CHANNEL_SETTINGS.smsProvider, "none");
  assert.equal(DEFAULT_NOTIFICATION_CHANNEL_SETTINGS.whatsappApiVersion, "v21.0");
  const parsed = notificationChannelSettingsSchema.parse({});
  assert.equal(parsed.whatsappVisible, false);
  assert.equal(parsed.smsVisible, false);
  assert.equal(parsed.pushVisible, false);
});

test("channel vault encrypt/decrypt round-trip and never embeds plaintext", () => {
  const cipher = encryptChannelVault({
    whatsappAccessToken: "EAAG_meta_token_secret_abc",
    smsAuthToken: "twilio_auth_token_xyz",
  });
  assert.ok(cipher.length > 20);
  assert.ok(!cipher.includes("EAAG_meta"));
  assert.ok(!cipher.includes("twilio_auth"));
  const plain = decryptChannelVault(cipher);
  assert.equal(plain.whatsappAccessToken, "EAAG_meta_token_secret_abc");
  assert.equal(plain.smsAuthToken, "twilio_auth_token_xyz");
  assert.deepEqual(decryptChannelVault("not-valid!!!"), {});
});

test("secretHint never returns full token", () => {
  const hint = secretHint("EAAG_abcdefghijklmnopqrstuvwxyz");
  assert.ok(hint);
  assert.ok(hint.startsWith("••••"));
  assert.ok(!hint.includes("EAAG_abcd"));
  assert.equal(secretHint(""), null);
});

test("audit snapshot never contains raw tokens", () => {
  const snap = notificationChannelAuditSafeSnapshot({
    whatsappVisible: true,
    whatsappPhoneNumberId: "123",
    whatsappBusinessAccountId: null,
    whatsappApiVersion: "v21.0",
    smsVisible: false,
    smsProvider: "twilio",
    smsAccountSid: "ACxxx",
    smsFromNumber: "+1555",
    pushVisible: false,
    hasWhatsappAccessToken: true,
    whatsappAccessTokenHint: "••••zzzz",
    whatsappAccessTokenSource: "vault",
    hasSmsAuthToken: false,
    smsAuthTokenHint: null,
    smsAuthTokenSource: "none",
  });
  const json = JSON.stringify(snap);
  assert.ok(!("whatsappAccessToken" in snap));
  assert.ok(!("smsAuthToken" in snap));
  assert.ok(!json.includes("EAAG"));
  assert.equal(snap.hasWhatsappAccessToken, true);
});

test("admin save schema accepts Meta + Twilio credential fields", () => {
  const parsed = notificationChannelAdminSaveSchema.parse({
    whatsappVisible: false,
    whatsappPhoneNumberId: "pn",
    whatsappBusinessAccountId: "",
    whatsappApiVersion: "v21.0",
    whatsappAccessToken: "token",
    smsVisible: false,
    smsProvider: "twilio",
    smsAccountSid: "ACabc",
    smsFromNumber: "+15551212",
    smsAuthToken: "secret",
    pushVisible: false,
  });
  assert.equal(parsed.whatsappAccessToken, "token");
  assert.equal(parsed.smsProvider, "twilio");
});

test("isOptionalChannelVisible respects per-channel SA toggles", () => {
  const settings = {
    ...DEFAULT_NOTIFICATION_CHANNEL_SETTINGS,
    whatsappVisible: true,
    smsVisible: false,
    pushVisible: true,
  };
  assert.equal(isOptionalChannelVisible(settings, "whatsapp"), true);
  assert.equal(isOptionalChannelVisible(settings, "sms"), false);
  assert.equal(isOptionalChannelVisible(settings, "push"), true);
});

test("applyPlatformChannelGates forces hidden channels off", () => {
  const gated = applyPlatformChannelGates(
    {
      whatsappEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
    },
    {
      ...DEFAULT_NOTIFICATION_CHANNEL_SETTINGS,
      whatsappVisible: false,
      smsVisible: true,
      pushVisible: false,
    },
  );
  assert.deepEqual(gated, {
    whatsappEnabled: false,
    smsEnabled: true,
    pushEnabled: false,
  });
});

test("vault key is registered as secret and UI collects Meta/Twilio fields", () => {
  assert.ok(SECRET_SETTING_KEYS.has(NOTIFICATION_CHANNEL_VAULT_KEY));

  const form = readFileSync(
    path.join(
      process.cwd(),
      "src/components/super-admin/notification-channels-admin.tsx",
    ),
    "utf8",
  );
  assert.match(form, /Meta access token/);
  assert.match(form, /Phone Number ID/);
  assert.match(form, /Twilio Auth Token/);
  assert.match(form, /Twilio Account SID/);
  assert.match(form, /whatsappAccessToken/);
  assert.match(form, /smsAuthToken/);
});
