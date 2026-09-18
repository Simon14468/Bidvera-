import {
  BID_SCORE_BANDS,
  BID_SCORE_PENALTIES,
  BID_SCORE_WEIGHTS,
} from "@/config/bid-score";
import type {
  BidPriority,
  BidScoreBreakdown,
  BidScoreInput,
  QualitativeLevel,
  ScoreDriver,
} from "./types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function priorityFor(score: number): {
  priority: BidPriority;
  priorityLabel: string;
} {
  const band =
    BID_SCORE_BANDS.find((b) => score >= b.min && score <= b.max) ??
    BID_SCORE_BANDS[BID_SCORE_BANDS.length - 1];
  return { priority: band.priority, priorityLabel: band.label };
}

function interpretationFor(priority: BidPriority): string {
  switch (priority) {
    case "VERY_HIGH":
      return "This opportunity currently appears highly attractive based on the available evidence.";
    case "HIGH":
      return "This opportunity currently appears attractive based on the available evidence.";
    case "MEDIUM":
      return "This opportunity appears moderately attractive; review remaining gaps before committing effort.";
    case "LOW":
      return "This opportunity currently appears less attractive relative to effort and risk.";
    case "VERY_LOW":
      return "This opportunity currently appears a low priority based on the available evidence.";
  }
}

function estimateEffort(input: BidScoreInput): {
  effort: QualitativeLevel;
  note: string;
} {
  if (input.requirementCount <= 0 && input.compliance.total <= 0) {
    return { effort: "UNKNOWN", note: "Effort: Unknown — insufficient requirement data." };
  }
  const pressure =
    (input.compliance.missingMandatory * 2 +
      input.compliance.verifyMandatory +
      input.compliance.missing +
      Math.floor(input.requirementCount / 8) +
      (input.daysUntilDeadline != null && input.daysUntilDeadline <= 7 ? 2 : 0) +
      input.criticalRiskCount * 2 +
      input.highRiskCount);

  if (pressure >= 8) {
    return {
      effort: "HIGH",
      note: "Effort appears high based on gaps, verification load, and/or deadline pressure.",
    };
  }
  if (pressure >= 4) {
    return {
      effort: "MEDIUM",
      note: "Effort appears moderate based on current requirement and risk signals.",
    };
  }
  return {
    effort: "LOW",
    note: "Effort appears relatively low based on available requirement signals.",
  };
}

function riskLevel(input: BidScoreInput): QualitativeLevel {
  if (input.criticalRiskCount > 0) return "HIGH";
  if (input.highRiskCount >= 2) return "HIGH";
  if (input.highRiskCount === 1 || input.compliance.missingMandatory > 0) {
    return "MEDIUM";
  }
  if (input.compliance.total === 0 && input.fitScore == null) return "UNKNOWN";
  return "LOW";
}

function expectedValue(input: {
  score: number;
  contractKnown: boolean;
  risk: QualitativeLevel;
  effort: QualitativeLevel;
}): { level: QualitativeLevel; note: string } {
  // Pursuit cost is never fabricated — without both value and cost, prefer UNKNOWN.
  if (!input.contractKnown) {
    return {
      level: "UNKNOWN",
      note: "Expected Value: UNKNOWN — contract value and pursuit cost are not available. No numbers were invented.",
    };
  }

  // Contract value known (KNOWN) but pursuit cost / win probability still unavailable →
  // qualitative only; never a numeric EV / ROI / revenue forecast.
  if (input.score >= 80 && input.risk === "LOW" && input.effort !== "HIGH") {
    return {
      level: "HIGH",
      note: "Opportunity value is specified and current evidence suggests relatively favorable attractiveness — still not guaranteed revenue. Pursuit cost remains unknown.",
    };
  }
  if (input.score >= 60) {
    return {
      level: "MEDIUM",
      note: "Opportunity value is specified; attractiveness is moderate after risk/effort. Not a profit forecast. Pursuit cost remains unknown.",
    };
  }
  return {
    level: "LOW",
    note: "Opportunity value is specified but attractiveness appears limited after risk/effort. Pursuit cost remains unknown.",
  };
}

/**
 * Deterministic Bid Score from stored analysis inputs.
 * Reproducible. Never invents financials or win probability.
 */
export function computeBidScore(input: BidScoreInput): BidScoreBreakdown {
  const drivers: ScoreDriver[] = [];
  const fit = input.fitScore;
  const readiness = input.readinessScore;

  const complianceRatio =
    input.compliance.total > 0
      ? input.compliance.ready / input.compliance.total
      : null;

  let blend = 0;
  let weightSum = 0;

  if (fit != null) {
    blend += fit * BID_SCORE_WEIGHTS.fit;
    weightSum += BID_SCORE_WEIGHTS.fit;
    if (fit >= 70) drivers.push({ direction: "positive", label: "Strong company–tender fit" });
    else if (fit < 45) {
      drivers.push({ direction: "negative", label: "Weak company–tender fit" });
    }
  }

  if (readiness != null) {
    blend += readiness * BID_SCORE_WEIGHTS.readiness;
    weightSum += BID_SCORE_WEIGHTS.readiness;
    if (readiness >= 70) {
      drivers.push({ direction: "positive", label: "High tender readiness" });
    } else if (readiness < 45) {
      drivers.push({ direction: "negative", label: "Low tender readiness" });
    }
  }

  if (complianceRatio != null) {
    blend += complianceRatio * 100 * BID_SCORE_WEIGHTS.compliance;
    weightSum += BID_SCORE_WEIGHTS.compliance;
    if (complianceRatio >= 0.7) {
      drivers.push({ direction: "positive", label: "Strong compliance readiness" });
    }
  }

  let score = weightSum > 0 ? blend / weightSum : 50;

  // Penalties — current evidence
  let riskPenalty = 0;
  riskPenalty += input.criticalRiskCount * BID_SCORE_PENALTIES.criticalRisk;
  riskPenalty += input.highRiskCount * BID_SCORE_PENALTIES.highRisk;
  riskPenalty = Math.min(riskPenalty, BID_SCORE_PENALTIES.maxRiskPenalty);
  score -= riskPenalty;
  if (input.criticalRiskCount > 0 || input.highRiskCount > 0) {
    drivers.push({
      direction: "negative",
      label:
        input.criticalRiskCount > 0
          ? "Critical unresolved risk"
          : "Elevated unresolved risk",
    });
  }

  const missingPenalty = Math.min(
    input.compliance.missingMandatory * BID_SCORE_PENALTIES.missingMandatory,
    BID_SCORE_PENALTIES.maxMissingMandatoryPenalty,
  );
  score -= missingPenalty;
  if (input.compliance.missingMandatory > 0) {
    drivers.push({
      direction: "negative",
      label: "Unresolved mandatory requirements",
    });
  }

  const verifyPenalty = Math.min(
    input.compliance.verifyMandatory * BID_SCORE_PENALTIES.verifyMandatory,
    BID_SCORE_PENALTIES.maxVerifyMandatoryPenalty,
  );
  score -= verifyPenalty;
  if (input.compliance.verifyMandatory > 0) {
    drivers.push({
      direction: "negative",
      label: "Mandatory items require verification",
    });
  }

  const { effort, note: effortNote } = estimateEffort(input);
  if (effort === "HIGH") {
    score -= BID_SCORE_PENALTIES.effortHigh;
    drivers.push({ direction: "negative", label: "High estimated pursuit effort" });
  } else if (effort === "MEDIUM") {
    score -= BID_SCORE_PENALTIES.effortMedium;
    drivers.push({ direction: "negative", label: "Moderate estimated pursuit effort" });
  } else if (effort === "LOW") {
    drivers.push({ direction: "positive", label: "Relatively lower estimated effort" });
  }

  if (input.daysUntilDeadline != null && input.daysUntilDeadline <= 7) {
    score -= 5;
    drivers.push({ direction: "negative", label: "Short submission deadline" });
  }

  // Historical — secondary only, never overrides mandatory gaps
  const hist = input.historical;
  const histOk =
    hist?.detected &&
    hist.influenceAllowed &&
    input.compliance.missingMandatory === 0;
  if (histOk && hist.lean === "more_often_successful") {
    score += BID_SCORE_PENALTIES.historicalPositive;
    drivers.push({
      direction: "positive",
      label: "Relevant verified historical signal (positive)",
    });
  } else if (histOk && hist.lean === "more_often_unsuccessful") {
    score -= BID_SCORE_PENALTIES.historicalNegative;
    drivers.push({
      direction: "negative",
      label: "Relevant verified historical signal (cautionary)",
    });
  } else if (hist?.detected && !hist.influenceAllowed) {
    drivers.push({
      direction: "negative",
      label: "Historical signal noted but current evidence takes priority",
    });
  }

  if (input.compliance.missingMandatory === 0 && missingPenalty === 0 && riskPenalty === 0) {
    if (fit != null && fit >= 65 && (readiness == null || readiness >= 60)) {
      drivers.push({ direction: "positive", label: "Low unresolved blocker load" });
    }
  }

  score = clamp(score);
  const { priority, priorityLabel } = priorityFor(score);

  const rawValue = input.estimatedValue;
  const contractKnown =
    rawValue != null && Number.isFinite(rawValue) && rawValue > 0 && rawValue <= 1e15;
  const reducedCertainty =
    !contractKnown ||
    fit == null ||
    readiness == null ||
    input.compliance.total === 0 ||
    effort === "UNKNOWN";

  const risk = riskLevel(input);
  const ev = expectedValue({
    score,
    contractKnown,
    risk,
    effort,
  });

  // Deduplicate drivers
  const seen = new Set<string>();
  const uniqueDrivers = drivers.filter((d) => {
    const key = `${d.direction}:${d.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    score,
    priority,
    priorityLabel,
    interpretation: interpretationFor(priority),
    expectedValue: ev.level,
    expectedValueNote: ev.note,
    contractValue: contractKnown ? input.estimatedValue : null,
    contractValueLabel: contractKnown
      ? `Contract value: ${input.estimatedValue!.toLocaleString()}`
      : "Contract value: Not specified",
    contractValueProvenance: contractKnown ? "KNOWN" : "UNKNOWN",
    pursuitCost: null,
    pursuitCostLabel: "Estimated pursuit cost: Unknown",
    pursuitCostProvenance: "UNKNOWN",
    winProbabilityLabel: "Win probability: Not available",
    winProbabilityProvenance: "UNKNOWN",
    effort,
    effortNote,
    riskLevel: risk,
    drivers: uniqueDrivers.slice(0, 10),
    reducedCertainty,
    certaintyNote: reducedCertainty
      ? "Certainty reduced — some financial or requirement inputs are unavailable. No values were invented."
      : null,
    disclaimer:
      "Bid Score ranks opportunity priority based on available evidence. It is not a probability of winning, revenue forecast, or Bid/No-Bid decision.",
  };
}
