/**
 * Entitlement / feature-gate request dedupe — SSR performance contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("entitlement request-scoped caching", () => {
  it("wraps getEffectiveEntitlements in React cache", () => {
    const src = read("src/services/entitlements/index.ts");
    assert.match(src, /import \{ cache \} from "react"/);
    assert.match(src, /export const getEffectiveEntitlements = cache\(/);
  });

  it("batches hasFeature DB work per company via getFeatureGateContext", () => {
    const src = read("src/services/entitlements/index.ts");
    assert.match(src, /getFeatureGateContext = cache\(/);
    assert.match(src, /companyFeatureOverride\.findMany/);
    assert.match(src, /feature\.findMany/);
    const start = src.indexOf("export async function hasFeature");
    const end = src.indexOf("export async function assertFeature", start);
    assert.ok(start >= 0 && end > start);
    const hasFeatureBody = src.slice(start, end);
    assert.match(hasFeatureBody, /getFeatureGateContext\(companyId\)/);
    assert.doesNotMatch(hasFeatureBody, /prisma\.feature\.findUnique/);
  });
});

describe("matching dashboard overview payload bound", () => {
  it("does not load 100 full recommendation DTOs for overview stats", () => {
    const src = read("src/application/matching-dashboard-overview.ts");
    assert.doesNotMatch(src, /limit:\s*100/);
    assert.match(src, /select:\s*\{\s*status:\s*true,\s*score:\s*true/);
    assert.match(src, /limit:\s*5/);
  });
});
