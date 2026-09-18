/**
 * Production hardening regressions — rate limit, upload sniff, super-admin fail-closed,
 * assistant auth gate (source contract).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach, after } from "node:test";
import { RateLimiter } from "@/lib/rate-limit";
import {
  isAllowedUploadContent,
  sniffUploadContent,
} from "@/domain/tender-package/upload-content-sniff";
import {
  isSuperAdminConfigured,
  isSuperAdminPathSegment,
  resolveSuperAdminPath,
} from "@/config/super-admin";

describe("durable-compatible rate limiter (memory backend)", () => {
  const limiter = new RateLimiter(3, 60_000);
  const prevBackend = process.env.RATE_LIMIT_BACKEND;

  beforeEach(() => {
    process.env.RATE_LIMIT_BACKEND = "memory";
    limiter.resetMemoryForTests();
  });

  after(() => {
    if (prevBackend === undefined) delete process.env.RATE_LIMIT_BACKEND;
    else process.env.RATE_LIMIT_BACKEND = prevBackend;
  });

  it("enforces the same limit across two limiter instances sharing memory only when same instance", async () => {
    // Memory is process-local per instance — multi-instance requires durable backend.
    const a = new RateLimiter(2, 60_000);
    process.env.RATE_LIMIT_BACKEND = "memory";
    a.resetMemoryForTests();
    assert.equal((await a.consume("k")).ok, true);
    assert.equal((await a.consume("k")).ok, true);
    assert.equal((await a.consume("k")).ok, false);
  });

  it("two separate memory instances do not share state (documents why durable is required)", async () => {
    process.env.RATE_LIMIT_BACKEND = "memory";
    const a = new RateLimiter(1, 60_000);
    const b = new RateLimiter(1, 60_000);
    a.resetMemoryForTests();
    b.resetMemoryForTests();
    assert.equal((await a.consume("shared-key")).ok, true);
    // Second instance still allows — proves in-memory is not multi-instance safe
    assert.equal((await b.consume("shared-key")).ok, true);
  });
});

describe("durable rate limiter multi-instance (DB backend)", () => {
  const prevBackend = process.env.RATE_LIMIT_BACKEND;

  after(() => {
    if (prevBackend === undefined) delete process.env.RATE_LIMIT_BACKEND;
    else process.env.RATE_LIMIT_BACKEND = prevBackend;
  });

  it("two limiter instances share one bucket via durable backend", async () => {
    if (!process.env.DATABASE_URL) {
      // Skip without DB — memory tests still document the multi-instance gap.
      return;
    }
    // Explicit durable backend (overrides NODE_ENV=test memory default).
    process.env.RATE_LIMIT_BACKEND = "durable";
    const key = `hardening-multi:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const a = new RateLimiter(2, 60_000);
    const b = new RateLimiter(2, 60_000);
    assert.equal((await a.consume(key)).ok, true);
    assert.equal((await b.consume(key)).ok, true);
    assert.equal((await a.consume(key)).ok, false);
    assert.equal((await b.consume(key)).ok, false);
  });
});

describe("upload content sniffing", () => {
  it("accepts real PDF magic bytes", () => {
    const buf = Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\n");
    const sniffed = sniffUploadContent(buf);
    assert.equal(sniffed.kind, "pdf");
    assert.ok(isAllowedUploadContent(buf));
  });

  it("rejects extension/MIME spoof — executable bytes labeled as PDF", () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ
    assert.equal(sniffUploadContent(exe).kind, "unknown");
    assert.equal(isAllowedUploadContent(exe), null);
  });

  it("rejects random bytes even if named .pdf", () => {
    const junk = Buffer.from("not a document at all!!!!!");
    assert.equal(isAllowedUploadContent(junk), null);
  });

  it("accepts OLE legacy DOC signature", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    assert.equal(sniffUploadContent(ole).kind, "doc");
  });

  it("accepts ZIP that contains word/ as DOCX", () => {
    // Minimal ZIP local header + "word/document.xml" string in payload
    const payload = Buffer.from("PK\x03\x04xxxxword/document.xmlrest");
    assert.equal(sniffUploadContent(payload).kind, "docx");
  });

  it("classifies ZIP without word/ as archive (not a document)", () => {
    const payload = Buffer.from("PK\x03\x04xxxxdocs/notice.pdfrest!!!!");
    assert.equal(sniffUploadContent(payload).kind, "zip");
    assert.equal(isAllowedUploadContent(payload), null);
  });

  it("classifies RAR magic bytes as archive", () => {
    const rar = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0x00]);
    assert.equal(sniffUploadContent(rar).kind, "rar");
    assert.equal(isAllowedUploadContent(rar), null);
  });
});

describe("super admin fail-closed", () => {
  const prev = process.env.SUPER_ADMIN_PATH;

  after(() => {
    if (prev === undefined) delete process.env.SUPER_ADMIN_PATH;
    else process.env.SUPER_ADMIN_PATH = prev;
  });

  it("rejects missing path", () => {
    delete process.env.SUPER_ADMIN_PATH;
    const r = resolveSuperAdminPath();
    assert.equal(r.ok, false);
    assert.equal(isSuperAdminConfigured(), false);
    assert.equal(isSuperAdminPathSegment("anything"), false);
  });

  it("rejects banned trivial values and does not invent a default path", () => {
    process.env.SUPER_ADMIN_PATH = "admin";
    assert.equal(resolveSuperAdminPath().ok, false);
    delete process.env.SUPER_ADMIN_PATH;
    assert.equal(isSuperAdminPathSegment("bv-ops-x7k9m2"), false);
  });

  it("accepts an explicit operator-configured control path", () => {
    process.env.SUPER_ADMIN_PATH = "bv-ops-x7k9m2";
    const r = resolveSuperAdminPath();
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(isSuperAdminPathSegment("bv-ops-x7k9m2"), true);
      assert.equal(isSuperAdminPathSegment("wrong"), false);
    }
  });

  it("rejects short paths", () => {
    process.env.SUPER_ADMIN_PATH = "short";
    assert.equal(resolveSuperAdminPath().ok, false);
  });

  it("accepts a strong configured path", () => {
    process.env.SUPER_ADMIN_PATH = "ops-ctrl-9f3a2b7c1d";
    const r = resolveSuperAdminPath();
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(isSuperAdminPathSegment(r.path), true);
      assert.equal(isSuperAdminPathSegment("wrong"), false);
    }
  });

  it("unconfigured path resolution does not throw (middleware-safe)", () => {
    delete process.env.SUPER_ADMIN_PATH;
    assert.doesNotThrow(() => resolveSuperAdminPath());
    assert.equal(resolveSuperAdminPath().ok, false);
  });
});

describe("assistant abuse protection contract", () => {
  const root = process.cwd();

  it("ask route requires authenticated user and user-scoped quotas", () => {
    const src = readFileSync(
      path.join(root, "src/app/api/assistant/ask/route.ts"),
      "utf8",
    );
    assert.match(src, /resolveAuthContext/);
    assert.match(src, /ErrorCode\.UNAUTHENTICATED/);
    assert.match(src, /assistant-reply:user:\$\{auth\.user\.id\}/);
    assert.match(src, /assistantReplyRateLimiter\.consume/);
  });

  it("tts route requires authenticated user and user-scoped quotas", () => {
    const src = readFileSync(
      path.join(root, "src/app/api/assistant/tts/route.ts"),
      "utf8",
    );
    assert.match(src, /resolveAuthContext/);
    assert.match(src, /ErrorCode\.UNAUTHENTICATED/);
    assert.match(src, /assistant-tts-quota:user:\$\{auth\.user\.id\}/);
    assert.match(src, /assistantTtsRateLimiter\.consume/);
  });
});
