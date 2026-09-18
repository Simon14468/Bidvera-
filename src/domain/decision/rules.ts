import type { DeterministicFinding, RuleCompanyProfile, RuleRequirement } from "./types";
import {
  evaluateGeographicCoverage,
  isBidderGeographicCoverageObligation,
} from "./geographic-coverage";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
}

function profileHasCertification(profile: RuleCompanyProfile, needle: string): boolean {
  const n = normalize(needle);
  return profile.certifications.some((c) => {
    if (/^not_held:/i.test(c)) return false;
    const nc = normalize(c.replace(/^NOT_HELD:/i, ""));
    return nc.includes(n) || n.includes(nc);
  });
}

function profileExplicitlyLacksCertification(
  profile: RuleCompanyProfile,
  needle: string,
): boolean {
  const n = normalize(needle);
  return profile.certifications.some((c) => {
    if (!/^not_held:/i.test(c)) return false;
    const nc = normalize(c.replace(/^NOT_HELD:/i, ""));
    return nc.includes(n) || n.includes(nc);
  });
}

function parseRevenueFloor(range: string | null): number | null {
  if (!range) return null;
  const m = range.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(m|million|k)?/i);
  if (!m) return null;
  let n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("m")) n *= 1_000_000;
  if (unit === "k") n *= 1_000;
  return n;
}

function extractRequiredRevenue(text: string): number | null {
  const m = text
    .replace(/,/g, "")
    .match(
      /(?:turnover|revenue|annual)\D{0,20}(?:not less than|minimum|at least|of)?\s*£?\s*\$?\s*(\d+(?:\.\d+)?)\s*(m|million|k)?/i,
    );
  if (!m) return null;
  let n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("m")) n *= 1_000_000;
  if (unit === "k") n *= 1_000;
  return n;
}

function extractRequiredYears(text: string): number | null {
  const m = text.match(/(\d+)\s*\+?\s*years?/i);
  return m ? Number(m[1]) : null;
}

const COMPANY_PROFILE_SOURCE = "Company Profile";

/** Attach traceable company-profile provenance for rule-confirmed gaps. */
function withProfileGapEvidence(
  req: RuleRequirement,
  excerpt: string,
): RuleRequirement {
  const hasCompanyProvenance =
    Boolean(req.sourceDocument?.trim()) &&
    Boolean(req.evidence?.trim()) &&
    !/^tender\b/i.test(req.sourceDocument!.trim());
  if (hasCompanyProvenance) {
    return { ...req, rationale: excerpt };
  }
  return {
    ...req,
    sourceDocument: COMPANY_PROFILE_SOURCE,
    evidence: excerpt,
    rationale: excerpt,
  };
}

/**
 * Deterministic rule engine — hard failures override AI optimism.
 * Never invents facts; ambiguous cases stay UNCERTAIN.
 */
export function evaluateDeterministicRules(input: {
  profile: RuleCompanyProfile;
  requirements: RuleRequirement[];
  estimatedValue: number | null;
}): { findings: DeterministicFinding[]; requirements: RuleRequirement[] } {
  const findings: DeterministicFinding[] = [];
  const requirements = input.requirements.map((req, index) => {
    const text = `${req.category} ${req.description} ${req.value ?? ""}`;
    const n = normalize(text);
    let status = req.status;
    let patched = req;

    // Certification checks
    const certMatch = text.match(
      /\b(ISO\s?\d+|Cyber Essentials(?:\sPlus)?|CHAS|SafeContractor|NICEIC|Constructionline)\b/i,
    );
    if (certMatch && req.mandatory) {
      const cert = certMatch[1];
      if (profileExplicitlyLacksCertification(input.profile, cert)) {
        status = "FAILED";
        findings.push({
          code: "CERT_EXPLICITLY_NOT_HELD",
          severity: "CRITICAL",
          category: "certification",
          description: `Company profile explicitly states certification "${cert}" is not held.`,
          forcesDecision: "NO_BID",
          requirementStatus: "FAILED",
          requirementIndex: index,
        });
        patched = withProfileGapEvidence(
          patched,
          `NOT_HELD: ${cert} — company profile explicitly states this certification is not held.`,
        );
      } else if (input.profile.certifications.filter((c) => !/^not_held:/i.test(c)).length === 0) {
        status = "UNCERTAIN";
        findings.push({
          code: "CERT_UNKNOWN",
          severity: "HIGH",
          category: "certification",
          description: `Required certification "${cert}" cannot be verified — not listed on company profile.`,
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: index,
        });
      } else if (!profileHasCertification(input.profile, cert)) {
        status = "UNCERTAIN";
        findings.push({
          code: "CERT_MISSING",
          severity: "HIGH",
          category: "certification",
          description: `Required certification "${cert}" is not listed on the company profile — verification needed before treating as a gap.`,
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: index,
        });
      } else {
        status = "MATCHED";
      }
    }

    // Revenue / turnover thresholds
    const requiredRevenue = extractRequiredRevenue(text);
    const companyRevenue = parseRevenueFloor(input.profile.revenueRange);
    if (requiredRevenue && req.mandatory) {
      if (companyRevenue == null) {
        status = status === "FAILED" ? status : "UNCERTAIN";
        findings.push({
          code: "REVENUE_UNKNOWN",
          severity: "HIGH",
          category: "financial",
          description: `Mandatory revenue/turnover threshold detected but company revenue is not set.`,
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: index,
        });
      } else if (companyRevenue < requiredRevenue) {
        status = "FAILED";
        findings.push({
          code: "REVENUE_BELOW",
          severity: "CRITICAL",
          category: "financial",
          description: `Required turnover/revenue threshold is not met.`,
          forcesDecision: "NO_BID",
          requirementStatus: "FAILED",
          requirementIndex: index,
        });
        patched = withProfileGapEvidence(
          patched,
          `Company revenue (${input.profile.revenueRange}) is below the required threshold.`,
        );
      } else {
        status = status === "FAILED" ? status : "MATCHED";
      }
    }

    // Experience years — prefer numeric years; else optional experienceLevel mapping happens in company-fit
    const requiredYears = extractRequiredYears(text);
    if (
      requiredYears &&
      req.mandatory &&
      /\b(experience|trading|established)\b/i.test(text)
    ) {
      if (input.profile.experienceYears == null && !input.profile.experienceLevel) {
        status = status === "FAILED" ? status : "UNCERTAIN";
        findings.push({
          code: "EXPERIENCE_UNKNOWN",
          severity: "MEDIUM",
          category: "experience",
          description: `Required experience years cannot be verified — not provided on the company profile.`,
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: index,
        });
      } else if (
        input.profile.experienceYears != null &&
        input.profile.experienceYears < requiredYears
      ) {
        status = "FAILED";
        findings.push({
          code: "EXPERIENCE_BELOW",
          severity: "CRITICAL",
          category: "experience",
          description: `Required experience (${requiredYears}+ years) is not met based on profile years.`,
          forcesDecision: "NO_BID",
          requirementStatus: "FAILED",
          requirementIndex: index,
        });
        patched = withProfileGapEvidence(
          patched,
          `Company profile states ${input.profile.experienceYears} years experience; tender requires ${requiredYears}+ years.`,
        );
      } else if (input.profile.experienceYears != null) {
        status = status === "FAILED" ? status : "MATCHED";
      } else {
        // Level only — keep UNCERTAIN for human verification (not a hard NO_BID)
        status = status === "FAILED" ? status : "UNCERTAIN";
        findings.push({
          code: "EXPERIENCE_LEVEL_ONLY",
          severity: "MEDIUM",
          category: "experience",
          description: `Tender cites ${requiredYears}+ years; profile has experience level only — requires verification.`,
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: index,
        });
      }
    }

    // Geography — only real bidder geographic coverage obligations; never incidental "national*"
    const geoEval = evaluateGeographicCoverage(input.profile, text);
    if (
      geoEval.covers === false &&
      req.mandatory &&
      isBidderGeographicCoverageObligation(text)
    ) {
      status = "FAILED";
      findings.push({
        code: "GEO_MISMATCH",
        severity: "HIGH",
        category: "geography",
        description: "Geographic coverage requirement does not match company profile.",
        forcesDecision: "NO_BID",
        requirementStatus: "FAILED",
        requirementIndex: index,
      });
      const coverage =
        input.profile.geographicCoverage.join(", ") || input.profile.country || "not stated";
      patched = withProfileGapEvidence(
        patched,
        `Company geographic coverage (${coverage}) does not satisfy tender geography requirement.`,
      );
    } else if (geoEval.covers === true) {
      status = status === "FAILED" ? status : "MATCHED";
    } else if (
      isBidderGeographicCoverageObligation(text) &&
      req.mandatory &&
      geoEval.covers === null &&
      geoEval.reason !== "deferred_past_bidding" &&
      geoEval.reason !== "not_bidder_geographic_obligation"
    ) {
      // Missing / unresolved company geography → verification, never confirmed gap
      status = status === "FAILED" ? status : "UNCERTAIN";
      findings.push({
        code: "GEOGRAPHY_UNKNOWN",
        severity: "MEDIUM",
        category: "geography",
        description:
          "Geographic coverage requirement requires verification against company profile.",
        forcesDecision: "REVIEW",
        requirementStatus: "UNCERTAIN",
        requirementIndex: index,
      });
    }

    // Contract size preference (soft unless clearly out of band)
    if (
      input.estimatedValue != null &&
      input.profile.contractSizeMax != null &&
      input.estimatedValue > input.profile.contractSizeMax * 1.5
    ) {
      findings.push({
        code: "CONTRACT_SIZE_HIGH",
        severity: "MEDIUM",
        category: "commercial",
        description: "Estimated contract value materially exceeds preferred maximum.",
        forcesDecision: "REVIEW",
      });
    }

    // Custom rules — keyword hard blocks only when clearly indicated
    for (const rule of input.profile.customQualificationRules) {
      const rn = normalize(rule);
      if (rn.includes("do not bid") || rn.includes("never bid") || rn.includes("no-bid if")) {
        const keywords = rn
          .replace(/do not bid if|never bid if|no-bid if/g, "")
          .split(/\b(if|when|unless)\b/)
          .pop();
        if (keywords && keywords.length > 8 && n.includes(keywords.slice(0, 40).trim())) {
          findings.push({
            code: "CUSTOM_RULE",
            severity: "HIGH",
            category: "custom_rule",
            description: `Company qualification rule triggered: ${rule}`,
            forcesDecision: "NO_BID",
          });
        }
      }
    }

    return { ...patched, status };
  });

  return { findings, requirements };
}
