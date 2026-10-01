import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  contentTypeForAvatarFilename,
  publicAvatarUrl,
  resolveAvatarsRoot,
  resolvePublicUploadsRoot,
  resolveSafeAvatarFilePath,
} from "@/lib/public-uploads";

describe("public-uploads root + avatar path safety", () => {
  it("defaults to cwd/public/uploads when PUBLIC_UPLOADS_ROOT unset", () => {
    const cwd = path.resolve("/opt/bidvera");
    const root = resolvePublicUploadsRoot({}, cwd);
    assert.equal(root, path.resolve(cwd, "public", "uploads"));
    assert.equal(
      resolveAvatarsRoot({}, cwd),
      path.resolve(cwd, "public", "uploads", "avatars"),
    );
  });

  it("uses absolute PUBLIC_UPLOADS_ROOT when set", () => {
    const root = resolvePublicUploadsRoot(
      { PUBLIC_UPLOADS_ROOT: "/var/lib/bidvera/public-uploads" },
      "/opt/bidvera",
    );
    assert.equal(root, path.resolve("/var/lib/bidvera/public-uploads"));
    assert.equal(
      resolveAvatarsRoot(
        { PUBLIC_UPLOADS_ROOT: "/var/lib/bidvera/public-uploads" },
        "/opt/bidvera",
      ),
      path.resolve("/var/lib/bidvera/public-uploads", "avatars"),
    );
  });

  it("builds stable relative public avatar URLs", () => {
    assert.equal(
      publicAvatarUrl("user_1", "avatar-1.png"),
      "/uploads/avatars/user_1/avatar-1.png",
    );
  });

  it("rejects path traversal in avatar file resolution", () => {
    const env = { PUBLIC_UPLOADS_ROOT: "/var/lib/bidvera/public-uploads" };
    assert.equal(resolveSafeAvatarFilePath("u1", "../x.png", env), null);
    assert.equal(resolveSafeAvatarFilePath("u1", "a/b.png", env), null);
    assert.equal(resolveSafeAvatarFilePath("../u", "a.png", env), null);
    assert.equal(resolveSafeAvatarFilePath("u1", "a.exe", env), null);
  });

  it("resolves safe avatar files under the configured root", () => {
    const env = { PUBLIC_UPLOADS_ROOT: "/var/lib/bidvera/public-uploads" };
    const full = resolveSafeAvatarFilePath("user_abc", "avatar-1.png", env);
    assert.equal(
      full,
      path.resolve(
        "/var/lib/bidvera/public-uploads",
        "avatars",
        "user_abc",
        "avatar-1.png",
      ),
    );
  });

  it("maps avatar extensions to content types", () => {
    assert.equal(contentTypeForAvatarFilename("x.png"), "image/png");
    assert.equal(contentTypeForAvatarFilename("x.JPG"), "image/jpeg");
    assert.equal(contentTypeForAvatarFilename("x.webp"), "image/webp");
    assert.equal(contentTypeForAvatarFilename("x.gif"), "image/gif");
    assert.equal(contentTypeForAvatarFilename("x.svg"), null);
  });
});
