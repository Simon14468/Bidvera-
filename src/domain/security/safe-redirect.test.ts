import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { safeInternalPath } from "@/domain/security/safe-redirect";

describe("H-AUDIT-01 safeInternalPath open-redirect guard", () => {
  it("allows valid local redirects", () => {
    assert.equal(safeInternalPath("/dashboard"), "/dashboard");
    assert.equal(safeInternalPath("/settings?tab=account"), "/settings?tab=account");
    assert.equal(safeInternalPath("/onboarding/verify"), "/onboarding/verify");
    assert.equal(safeInternalPath("/tenders/abc#top"), "/tenders/abc#top");
  });

  it("rejects external URLs", () => {
    assert.equal(safeInternalPath("https://evil.example/phish"), "/dashboard");
    assert.equal(safeInternalPath("http://evil.example"), "/dashboard");
    assert.equal(safeInternalPath("https://evil.example", "/login"), "/login");
  });

  it("rejects protocol-relative URLs", () => {
    assert.equal(safeInternalPath("//evil.example"), "/dashboard");
    assert.equal(safeInternalPath("///evil.example"), "/dashboard");
  });

  it("rejects javascript/data URLs", () => {
    assert.equal(safeInternalPath("javascript:alert(1)"), "/dashboard");
    assert.equal(safeInternalPath("/javascript:alert(1)"), "/dashboard");
    assert.equal(safeInternalPath("data:text/html,hi"), "/dashboard");
  });

  it("rejects encoded bypasses", () => {
    assert.equal(
      safeInternalPath("%2F%2Fevil.example"),
      "/dashboard",
    );
    assert.equal(
      safeInternalPath("%252F%252Fevil.example"),
      "/dashboard",
    );
    assert.equal(
      safeInternalPath("/settings%2F..%2F%2Fevil.example"),
      "/dashboard",
    );
  });

  it("rejects malformed / trick paths", () => {
    assert.equal(safeInternalPath("\\evil"), "/dashboard");
    assert.equal(safeInternalPath("/\\evil"), "/dashboard");
    assert.equal(safeInternalPath("/@evil.com"), "/dashboard");
    assert.equal(safeInternalPath(""), "/dashboard");
    assert.equal(safeInternalPath(null), "/dashboard");
    assert.equal(safeInternalPath("   "), "/dashboard");
  });

  it("auth-form uses safeInternalPath for next", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/auth/auth-form.tsx"),
      "utf8",
    );
    assert.match(src, /safeInternalPath/);
    assert.doesNotMatch(src, /router\.push\(search\.get\(/);
  });
});
