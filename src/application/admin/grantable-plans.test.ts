import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  defaultStatusForGrantablePlan,
  toGrantableAdminPlans,
} from "@/application/admin/grantable-plans";

const root = process.cwd();

describe("grantable admin plans", () => {
  it("exposes only active Plans catalog rows plus the current slug", () => {
    const plans = toGrantableAdminPlans(
      [
        {
          slug: "free",
          name: "Free Workspace",
          sortOrder: 0,
          isFree: true,
          trialEligible: true,
          status: "ACTIVE",
        },
        {
          slug: "trial",
          name: "Trial",
          sortOrder: 1,
          isFree: false,
          trialEligible: true,
          status: "INACTIVE",
        },
        {
          slug: "pro",
          name: "Pro",
          sortOrder: 3,
          isFree: false,
          trialEligible: false,
          status: "ACTIVE",
        },
      ],
    );
    assert.deepEqual(
      plans.map((p) => p.slug),
      ["free", "pro"],
    );
    assert.equal(
      plans.some((p) => p.slug === "trial" || p.name === "Trial"),
      false,
    );
  });

  it("keeps an inactive current plan visible so the select can show it", () => {
    const plans = toGrantableAdminPlans(
      [
        {
          slug: "trial",
          name: "Trial",
          sortOrder: 1,
          isFree: false,
          trialEligible: true,
          status: "INACTIVE",
        },
        {
          slug: "pro",
          name: "Pro",
          sortOrder: 3,
          isFree: false,
          trialEligible: false,
          status: "ACTIVE",
        },
      ],
      "trial",
    );
    assert.deepEqual(
      plans.map((p) => p.slug),
      ["trial", "pro"],
    );
  });

  it("defaults Free Workspace / trial-eligible plans to TRIALING", () => {
    assert.equal(
      defaultStatusForGrantablePlan({ isFree: true, trialEligible: false }),
      "TRIALING",
    );
    assert.equal(
      defaultStatusForGrantablePlan({ isFree: false, trialEligible: true }),
      "TRIALING",
    );
    assert.equal(
      defaultStatusForGrantablePlan({ isFree: false, trialEligible: false }),
      "ACTIVE",
    );
  });

  it("company plan pickers no longer hardcode a separate Trial option", () => {
    const list = readFileSync(
      join(root, "src/components/super-admin/company-list-plan.tsx"),
      "utf8",
    );
    const detail = readFileSync(
      join(root, "src/components/super-admin/company-actions.tsx"),
      "utf8",
    );
    assert.match(list, /toGrantableAdminPlans|GrantableAdminPlan/);
    assert.doesNotMatch(list, /label: "Trial"/);
    assert.doesNotMatch(detail, /<option value="trial">Trial<\/option>/);
    const grant = readFileSync(
      join(root, "src/application/admin/company-credentials.ts"),
      "utf8",
    );
    assert.match(grant, /Only active Plans catalog entries can be granted/);
    assert.match(grant, /slug: input.planId/);
  });
});
