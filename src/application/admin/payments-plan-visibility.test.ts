import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  isOfficialFreeWorkspaceGrantEligible,
  isOfficialFreeWorkspacePaymentsPlan,
  shouldRenderCommercialPaymentFields,
} from "@/application/admin/payments-plan-visibility";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const official = {
  id: "plan_free",
  slug: "free",
  isFree: true,
  name: "ssasa",
  status: "ACTIVE",
  trialEligible: true,
};

const ssasaExtra = {
  id: "ssasa",
  slug: "ssasa",
  isFree: true,
  name: "ssasa",
  status: "ACTIVE",
  trialEligible: true,
};

const paid = {
  id: "plan_pro",
  slug: "pro",
  isFree: false,
  name: "Pro",
  status: "ACTIVE",
  trialEligible: true,
};

describe("Super Admin /payments Free Workspace visibility", () => {
  it("official Free Workspace does not render commercial payment fields", () => {
    assert.equal(isOfficialFreeWorkspacePaymentsPlan(official), true);
    assert.equal(shouldRenderCommercialPaymentFields(official), false);
    assert.equal(isOfficialFreeWorkspaceGrantEligible(official), true);
    const ui = readSrc("src/components/super-admin/payments-admin.tsx");
    assert.match(ui, /shouldRenderCommercialPaymentFields/);
    assert.match(ui, /isOfficialFreeWorkspacePaymentsPlan/);
    assert.doesNotMatch(ui, /plan\.isFree \|\| plan\.slug === "free" \? " · Free Workspace"/);
  });

  it("Stripe/PayPal remain unavailable on the official Free Workspace row", () => {
    const ui = readSrc("src/components/super-admin/payments-admin.tsx");
    const officialBlock = ui.slice(
      ui.indexOf("officialFreeWorkspace"),
      ui.indexOf("shouldRenderCommercialPaymentFields"),
    );
    assert.match(ui, /Stripe and PayPal stay off/);
    assert.doesNotMatch(officialBlock, /placeholder="Stripe price monthly"/);
    assert.doesNotMatch(officialBlock, /placeholder="PayPal plan monthly"/);
    const service = readSrc("src/application/admin/plan-gateway-service.ts");
    assert.match(service, /isOfficialFreeWorkspacePaymentsPlan/);
    assert.match(service, /Configure Free Workspace from Free Workspace settings/);
  });

  it("paid plans still render their payment configuration", () => {
    assert.equal(shouldRenderCommercialPaymentFields(paid), true);
    assert.equal(isOfficialFreeWorkspacePaymentsPlan(paid), false);
    const ui = readSrc("src/components/super-admin/payments-admin.tsx");
    assert.match(ui, /placeholder="Stripe price monthly"/);
    assert.match(ui, /placeholder="PayPal plan monthly"/);
    assert.match(ui, /checked=\{visible\}/);
    assert.match(ui, /checked=\{plan\.isFree \? false : stripeOn\}/);
  });

  it("arbitrary isFree/non-official plans are not treated as official Free Workspace", () => {
    assert.equal(isOfficialFreeWorkspacePaymentsPlan(ssasaExtra), false);
    assert.equal(shouldRenderCommercialPaymentFields(ssasaExtra), true);
    assert.equal(isOfficialFreeWorkspaceGrantEligible(ssasaExtra), false);
    assert.equal(
      isOfficialFreeWorkspacePaymentsPlan({ slug: "free", isFree: false }),
      false,
    );
    assert.equal(
      isOfficialFreeWorkspaceGrantEligible({
        ...official,
        status: "INACTIVE",
      }),
      false,
    );
    assert.equal(
      isOfficialFreeWorkspaceGrantEligible({
        ...official,
        trialEligible: false,
      }),
      false,
    );
  });
});
