import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppError } from "@/lib/errors";
import {
  assertLandingUploadAllowed,
  looksLikeSvgOrHtml,
  sniffLandingMedia,
} from "@/domain/security/landing-upload-sniff";
import {
  assertSafeAiBaseUrl,
  isUnsafeOutboundRedirectLocation,
  normalizeSafeAiBaseUrl,
} from "@/domain/security/safe-outbound-url";
import { assertSafeLandingAssetUrl } from "@/domain/schemas/landing";
import { resolveUniqueCompanyIdFromCustomerMatches } from "@/services/billing/stripe-customer-isolation";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H-03 landing upload content sniff (never trust client MIME)", () => {
  it("accepts real PNG/JPEG and rejects SVG/HTML/exec spoof", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    assert.equal(sniffLandingMedia(png).kind, "png");
    assert.equal(assertLandingUploadAllowed("poster", png).kind, "png");

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(sniffLandingMedia(jpeg).kind, "jpeg");

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal(looksLikeSvgOrHtml(svg), true);
    assert.equal(sniffLandingMedia(svg).kind, "rejected");
    assert.equal(assertLandingUploadAllowed("avatar", svg).kind, "rejected");

    const html = Buffer.from("<!DOCTYPE html><html><body>x</body></html>");
    assert.equal(assertLandingUploadAllowed("poster", html).kind, "rejected");

    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(assertLandingUploadAllowed("video", exe).kind, "rejected");
  });

  it("accepts ftyp MP4 and rejects image bytes labeled as video", () => {
    const mp4 = Buffer.alloc(32, 0);
    mp4.writeUInt32BE(28, 0);
    mp4.write("ftyp", 4);
    mp4.write("isom", 8);
    assert.equal(assertLandingUploadAllowed("video", mp4).kind, "mp4");

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    assert.equal(assertLandingUploadAllowed("video", png).kind, "unknown");
  });

  it("saveLandingUpload sniffs content and ignores client filename extension", () => {
    const src = readSrc("src/application/admin/landing-service.ts");
    const fn = src.slice(src.indexOf("export async function saveLandingUpload"));
    assert.match(fn, /assertLandingUploadAllowed/);
    assert.match(fn, /randomBytes/);
    assert.doesNotMatch(fn, /allowedVideo\.includes\(input\.mimeType\)/);
    assert.doesNotMatch(fn, /path\.extname\(input\.fileName\)/);
  });

  it("rejects path-traversal and dangerous landing asset URL references", () => {
    assert.equal(
      assertSafeLandingAssetUrl("/uploads/landing/poster-1.png"),
      "/uploads/landing/poster-1.png",
    );
    assert.throws(
      () => assertSafeLandingAssetUrl("/uploads/landing/../secret.png"),
      (e: unknown) => e instanceof AppError && e.status === 400,
    );
    assert.throws(
      () => assertSafeLandingAssetUrl("javascript:alert(1)"),
      (e: unknown) => e instanceof AppError && e.status === 400,
    );
    assert.throws(
      () => assertSafeLandingAssetUrl("/uploads/landing/x.svg"),
      (e: unknown) => e instanceof AppError && e.status === 400,
    );
    assert.throws(
      () => assertSafeLandingAssetUrl("https://evil.example/x.png"),
      (e: unknown) => e instanceof AppError && e.status === 400,
    );
  });
});

describe("H-04 AI baseUrl SSRF guard", () => {
  it("allows public https provider hosts and rejects private/metadata", () => {
    assert.equal(
      normalizeSafeAiBaseUrl("https://api.openai.com/v1/"),
      "https://api.openai.com/v1",
    );
    assert.equal(
      normalizeSafeAiBaseUrl("https://api.anthropic.com"),
      "https://api.anthropic.com",
    );
    assert.equal(
      normalizeSafeAiBaseUrl(
        "https://generativelanguage.googleapis.com/v1beta",
      ),
      "https://generativelanguage.googleapis.com/v1beta",
    );
    assert.equal(
      normalizeSafeAiBaseUrl("https://api.deepseek.com"),
      "https://api.deepseek.com",
    );
    assert.equal(
      normalizeSafeAiBaseUrl(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      ),
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    );
    assert.equal(normalizeSafeAiBaseUrl(null), null);
    assert.equal(normalizeSafeAiBaseUrl("  "), null);

    const blocked = [
      "http://api.openai.com/v1",
      "https://localhost/v1",
      "https://127.0.0.1/v1",
      "https://10.0.0.5/v1",
      "https://192.168.1.1/v1",
      "https://172.16.0.1/v1",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/v1",
      "https://metadata.google.internal/",
      "https://user:pass@api.openai.com/v1",
      "not-a-url",
    ];
    for (const url of blocked) {
      assert.throws(
        () => assertSafeAiBaseUrl(url),
        (e: unknown) => e instanceof AppError && e.status === 400,
        `expected reject: ${url}`,
      );
    }
  });

  it("treats private redirect Location as unsafe", () => {
    assert.equal(
      isUnsafeOutboundRedirectLocation("https://169.254.169.254/", "https://api.openai.com/v1"),
      true,
    );
    assert.equal(
      isUnsafeOutboundRedirectLocation("https://api.openai.com/v2", "https://api.openai.com/v1"),
      false,
    );
    assert.equal(isUnsafeOutboundRedirectLocation("http://evil/", "https://api.openai.com"), true);
  });

  it("wires SSRF checks into resolveBaseUrl, fetch redirects, and assistant save", () => {
    const providers = readSrc("src/services/ai/providers.ts");
    assert.match(providers, /assertSafeAiBaseUrl/);
    assert.match(providers, /redirect:\s*["']manual["']/);
    assert.match(providers, /isUnsafeOutboundRedirectLocation/);

    const assistant = readSrc("src/services/ai/assistant-settings.ts");
    const save = assistant.slice(assistant.indexOf("export async function saveAssistantAdminConfig"));
    assert.match(save, /assertSafeAiBaseUrl\(data\.baseUrl\)/);
    const testFn = assistant.slice(
      assistant.indexOf("export async function testAssistantProviderConnection"),
    );
    assert.match(testFn, /assertSafeAiBaseUrl\(data\.baseUrl\)/);
  });
});

describe("H-05 Stripe providerCustomerId tenant isolation", () => {
  it("fails closed when zero or multiple companies share a customer id", () => {
    assert.equal(resolveUniqueCompanyIdFromCustomerMatches([]), null);
    assert.equal(
      resolveUniqueCompanyIdFromCustomerMatches([{ companyId: "co_a" }]),
      "co_a",
    );
    assert.equal(
      resolveUniqueCompanyIdFromCustomerMatches([
        { companyId: "co_a" },
        { companyId: "co_b" },
      ]),
      null,
    );
    // Duplicate rows same company still unique
    assert.equal(
      resolveUniqueCompanyIdFromCustomerMatches([
        { companyId: "co_a" },
        { companyId: "co_a" },
      ]),
      "co_a",
    );
  });

  it("stripe webhook customer lookup uses findMany + unique resolver (not findFirst)", () => {
    const src = readSrc("src/services/billing/stripe.ts");
    const fn = src.slice(src.indexOf("async function findCompanyByStripeCustomer"));
    assert.match(fn, /findMany/);
    assert.match(fn, /resolveUniqueCompanyIdFromCustomerMatches/);
    assert.doesNotMatch(fn, /findFirst/);
  });
});

describe("M/L free Turnstile + skip onboarding eligibility", () => {
  it("requires Turnstile before free-plan activation assign", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(
      src.indexOf("export async function activateFreeOrTrialPlanAction"),
      src.indexOf("function isLikelyPersonalEmail"),
    );
    const turnstileIdx = fn.indexOf("assertTurnstileToken");
    const freeAssign = fn.indexOf("assignFreeWorkspace");
    assert.ok(turnstileIdx >= 0);
    assert.ok(freeAssign > turnstileIdx);
    assert.match(fn, /assertCanManageBilling\(auth\.user\.role\)/);
  });

  it("skipCompanyOnboardingAction asserts existing-company eligibility", () => {
    const src = readSrc("src/application/auth-service.ts");
    const fn = src.slice(
      src.indexOf("export async function skipCompanyOnboardingAction"),
      src.indexOf("export async function activateFreeOrTrialPlanAction"),
    );
    const existing = fn.slice(fn.indexOf("if (user.companyId)"));
    assert.match(existing, /assertEligibleExistingCompanyOnboarding\(user\)/);
    assert.doesNotMatch(
      existing.slice(0, existing.indexOf("const fallbackName") || existing.length),
      /role:\s*["']OWNER["']/,
    );
  });
});
