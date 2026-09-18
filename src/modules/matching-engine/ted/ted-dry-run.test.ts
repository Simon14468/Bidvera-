/**
 * TED freshness / deadline / dry-run quality tests — mocked Search; no DB writes.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTedControlledPilotScope,
  buildTedExpertQuery,
  buildTedFreshnessQueryClause,
  evaluateTedPilotQuality,
  filterTedOpportunity,
  normalizeTedNotice,
  parseTedPublicationDate,
  resolveTedPageBudget,
  runTedOpportunityDryRun,
  type TedNoticeRaw,
} from "./index";

function mockNotice(overrides: Partial<TedNoticeRaw> = {}): TedNoticeRaw {
  return {
    "publication-number": "700001-2099",
    "notice-identifier": "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
    "notice-title": { eng: "France – IT services – Cloud" },
    "description-lot": { eng: ["Cloud hosting"] },
    "notice-type": "cn-standard",
    "form-type": "competition",
    "classification-cpv": ["72000000"],
    "place-of-performance": ["FRA"],
    "buyer-country": ["FRA"],
    "deadline-receipt-tender-date-lot": ["2099-12-01T12:00:00+01:00"],
    "publication-date": "2026-08-01Z",
    "buyer-name": { eng: ["Buyer FR"] },
    ...overrides,
  };
}

const now = new Date("2026-09-11T12:00:00Z");

describe("TED freshness & deadline quality", () => {
  it("parses TED publication-date with zone suffix", () => {
    const d = parseTedPublicationDate("2026-06-15+02:00");
    assert.ok(d);
    assert.equal(d!.toISOString().slice(0, 10), "2026-06-15");
  });

  it("parses TED deadline date-only + zone (native Date is Invalid)", () => {
    assert.equal(Number.isNaN(new Date("2026-09-24+02:00").getTime()), true);
    const d = parseTedPublicationDate("2026-09-24+02:00");
    assert.ok(d);
    assert.equal(d!.toISOString().slice(0, 10), "2026-09-24");
    const n = normalizeTedNotice(
      mockNotice({
        "deadline-receipt-tender-date-lot": ["2026-09-24+02:00"],
        "publication-date": "2026-08-01+02:00",
      }),
      { now },
    );
    assert.equal(n.ok, true);
    if (!n.ok) return;
    assert.ok(n.input.deadline);
    assert.equal(n.meta.deadlinePast, false);
  });

  it("builds relative publication-date freshness clause (not a hard-coded permanent date)", () => {
    const clause = buildTedFreshnessQueryClause(90, now);
    assert.equal(clause, "publication-date >= 20260613");
    const q = buildTedExpertQuery(
      applyTedControlledPilotScope(undefined, { freshnessDays: 30 }),
      now,
    );
    assert.match(q, /publication-date >= 20260812/);
    assert.match(q, /buyer-country IN \(MAR FRA ESP PRT\)/);
    assert.match(q, /deadline-receipt-tender-date-lot >= 20260911/);
    assert.match(q, /classification-cpv = 72\*/);
  });

  it("rejects old notice when freshness configured; accepts fresh + future deadline", () => {
    const oldN = normalizeTedNotice(
      mockNotice({
        "publication-number": "700010-2099",
        "publication-date": "2016-03-25Z",
      }),
      { now },
    );
    assert.equal(oldN.ok, true);
    if (!oldN.ok) return;
    const oldDecision = filterTedOpportunity(oldN.input, oldN.meta, {
      geographies: ["France"],
      cpvFilters: ["72"],
      formTypes: ["competition"],
      requireDeadline: true,
      excludePastDeadline: true,
      freshnessDays: 90,
      now,
    });
    assert.equal(oldDecision.accept, false);
    assert.match(oldDecision.reason ?? "", /freshness|publication-date/i);

    const fresh = normalizeTedNotice(mockNotice(), { now });
    assert.equal(fresh.ok, true);
    if (!fresh.ok) return;
    const ok = filterTedOpportunity(fresh.input, fresh.meta, {
      geographies: ["France"],
      cpvFilters: ["72"],
      formTypes: ["competition"],
      requireDeadline: true,
      excludePastDeadline: true,
      freshnessDays: 90,
      now,
    });
    assert.equal(ok.accept, true);
  });

  it("requireDeadline rejects missing and expired deadlines; never invents", () => {
    const missing = normalizeTedNotice(
      mockNotice({
        "publication-number": "700020-2099",
        "deadline-receipt-tender-date-lot": [],
      }),
      { now },
    );
    assert.equal(missing.ok, true);
    if (!missing.ok) return;
    assert.equal(missing.input.deadline, null);
    const miss = filterTedOpportunity(missing.input, missing.meta, {
      geographies: ["France"],
      cpvFilters: [],
      formTypes: ["competition"],
      requireDeadline: true,
      excludePastDeadline: true,
      freshnessDays: 0,
      now,
    });
    assert.equal(miss.accept, false);
    assert.match(miss.reason ?? "", /deadline required/i);

    const expired = normalizeTedNotice(
      mockNotice({
        "publication-number": "700021-2099",
        "deadline-receipt-tender-date-lot": ["2020-01-01T00:00:00Z"],
      }),
      { now },
    );
    assert.equal(expired.ok, true);
    if (!expired.ok) return;
    const exp = filterTedOpportunity(expired.input, expired.meta, {
      geographies: ["France"],
      cpvFilters: [],
      formTypes: ["competition"],
      requireDeadline: true,
      excludePastDeadline: true,
      freshnessDays: 0,
      now,
    });
    assert.equal(exp.accept, false);
    assert.match(exp.reason ?? "", /future|past/i);
  });

  it("geo + CPV filters work; dry-run reports zero-result countries + quality metrics", async () => {
    const report = await runTedOpportunityDryRun({
      settings: applyTedControlledPilotScope(undefined, {
        freshnessDays: 90,
        requireDeadline: true,
        maxNoticesPerRun: 20,
        cpvFilters: ["72", "45"],
      }),
      now,
      notices: [
        mockNotice({ "publication-number": "700030-2099" }),
        mockNotice({
          "publication-number": "700031-2099",
          "notice-title": { eng: "Spain – Construction" },
          "classification-cpv": ["45000000"],
          "place-of-performance": ["ESP"],
          "buyer-country": ["ESP"],
          "publication-date": "2026-08-15Z",
        }),
        mockNotice({
          "publication-number": "700032-2099",
          "notice-title": { eng: "Germany – IT" },
          "place-of-performance": ["DEU"],
          "buyer-country": ["DEU"],
          "publication-date": "2026-08-15Z",
        }),
        mockNotice({
          "publication-number": "700033-2099",
          "publication-date": "2016-01-01Z",
        }),
        mockNotice({
          "publication-number": "700034-2099",
          "deadline-receipt-tender-date-lot": [],
          "publication-date": "2026-08-15Z",
        }),
      ],
    });

    assert.equal(report.wroteToDatabase, false);
    assert.ok(report.activeCandidates >= 2);
    assert.ok(report.filteredOut >= 2);
    assert.ok(report.quality.zeroResultCountries.includes("Morocco"));
    assert.ok(report.quality.zeroResultCountries.includes("Portugal"));
    assert.ok(report.quality.countriesWithHits.includes("France"));
    assert.ok(report.quality.countriesWithHits.includes("Spain"));
    assert.ok(report.quality.deadlineCoveragePct >= 95);
    assert.ok((report.quality.freshnessCompliancePct ?? 0) >= 95);
    assert.ok(report.quality.freshnessCutoffYmd);
    assert.ok(report.qualityVerdict === "READY_FOR_LIVE_INGEST" || report.qualityVerdict === "NOT_READY");
    assert.equal(report.qualityEvaluation.criteria.minActiveCandidates, 5);
    // With only 2 active, verdict should be NOT_READY under default criteria.
    assert.equal(report.qualityVerdict, "NOT_READY");
    assert.ok(
      report.qualityEvaluation.failures.some((f) => /activeCandidates/i.test(f)),
    );
  });

  it("bounded pagination still capped; quality verdict READY when criteria met", async () => {
    const budget = resolveTedPageBudget(
      applyTedControlledPilotScope(undefined, {
        pageLimit: 10,
        maxNoticesPerRun: 25,
        maxPagesPerRun: 2,
      }),
    );
    assert.equal(budget.maxPages, 2);

    const notices = Array.from({ length: 6 }, (_, i) =>
      mockNotice({
        "publication-number": `${710000 + i}-2099`,
        "publication-date": "2026-08-20Z",
        "place-of-performance": i % 2 === 0 ? ["FRA"] : ["ESP"],
        "buyer-country": i % 2 === 0 ? ["FRA"] : ["ESP"],
      }),
    );
    const report = await runTedOpportunityDryRun({
      settings: applyTedControlledPilotScope(undefined, {
        freshnessDays: 90,
        requireDeadline: true,
        cpvFilters: ["72"],
      }),
      now,
      notices,
      qualityCriteria: {
        minActiveCandidates: 5,
        minDeadlineCoveragePct: 95,
        minFreshnessCompliancePct: 95,
        requireAtLeastOneConfiguredCountryHit: true,
      },
    });
    assert.ok(report.activeCandidates >= 5);
    assert.equal(report.qualityVerdict, "READY_FOR_LIVE_INGEST");
    assert.equal(report.qualityEvaluation.failures.length, 0);
  });

  it("evaluateTedPilotQuality is deterministic without AI", () => {
    const ready = evaluateTedPilotQuality({
      activeCandidates: 10,
      acceptedCandidates: 10,
      deadlineCoveragePct: 100,
      freshnessCompliancePct: 100,
      freshnessDays: 90,
      countriesWithHits: ["France"],
      configuredCountries: ["Morocco", "France", "Spain", "Portugal"],
      zeroResultCountries: ["Morocco", "Spain", "Portugal"],
    });
    assert.equal(ready.verdict, "READY_FOR_LIVE_INGEST");

    const notReady = evaluateTedPilotQuality({
      activeCandidates: 0,
      acceptedCandidates: 0,
      deadlineCoveragePct: 0,
      freshnessCompliancePct: 0,
      freshnessDays: 90,
      countriesWithHits: [],
      configuredCountries: ["France"],
      zeroResultCountries: ["France"],
    });
    assert.equal(notReady.verdict, "NOT_READY");
  });
});
