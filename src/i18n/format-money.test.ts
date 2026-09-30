import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { formatPlanMoney } from "@/i18n/format-money";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("formatPlanMoney uses admin currencyLabel instead of Intl US$", () => {
  assert.equal(formatPlanMoney(1300, "usd", "ar", "دولار"), "13 دولار");
  assert.equal(formatPlanMoney(8900, "usd", "ar", "$"), "$89");
  assert.equal(formatPlanMoney(1300, "usd", "zh", "美元"), "13 美元");
  assert.equal(formatPlanMoney(1300, "usd", "en", null), "$13");
  assert.doesNotMatch(formatPlanMoney(1300, "usd", "ar", "دولار"), /US\$/);
});

test("Languages editor + catalog expose currencyLabel", () => {
  const form = readSrc("src/components/super-admin/plan-form.tsx");
  assert.match(form, /Currency label/);
  assert.match(form, /currencyLabel/);
  assert.match(form, /DEFAULT_CURRENCY_LABELS/);

  const i18n = readSrc("src/services/billing/plan-i18n.ts");
  assert.match(i18n, /currencyLabel/);
  assert.match(i18n, /DEFAULT_CURRENCY_LABELS/);

  const catalog = readSrc("src/services/billing/catalog.ts");
  assert.match(catalog, /currencyLabel/);

  const grid = readSrc("src/components/marketing/pricing-grid.tsx");
  assert.match(grid, /plan\.currencyLabel/);
});
