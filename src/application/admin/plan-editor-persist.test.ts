import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { normalizePlanSlug } from "@/domain/billing/plan-slug";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("normalizePlanSlug lowercases and kebab-cases", () => {
  assert.equal(normalizePlanSlug("  Business Pro "), "business-pro");
  assert.equal(normalizePlanSlug("LITE_v2"), "lite-v2");
  assert.equal(normalizePlanSlug("pro"), "pro");
});

test("PlanEditor keeps paid plan slug editable and persists on update", () => {
  const form = readSrc("src/components/super-admin/plan-form.tsx");
  assert.doesNotMatch(form, /readOnly=\{Boolean\(initial\)\}/);
  assert.match(form, /normalizePlanSlug/);
  assert.match(form, /readOnly=\{isFree\}/);
  assert.match(form, /setEditing\(nextRow\)/);
  assert.match(form, /setEditorEpoch/);
  assert.doesNotMatch(
    form,
    /setEditing\(null\);\s*form\?\.reset\(\)/,
    "saving must not wipe the editor back to a blank create form",
  );
});

test("upsertPlanForAdmin writes slug and refuses create-over-existing slug", () => {
  const service = readSrc("src/application/admin/plan-service.ts");
  assert.match(service, /slug: data\.slug/);
  assert.match(
    service,
    /Slug "\$\{data\.slug\}" is already used\. Pick a unique slug for the new plan/,
  );
  assert.match(service, /previous\.slug !== data\.slug/);
});

test("price edits keep currency and stored gateway IDs", () => {
  const service = readSrc("src/application/admin/plan-service.ts");
  assert.match(service, /preserveStoredGatewayIds/);
  assert.match(service, /currency: previous \? previous\.currency/);
  assert.match(service, /syncSubscribersToPlanLimits/);
  const form = readSrc("src/components/super-admin/plan-form.tsx");
  assert.match(form, /Monthly price/);
  assert.match(form, /Yearly price/);
  assert.match(form, /Update plan & sync subscribers/);
  assert.match(form, /readOnly=\{initial != null\}/);
});

test("public plan cache is expired immediately after admin save", () => {
  const revalidate = readSrc("src/application/admin/revalidate-plans.ts");
  assert.match(revalidate, /updateTag\("public-billing-plans"\)/);
  assert.match(revalidate, /revalidatePath\("\/pricing"\)/);
  assert.match(revalidate, /revalidatePath\("\/upgrade"\)/);
});

test("Plans page exposes Add new plan above Free Workspace banner", () => {
  const page = readSrc("src/app/(super-admin)/[saKey]/(panel)/plans/page.tsx");
  assert.match(page, /PlansCatalog/);
  assert.doesNotMatch(page, /PlansManager/);

  const catalog = readSrc("src/components/super-admin/plans-catalog.tsx");
  assert.match(catalog, /Add new plan/);
  assert.match(catalog, /createNonce/);
  assert.match(catalog, /Default first-signup trial/);
  assert.match(catalog, /Configure Free Workspace/);

  const form = readSrc("src/components/super-admin/plan-form.tsx");
  assert.match(form, /createNonce/);
  assert.match(form, /id="plan-editor"/);
  assert.match(form, /Recommended/);
  assert.match(form, /name="highlighted"/);
  assert.doesNotMatch(form, />\s*Highlighted\s*</);
});

test("PricingGrid glass hover for Recommended or full-module Pro plans", () => {
  const grid = readSrc("src/components/marketing/pricing-grid.tsx");
  assert.match(grid, /pricing-card-premium-hover/);
  assert.match(grid, /plan\.highlighted/);
  assert.match(grid, /planQualifiesForPremiumPricingHover/);

  const css = readSrc("src/app/globals.css");
  assert.match(css, /\.pricing-card-premium-hover:hover/);
  assert.match(css, /\.pricing-card-premium-hover::before/);
  assert.match(css, /linear-gradient/);
  assert.doesNotMatch(css, /\.pricing-card-premium-hover:hover\s*\{[^}]*backdrop-filter/);
});
