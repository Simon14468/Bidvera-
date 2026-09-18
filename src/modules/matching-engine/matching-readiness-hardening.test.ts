/**
 * Production Matching readiness hardening — fixtures, onboarding rebuild, preview.
 * Does not change scoring / threshold / enable Matching Engine.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import {
  countEligibleMatchingCompanies,
  countEligibleMatchingCompaniesIncludingFixtures,
  getMatchingActivationReadiness,
  isMatchingTestFixtureCompany,
  previewMatchingProfileForCompany,
  rebuildMatchingProfileForCompany,
} from "@/modules/matching-engine";
import {
  getCompanyMatchingReadinessForAdmin,
  rebuildMatchingProfileForAdmin,
} from "@/application/admin/matching-readiness";

const PREFIX = `me-ready-${Date.now()}-`;
const companyIds: string[] = [];

async function seedCompany(input: {
  name: string;
  slug: string;
  services?: string[];
  country?: string;
  eligibleProfile?: boolean;
}) {
  const company = await prisma.company.create({
    data: {
      name: input.name,
      slug: input.slug,
      country: input.country ?? "Morocco",
      companySize: "Small",
      profile: {
        create: {
          industry: "Technology",
          country: input.country ?? "Morocco",
          companySize: "Small",
          services: input.services ?? ["Cybersecurity"],
          certifications: [],
          geographicCoverage: [input.country ?? "Morocco"],
          experienceYears: 5,
          completeness: 80,
        },
      },
    },
  });
  companyIds.push(company.id);
  if (input.eligibleProfile !== false) {
    await rebuildMatchingProfileForCompany(company.id);
  }
  return company;
}

describe("Matching readiness hardening", () => {
  after(async () => {
    if (companyIds.length) {
      await prisma.companyMatchingProfile.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await prisma.companyProfile.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
  });

  it("detects ME8 fixtures by name and slug patterns", () => {
    assert.equal(isMatchingTestFixtureCompany({ name: "ME8D", slug: "x" }), true);
    assert.equal(
      isMatchingTestFixtureCompany({ name: "ME8D expire", slug: "other" }),
      true,
    );
    assert.equal(
      isMatchingTestFixtureCompany({
        name: "Acme",
        slug: `me8d-${Date.now()}-batch`,
      }),
      true,
    );
    assert.equal(
      isMatchingTestFixtureCompany({ name: "Acme", slug: "me8-c-foo" }),
      true,
    );
    assert.equal(
      isMatchingTestFixtureCompany({
        name: "Meridian Integrated Facilities Ltd",
        slug: "meridian-integrated-facilities",
      }),
      false,
    );
  });

  it("excludes ME8 fixtures from activation eligible count; real companies still count", async () => {
    const before = await countEligibleMatchingCompanies();
    const beforeAll = await countEligibleMatchingCompaniesIncludingFixtures();

    const fixture = await seedCompany({
      name: `ME8D ${PREFIX}fixture`,
      slug: `${PREFIX}me8d-fixture`,
      services: ["Cybersecurity", "Cloud"],
    });
    // Force slug to suite style for filter coverage
    await prisma.company.update({
      where: { id: fixture.id },
      data: { slug: `me8d-${Date.now()}-ready` },
    });
    await rebuildMatchingProfileForCompany(fixture.id);

    const real = await seedCompany({
      name: `Real Ready ${PREFIX}`,
      slug: `${PREFIX}real-ready`,
      services: ["Construction work", "IT services"],
      country: "France",
    });

    const after = await countEligibleMatchingCompanies();
    const afterAll = await countEligibleMatchingCompaniesIncludingFixtures();

    assert.ok(after >= before + 1, "real eligible must increase production count");
    assert.ok(
      afterAll >= beforeAll + 2,
      "raw count including fixtures increases by fixture+real",
    );
    assert.ok(
      afterAll - after >= 1,
      "at least one fixture excluded from production eligible count",
    );

    const readiness = await getMatchingActivationReadiness();
    assert.equal(readiness.eligibleCompanies, after);
    assert.equal(readiness.eligibleThreshold, 45);

    // Ensure fixture profile is eligible but not counted
    const fixtureProfile = await prisma.companyMatchingProfile.findUnique({
      where: { companyId: fixture.id },
    });
    assert.equal(fixtureProfile?.eligible, true);

    const realProfile = await prisma.companyMatchingProfile.findUnique({
      where: { companyId: real.id },
    });
    assert.equal(realProfile?.eligible, true);
  });

  it("onboarding complete/skip schedule Matching Profile rebuild (source contract)", () => {
    const auth = readFileSync(
      join(process.cwd(), "src/application/auth-service.ts"),
      "utf8",
    );
    assert.match(auth, /completeCompanyOnboardingAction/);
    assert.match(auth, /skipCompanyOnboardingAction/);
    const completeIdx = auth.indexOf("export async function completeCompanyOnboardingAction");
    const skipIdx = auth.indexOf("export async function skipCompanyOnboardingAction");
    const completeBody = auth.slice(completeIdx, skipIdx);
    const skipBody = auth.slice(skipIdx, auth.indexOf("function computeOnboardingCompleteness"));
    assert.match(completeBody, /scheduleMatchingProfileRebuild/);
    assert.match(skipBody, /scheduleMatchingProfileRebuild/);
    // Both paths schedule at least twice (existing company + new company) or once each section
    assert.ok(
      (completeBody.match(/scheduleMatchingProfileRebuild/g) ?? []).length >= 2,
    );
    assert.ok((skipBody.match(/scheduleMatchingProfileRebuild/g) ?? []).length >= 2);
  });

  it("rebuild materializes missing profile from live sources without inventing signals", async () => {
    const company = await seedCompany({
      name: `Materialize ${PREFIX}`,
      slug: `${PREFIX}materialize`,
      services: ["Hard facilities management", "Reactive building maintenance"],
      country: "United Kingdom",
      eligibleProfile: false,
    });
    await prisma.companyMatchingProfile.deleteMany({
      where: { companyId: company.id },
    });
    const before = await prisma.companyMatchingProfile.findUnique({
      where: { companyId: company.id },
    });
    assert.equal(before, null);

    const previewBefore = await previewMatchingProfileForCompany(company.id);
    assert.equal(previewBefore.stored, null);
    assert.equal(previewBefore.derived.eligible, true);

    const rebuilt = await rebuildMatchingProfileForCompany(company.id);
    assert.equal(rebuilt.eligible, true);
    assert.ok(rebuilt.snapshot.services.some((s) => s.value.includes("facilities")));
    assert.ok(
      rebuilt.snapshot.geographies.some(
        (g) => /united kingdom|morocco/i.test(g.value),
      ),
    );

    const stored = await prisma.companyMatchingProfile.findUnique({
      where: { companyId: company.id },
    });
    assert.ok(stored);
    assert.equal(stored!.eligible, true);
    assert.equal(stored!.contentHash, rebuilt.contentHash);

    const previewAfter = await previewMatchingProfileForCompany(company.id);
    assert.equal(previewAfter.propagationStale, false);
    assert.equal(previewAfter.derived.contentHash, stored!.contentHash);
  });

  it("preview remains read-only (does not create Matching Profile)", async () => {
    const company = await seedCompany({
      name: `Preview Only ${PREFIX}`,
      slug: `${PREFIX}preview-only`,
      eligibleProfile: false,
    });
    await prisma.companyMatchingProfile.deleteMany({
      where: { companyId: company.id },
    });
    await previewMatchingProfileForCompany(company.id);
    const stillMissing = await prisma.companyMatchingProfile.findUnique({
      where: { companyId: company.id },
    });
    assert.equal(stillMissing, null);
  });

  it("SA readiness is diagnostic and admin rebuild uses supported path", async () => {
    const company = await seedCompany({
      name: `SA Ready ${PREFIX}`,
      slug: `${PREFIX}sa-ready`,
      services: ["IT services"],
      country: "France",
      eligibleProfile: false,
    });
    await prisma.companyMatchingProfile.deleteMany({
      where: { companyId: company.id },
    });

    const readiness = await getCompanyMatchingReadinessForAdmin(company.id);
    assert.equal(readiness.companyId, company.id);
    assert.equal(readiness.storedProfile.exists, false);
    assert.equal(readiness.isTestFixture, false);
    assert.ok(Array.isArray(readiness.blockers));

    const result = await rebuildMatchingProfileForAdmin(company.id);
    assert.equal(result.profile.eligible, true);
    assert.equal(result.readiness.storedProfile.exists, true);
    assert.equal(result.readiness.companyId, company.id);

    // Cross-tenant: readiness for this company must not return another company's id
    const other = await seedCompany({
      name: `Other ${PREFIX}`,
      slug: `${PREFIX}other`,
    });
    const otherReady = await getCompanyMatchingReadinessForAdmin(other.id);
    assert.equal(otherReady.companyId, other.id);
    assert.notEqual(otherReady.companyId, company.id);
  });
});
