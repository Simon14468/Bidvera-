import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  assertCanCreateReportShare,
  assertCanMutateCompanyContent,
  canCreateReportShare,
  canMutateCompanyContent,
  canViewCompanyContent,
} from "@/auth/company-content-access";
import { isInternalPipelineSmokeDisabled } from "@/app/api/internal/cps-pipeline-smoke/guard";
import { resolveStripeSubscriptionWebhookBinding } from "@/services/billing/verification";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function exportFn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = src.indexOf("export async function", start + 1);
  return next >= 0 ? src.slice(start, next) : src.slice(start);
}

const CONTENT_MUTATION_ROUTES: Array<{ file: string; mutations: string[]; reads?: string[] }> = [
  {
    file: "src/app/api/client-requests/route.ts",
    mutations: ["POST"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/client-requests/[id]/route.ts",
    mutations: ["PATCH", "DELETE"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/client-requests/[id]/items/route.ts",
    mutations: ["POST"],
  },
  {
    file: "src/app/api/client-requests/[id]/items/[itemId]/route.ts",
    mutations: ["PATCH"],
  },
  {
    file: "src/app/api/client-requests/[id]/share/route.ts",
    mutations: ["POST", "DELETE"],
  },
  {
    file: "src/app/api/document-compliance/documents/route.ts",
    mutations: ["POST"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/document-compliance/documents/[id]/route.ts",
    mutations: ["POST"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/supplier-qualification/profile/route.ts",
    mutations: ["PUT"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/supplier-qualification/evidence/route.ts",
    mutations: ["POST", "DELETE"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/questionnaire-assistant/tenders/[tenderId]/route.ts",
    mutations: ["POST"],
    reads: ["GET"],
  },
  {
    file: "src/app/api/questionnaire-assistant/packs/[packId]/draft/route.ts",
    mutations: ["POST"],
  },
  {
    file: "src/app/api/questionnaire-assistant/questions/[questionId]/review/route.ts",
    mutations: ["POST"],
  },
];

describe("F-01 VIEWER is read-only; MEMBER/OWNER/ADMIN may mutate", () => {
  it("allows VIEWER to view and rejects VIEWER mutations with 403", () => {
    assert.equal(canViewCompanyContent("VIEWER"), true);
    assert.equal(canMutateCompanyContent("VIEWER"), false);
    assert.doesNotThrow(() => assertCanMutateCompanyContent("MEMBER"));
    assert.doesNotThrow(() => assertCanMutateCompanyContent("OWNER"));
    assert.doesNotThrow(() => assertCanMutateCompanyContent("ADMIN"));
    assert.throws(
      () => assertCanMutateCompanyContent("VIEWER"),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.FORBIDDEN &&
        error.status === 403,
    );
  });

  it("keeps MEMBER/OWNER/ADMIN mutations allowed and VIEWER share-link creation forbidden", () => {
    assert.equal(canMutateCompanyContent("MEMBER"), true);
    assert.equal(canMutateCompanyContent("OWNER"), true);
    assert.equal(canMutateCompanyContent("ADMIN"), true);
    assert.equal(canCreateReportShare("OWNER"), true);
    assert.equal(canCreateReportShare("ADMIN"), true);
    assert.equal(canCreateReportShare("MEMBER"), false);
    assert.equal(canCreateReportShare("VIEWER"), false);
    assert.throws(
      () => assertCanCreateReportShare("VIEWER"),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
    assert.throws(
      () => assertCanCreateReportShare("MEMBER"),
      (error: unknown) => error instanceof AppError && error.status === 403,
    );
    assert.doesNotThrow(() => assertCanCreateReportShare("OWNER"));
    assert.doesNotThrow(() => assertCanCreateReportShare("ADMIN"));
  });

  it("gates listed mutations and leaves GET handlers readable", () => {
    for (const route of CONTENT_MUTATION_ROUTES) {
      const src = readSrc(route.file);
      assert.match(src, /requireCompanyIdApi/);
      for (const name of route.mutations) {
        const fn = exportFn(src, name);
        assert.match(fn, /assertCanMutateCompanyContent\(auth\.user\.role\)/, `${route.file} ${name}`);
        const tenantIdx = fn.indexOf("requireCompanyIdApi");
        const roleIdx = fn.indexOf("assertCanMutateCompanyContent");
        assert.ok(tenantIdx >= 0 && roleIdx > tenantIdx, `${route.file} ${name} tenant before role`);
        assert.doesNotMatch(fn, /companyId:\s*(body|raw)\.companyId/);
      }
      for (const name of route.reads ?? []) {
        const fn = exportFn(src, name);
        assert.doesNotMatch(fn, /assertCanMutateCompanyContent/, `${route.file} ${name} stays readable`);
        assert.match(fn, /requireCompanyIdApi/, `${route.file} ${name} stays tenant-scoped`);
      }
    }
  });

  it("restricts report share creation to OWNER/ADMIN after tenant resolution", () => {
    const src = readSrc("src/app/actions/reports.ts");
    const create = exportFn(src, "createReportShareLink");
    assert.match(create, /requireCompanyId\(\)/);
    assert.match(create, /assertCanCreateReportShare\(auth\.user\.role\)/);
    assert.ok(create.indexOf("requireCompanyId") < create.indexOf("assertCanCreateReportShare"));
    assert.match(create, /getTenderReportForCompany\(tenderId, companyId\)/);
    const download = exportFn(src, "downloadTenderReportPdf");
    assert.doesNotMatch(download, /assertCanCreateReportShare/);
    assert.doesNotMatch(download, /assertCanMutateCompanyContent/);
    const revoke = exportFn(src, "revokeReportShareLinks");
    assert.match(revoke, /assertCanMutateCompanyContent\(auth\.user\.role\)/);
  });
});

describe("F-02 cps-extract-smoke production 404", () => {
  it("returns 404 in production even when a smoke secret exists", () => {
    assert.equal(isInternalPipelineSmokeDisabled("production"), true);
    const src = readSrc("src/app/api/internal/cps-extract-smoke/route.ts");
    const post = exportFn(src, "POST");
    const disableIdx = post.indexOf("isInternalPipelineSmokeDisabled()");
    const authIdx = post.indexOf("authorized(req)");
    const pathIdx = post.indexOf("resolveCpsPath()");
    assert.ok(disableIdx >= 0);
    assert.ok(authIdx > disableIdx);
    assert.ok(pathIdx > authIdx);
    assert.match(post.slice(disableIdx, authIdx), /status: 404/);
    assert.match(post.slice(disableIdx, authIdx), /not_found/);
    assert.doesNotMatch(post.slice(0, authIdx), /path: cpsPath/);
  });

  it("preserves development/test availability and rejects missing/invalid secrets", () => {
    assert.equal(isInternalPipelineSmokeDisabled("development"), false);
    assert.equal(isInternalPipelineSmokeDisabled("test"), false);
    const src = readSrc("src/app/api/internal/cps-extract-smoke/route.ts");
    assert.match(src, /expected\.length < 16/);
    assert.match(src, /status: 401/);
    assert.match(src, /unauthorized/);
    const pipeline = readSrc("src/app/api/internal/cps-pipeline-smoke/route.ts");
    const pipelinePost = exportFn(pipeline, "POST");
    assert.ok(pipelinePost.indexOf("isInternalPipelineSmokeDisabled()") < pipelinePost.indexOf("authorized(req)"));
    assert.match(pipelinePost, /status: 404/);
  });
});

describe("F-03 Stripe subscription webhook binding", () => {
  const checkoutRow = {
    companyId: "co_1",
    provider: "stripe",
    providerSubscriptionId: null as string | null,
    planId: "plan_starter",
    status: "INCOMPLETE",
  };

  it("activates when Bidvera checkout is bound to the incoming Stripe subscription", () => {
    assert.equal(
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_1",
        planId: "plan_starter",
        providerSubscriptionId: "sub_new",
        knownByProviderId: null,
        localByCompany: checkoutRow,
      }),
      "checkout",
    );
  });

  it("allows updates to an already-known legitimate subscription (renewals)", () => {
    assert.equal(
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_1",
        planId: "plan_starter",
        providerSubscriptionId: "sub_live",
        knownByProviderId: {
          companyId: "co_1",
          provider: "stripe",
          providerSubscriptionId: "sub_live",
          planId: "plan_starter",
          status: "ACTIVE",
        },
        localByCompany: {
          companyId: "co_1",
          provider: "stripe",
          providerSubscriptionId: "sub_live",
          planId: "plan_starter",
          status: "ACTIVE",
        },
      }),
      "existing",
    );
  });

  it("rejects unknown/unbound Stripe subscriptions and does not grant paid access", () => {
    assert.throws(
      () =>
        resolveStripeSubscriptionWebhookBinding({
          companyId: "co_1",
          planId: "plan_starter",
          providerSubscriptionId: "sub_foreign",
          knownByProviderId: null,
          localByCompany: null,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.FORBIDDEN &&
        /No checkout session/.test(error.message),
    );
  });

  it("rejects wrong company metadata on a known Stripe subscription", () => {
    assert.throws(
      () =>
        resolveStripeSubscriptionWebhookBinding({
          companyId: "co_victim",
          planId: "plan_starter",
          providerSubscriptionId: "sub_live",
          knownByProviderId: {
            companyId: "co_owner",
            provider: "stripe",
            providerSubscriptionId: "sub_live",
            planId: "plan_starter",
            status: "ACTIVE",
          },
          localByCompany: null,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 403 &&
        /does not match company/.test(error.message),
    );
  });

  it("rejects wrong plan on checkout or known subscription", () => {
    assert.throws(
      () =>
        resolveStripeSubscriptionWebhookBinding({
          companyId: "co_1",
          planId: "plan_pro",
          providerSubscriptionId: "sub_new",
          knownByProviderId: null,
          localByCompany: checkoutRow,
        }),
      (error: unknown) =>
        error instanceof AppError && /Plan does not match checkout/.test(error.message),
    );
    assert.throws(
      () =>
        resolveStripeSubscriptionWebhookBinding({
          companyId: "co_1",
          planId: "plan_pro",
          providerSubscriptionId: "sub_live",
          knownByProviderId: {
            companyId: "co_1",
            provider: "stripe",
            providerSubscriptionId: "sub_live",
            planId: "plan_starter",
            status: "ACTIVE",
          },
          localByCompany: checkoutRow,
        }),
      (error: unknown) =>
        error instanceof AppError && /Plan does not match existing/.test(error.message),
    );
  });

  it("wires binding and price checks before paid activation; webhook idempotency stays intact", () => {
    const stripe = readSrc("src/services/billing/stripe.ts");
    const created = stripe.indexOf('case "customer.subscription.created"');
    const trialEnd = stripe.indexOf('case "customer.subscription.trial_will_end"');
    const body = stripe.slice(created, trialEnd);
    const bindIdx = body.indexOf("assertStripeSubscriptionWebhookBinding");
    const priceIdx = body.indexOf("Stripe subscription price does not match plan");
    const activateIdx = body.indexOf("applyPaidPlanActivation");
    assert.ok(bindIdx >= 0);
    assert.ok(priceIdx > bindIdx);
    assert.ok(activateIdx > priceIdx);
    assert.match(body, /sub\.metadata\?\.companyId/);
    assert.doesNotMatch(body, /body\.companyId|input\.companyId/);

    const handle = stripe.slice(
      stripe.indexOf("export async function handleStripeWebhook"),
      stripe.indexOf("async function processStripeEvent"),
    );
    assert.match(handle, /constructEvent/);
    assert.match(handle, /beginWebhookProcessing/);
    assert.match(handle, /if \(duplicate\) return/);
    const dupIdx = handle.indexOf("if (duplicate) return");
    const processIdx = handle.indexOf("processStripeEvent");
    assert.ok(dupIdx >= 0 && processIdx > dupIdx);

    const checkout = stripe.slice(
      stripe.indexOf("export async function createStripeCheckoutSession"),
      stripe.indexOf("export async function activateStripeCheckoutSession"),
    );
    assert.doesNotMatch(checkout, /applyPaidPlanActivation/);
    const actions = readSrc("src/app/actions.ts");
    const start = actions.slice(actions.indexOf("export async function startCheckoutAction"));
    assert.doesNotMatch(start.slice(0, 1200), /applyPaidPlanActivation/);
  });
});
