import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { resolvePdfBranding } from "@/services/reports/premium-pdf-branding";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  }
});

describe("PDF branding", () => {
  it("uses Report by with configured localhost origin when no production domain is set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const b = resolvePdfBranding("http://localhost:3000");
    assert.equal(b.reportBy, "Report by http://localhost:3000");
    assert.equal(b.displayHost, "localhost:3000");
    assert.equal(b.displayUrl, "http://localhost:3000");
    assert.ok(!b.reportBy.includes("bidvera.com"));
  });

  it("prefers configured production NEXT_PUBLIC_APP_URL over localhost request", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const b = resolvePdfBranding("http://localhost:3000");
    assert.equal(b.reportBy, "Report by https://app.example.com");
    assert.equal(b.displayHost, "app.example.com");
    assert.equal(b.displayUrl, "https://app.example.com");
  });

  it("uses request production origin when env is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const b = resolvePdfBranding("https://reports.customer.io");
    assert.equal(b.reportBy, "Report by https://reports.customer.io");
    assert.equal(b.displayUrl, "https://reports.customer.io");
  });

  it("never invents bidvera.com", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const b = resolvePdfBranding(null);
    assert.equal(b.reportBy, "Report by http://localhost:3000");
    assert.ok(!b.displayHost.includes("bidvera.com"));
  });
});
