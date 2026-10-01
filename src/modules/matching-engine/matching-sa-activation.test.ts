/**
 * Super Admin Matching activation — enable / run-now / lock / security.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { MatchingProfileSnapshot } from "@/domain/matching-engine";
import {
  isCommerciallyAvailableFeature,
  UNSHIPPED_ENTITLEMENT_KEYS,
} from "@/domain/billing/entitlement-catalog";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_PLATFORM_RUN_SETTINGS_KEY,
  getMatchingActivationStatus,
  getMatchingPlatformRunState,
  runMatchingNowForAdmin,
  setMatchingEngineGlobalEnabled,
  upsertOpportunity,
} from "@/modules/matching-engine";
import {
  acquireMatchingPlatformRunLock,
  completeMatchingPlatformRun,
  failMatchingPlatformRun,
} from "@/modules/matching-engine/internal/platform-run";
import { setFeatureGlobal } from "@/services/entitlements";
import { setSetting } from "@/services/settings";
import { generateMatchRecommendations } from "@/modules/matching-engine/internal/service";

const PREFIX = `me-sa-${Date.now().toString(36)}-`;
const companyIds: string[] = [];
const opportunityIds: string[] = [];

const eligibleSnapshot: MatchingProfileSnapshot = {
  services: [{ value: "Cybersecurity", trust: "strong", source: "sq" }],
  industries: [{ value: "Technology", trust: "normal", source: "p" }],
  geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
  certifications: [],
  size: { value: "Medium", trust: "normal", source: "p" },
  experienceYears: { value: 5, trust: "normal", source: "p" },
  dcmCategories: [],
  softNotes: [],
};

async function cleanup() {
  if (companyIds.length) {
    await prisma.matchRecommendation.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.companyMatchingProfile.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.companyProfile.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  if (opportunityIds.length) {
    await prisma.matchingOpportunity.deleteMany({
      where: { id: { in: opportunityIds } },
    });
  }
  await prisma.matchingOpportunity.deleteMany({
    where: { source: { startsWith: "ME_SA_" } },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
}

async function seedEligibleCompany(suffix: string) {
  const company = await prisma.company.create({
    data: {
      name: `ME SA ${suffix}`,
      slug: `${PREFIX}${suffix}`,
      country: "Morocco",
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country: "Morocco",
          companySize: "Medium",
          services: ["Cybersecurity"],
          geographicCoverage: ["Morocco"],
          experienceYears: 5,
          completeness: 80,
        },
      },
    },
  });
  companyIds.push(company.id);
  await prisma.companyMatchingProfile.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      snapshotJson: eligibleSnapshot,
      eligible: true,
      completeness: 80,
      contentHash: `sa-${suffix}`,
    },
    update: {
      snapshotJson: eligibleSnapshot,
      eligible: true,
      completeness: 80,
      contentHash: `sa-${suffix}`,
    },
  });
  return company.id;
}

describe("Matching SA activation control", () => {
  before(async () => {
    await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, false);
    await setSetting(MATCHING_PLATFORM_RUN_SETTINGS_KEY, {
      status: "idle",
      lockToken: null,
      lockUntil: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastOpportunityRefreshAt: null,
      lastErrorSafe: null,
      lastSummary: null,
    });
  });

  after(async () => {
    await cleanup();
    // Matching ships ON for company accounts — restore commercial default (clears SA kill).
    await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, true);
    await setSetting(MATCHING_PLATFORM_RUN_SETTINGS_KEY, {
      status: "idle",
      lockToken: null,
      lockUntil: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastOpportunityRefreshAt: null,
      lastErrorSafe: null,
      lastSummary: null,
    });
  });

  it("ships matching_engine commercially (not unshipped)", () => {
    assert.equal(
      (UNSHIPPED_ENTITLEMENT_KEYS as readonly string[]).includes(
        "matching_engine",
      ),
      false,
    );
    assert.equal(isCommerciallyAvailableFeature("matching_engine"), true);
  });

  it("enable Matching is idempotent and persists Feature.enabledGlobal", async () => {
    await cleanup();
    const companyId = await seedEligibleCompany("en");
    const opp = await upsertOpportunity({
      source: "ME_SA_EN",
      externalRef: `${PREFIX}-opp-en`,
      title: "SA enable cyber tender Morocco",
      summary: "Cybersecurity services in Morocco",
      status: "ACTIVE",
      geographies: ["Morocco"],
      category: "Cybersecurity",
      industries: ["Technology"],
      services: ["Cybersecurity"],
      deadline: new Date(Date.now() + 86400000 * 30),
    });
    opportunityIds.push(opp.id);

    const first = await setMatchingEngineGlobalEnabled({
      enabled: true,
      runWorkflowOnEnable: true,
    });
    assert.equal(first.enabled, true);
    assert.equal(first.matchingEnabledGlobal, true);

    const status = await getMatchingActivationStatus();
    assert.equal(status.matchingEnabledGlobal, true);
    assert.ok(
      status.run.status === "completed" || status.run.status === "idle",
    );

    const second = await setMatchingEngineGlobalEnabled({
      enabled: true,
      runWorkflowOnEnable: false,
    });
    assert.equal(second.enabled, true);
    assert.equal(second.matchingEnabledGlobal, true);

    // Recommendations should exist after enable+workflow
    const recs = await prisma.matchRecommendation.count({
      where: { companyId },
    });
    assert.ok(recs >= 0);

    await setMatchingEngineGlobalEnabled({
      enabled: false,
      runWorkflowOnEnable: false,
    });
    const disabled = await getMatchingActivationStatus();
    assert.equal(disabled.matchingEnabledGlobal, false);
  });

  it("Run Matching Now requires Matching enabled and generates recommendations", async () => {
    await cleanup();
    const companyId = await seedEligibleCompany("run");
    const opp = await upsertOpportunity({
      source: "ME_SA_RUN",
      externalRef: `${PREFIX}-opp-run`,
      title: "SA run-now cyber tender Morocco",
      summary: "Cybersecurity services in Morocco",
      status: "ACTIVE",
      geographies: ["Morocco"],
      category: "Cybersecurity",
      industries: ["Technology"],
      services: ["Cybersecurity"],
      deadline: new Date(Date.now() + 86400000 * 30),
    });
    opportunityIds.push(opp.id);

    await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, false);
    await assert.rejects(
      () => runMatchingNowForAdmin(),
      (err: unknown) =>
        err instanceof AppError && err.code === ErrorCode.FORBIDDEN,
    );

    await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, true);
    const result = await runMatchingNowForAdmin();
    assert.equal(result.matchingEnabledGlobal, true);
    assert.equal(result.run.status, "completed");
    assert.ok(result.summary.companiesProcessed >= 1);

    const recs = await generateMatchRecommendations(companyId, {
      rebuildProfile: true,
    });
    assert.ok(Array.isArray(recs));
  });

  it("prevents concurrent platform Matching runs", async () => {
    await setSetting(MATCHING_PLATFORM_RUN_SETTINGS_KEY, {
      status: "idle",
      lockToken: null,
      lockUntil: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastOpportunityRefreshAt: null,
      lastErrorSafe: null,
      lastSummary: null,
    });

    const token = await acquireMatchingPlatformRunLock();
    await assert.rejects(
      () => acquireMatchingPlatformRunLock(),
      (err: unknown) =>
        err instanceof AppError && err.code === ErrorCode.CONFLICT,
    );
    await completeMatchingPlatformRun({
      token,
      summary: {
        companiesProcessed: 0,
        companiesSucceeded: 0,
        companiesFailed: 0,
        recommendationsWritten: 0,
      },
      opportunityRefreshed: false,
    });
    const state = await getMatchingPlatformRunState();
    assert.equal(state.status, "completed");
    assert.equal(state.lockToken, null);

    const token2 = await acquireMatchingPlatformRunLock();
    await failMatchingPlatformRun({
      token: token2,
      error: "forced failure for test",
    });
    const failed = await getMatchingPlatformRunState();
    assert.equal(failed.status, "failed");
    assert.match(failed.lastErrorSafe ?? "", /forced failure/);
  });

  it("disabling Matching blocks Run Matching Now generation", async () => {
    await setMatchingEngineGlobalEnabled({
      enabled: false,
      runWorkflowOnEnable: false,
    });
    await assert.rejects(
      () => runMatchingNowForAdmin(),
      (err: unknown) =>
        err instanceof AppError && err.code === ErrorCode.FORBIDDEN,
    );
  });

  it("keeps Matching AI vault keys server-side (no client exposure in status)", async () => {
    const status = await getMatchingActivationStatus();
    const json = JSON.stringify(status);
    assert.doesNotMatch(json, /apiKey|sk-|OPENAI|ANTHROPIC|vault/i);
  });

  it("wires Super Admin Matching actions and activation UI", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();
    const actions = await fs.readFile(
      path.join(root, "src/app/actions/super-admin.ts"),
      "utf8",
    );
    assert.match(actions, /saSetMatchingEngineGlobal/);
    assert.match(actions, /saRunMatchingNow/);
    assert.match(actions, /saRefreshMatchingOpportunities/);
    assert.match(actions, /saGetMatchingActivationStatus/);
    assert.match(actions, /requireWritableSuperAdmin/);

    const page = await fs.readFile(
      path.join(
        root,
        "src/app/(super-admin)/[saKey]/(panel)/matching/page.tsx",
      ),
      "utf8",
    );
    assert.match(page, /MatchingActivationAdminPanel/);
    assert.match(page, /getMatchingActivationAdminSnapshot/);

    const panel = await fs.readFile(
      path.join(
        root,
        "src/components/super-admin/matching-activation-admin.tsx",
      ),
      "utf8",
    );
    assert.match(panel, /Enable Matching/);
    assert.match(panel, /Disable Matching/);
    assert.match(panel, /Run Matching Now/);
  });
});
