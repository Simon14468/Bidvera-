/**
 * Deterministic TED pilot quality verdict — no AI.
 */

export type TedPilotQualityVerdict = "READY_FOR_LIVE_INGEST" | "NOT_READY";

export type TedPilotQualityCriteria = {
  /** Minimum ACTIVE candidates after filters. */
  minActiveCandidates: number;
  /** Accepted with future deadline / accepted * 100. */
  minDeadlineCoveragePct: number;
  /** Accepted within freshness window / accepted * 100 (when freshnessDays > 0). */
  minFreshnessCompliancePct: number;
  /** At least one configured geography must appear in accepted set. */
  requireAtLeastOneConfiguredCountryHit: boolean;
};

export const DEFAULT_TED_PILOT_QUALITY_CRITERIA: TedPilotQualityCriteria = {
  minActiveCandidates: 5,
  minDeadlineCoveragePct: 95,
  minFreshnessCompliancePct: 95,
  requireAtLeastOneConfiguredCountryHit: true,
};

export type TedPilotQualityInput = {
  activeCandidates: number;
  acceptedCandidates: number;
  deadlineCoveragePct: number;
  freshnessCompliancePct: number | null;
  freshnessDays: number;
  countriesWithHits: string[];
  configuredCountries: string[];
  zeroResultCountries: string[];
};

export type TedPilotQualityResult = {
  verdict: TedPilotQualityVerdict;
  criteria: TedPilotQualityCriteria;
  failures: string[];
};

export function evaluateTedPilotQuality(
  input: TedPilotQualityInput,
  criteria: TedPilotQualityCriteria = DEFAULT_TED_PILOT_QUALITY_CRITERIA,
): TedPilotQualityResult {
  const failures: string[] = [];

  if (input.activeCandidates < criteria.minActiveCandidates) {
    failures.push(
      `activeCandidates ${input.activeCandidates} < min ${criteria.minActiveCandidates}`,
    );
  }

  if (input.acceptedCandidates === 0) {
    failures.push("no accepted candidates");
  } else if (input.deadlineCoveragePct < criteria.minDeadlineCoveragePct) {
    failures.push(
      `deadlineCoveragePct ${input.deadlineCoveragePct.toFixed(1)}% < min ${criteria.minDeadlineCoveragePct}%`,
    );
  }

  if (input.freshnessDays > 0) {
    const pct = input.freshnessCompliancePct ?? 0;
    if (pct < criteria.minFreshnessCompliancePct) {
      failures.push(
        `freshnessCompliancePct ${pct.toFixed(1)}% < min ${criteria.minFreshnessCompliancePct}%`,
      );
    }
  }

  if (
    criteria.requireAtLeastOneConfiguredCountryHit &&
    input.configuredCountries.length > 0 &&
    input.countriesWithHits.length === 0
  ) {
    failures.push("no configured geography produced accepted notices");
  }

  return {
    verdict: failures.length === 0 ? "READY_FOR_LIVE_INGEST" : "NOT_READY",
    criteria,
    failures,
  };
}
