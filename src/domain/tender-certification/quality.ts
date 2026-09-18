/**
 * Structural / semantic anomaly detection for certification (non tender-specific).
 */

import { isStructuralHeading, isNonRequirementText } from "@/domain/tender-requirements/filter-non-requirements";
import type { CertificationFinding, CertificationRequirementRow } from "./types";

const INCOMPLETE_TAIL =
  /\b(shall be|shall|must be|must|responsible to|will be|is required to|completely)\s*$/i;

const FORBIDDEN_CANONICAL_KINDS = new Set([
  "REVIEWER_INSTRUCTION",
  "TEST_SCENARIO",
  "QA_META",
]);

export function looksLikeIncompleteFragment(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 8) return false;
  return INCOMPLETE_TAIL.test(t);
}

export function detectCertificationAnomalies(
  requirements: CertificationRequirementRow[],
): CertificationFinding[] {
  const findings: CertificationFinding[] = [];
  const n = requirements.length;
  if (n === 0) return findings;

  let headingLike = 0;
  let nonObligation = 0;
  let short = 0;
  let forbiddenKind = 0;
  const textCounts = new Map<string, number>();

  for (const r of requirements) {
    const text = (r.requirement ?? "").replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    textCounts.set(key, (textCounts.get(key) ?? 0) + 1);

    if (isStructuralHeading(text)) headingLike += 1;
    if (isNonRequirementText(text)) nonObligation += 1;
    if (text.length > 0 && text.length < 24) short += 1;
    if (looksLikeIncompleteFragment(text)) {
      findings.push({
        code: "REQUIREMENT_FRAGMENT",
        severity: "CRITICAL",
        category: "EXTRACTION",
        message: `Incomplete requirement fragment ending: "${text.slice(-40)}"`,
        requirementId: r.id,
      });
    }
    if (r.semanticKind && FORBIDDEN_CANONICAL_KINDS.has(r.semanticKind)) {
      forbiddenKind += 1;
      findings.push({
        code: "REQUIREMENT_SEMANTIC_INVALID",
        severity: "CRITICAL",
        category: "SEMANTIC",
        message: `Forbidden semanticKind in canonical set: ${r.semanticKind}`,
        requirementId: r.id,
      });
    }
  }

  for (const [text, count] of textCounts) {
    if (count >= 3 && text.length > 40) {
      findings.push({
        code: "REQUIREMENT_DUPLICATE",
        severity: "WARNING",
        category: "REQUIREMENT",
        message: `Identical requirement text repeated ${count} times`,
      });
    }
  }

  const headingRatio = headingLike / n;
  const nonOblRatio = nonObligation / n;
  const shortRatio = short / n;

  if (headingRatio >= 0.15 || headingLike >= 8) {
    findings.push({
      code: "CERTIFICATION_ANOMALY",
      severity: "CRITICAL",
      category: "QUALITY",
      message: `Excessive heading-like requirements (${headingLike}/${n})`,
    });
  } else if (headingLike > 0) {
    findings.push({
      code: "REQUIREMENT_HEADING",
      severity: "WARNING",
      category: "QUALITY",
      message: `${headingLike} heading-like requirement(s) remain in canonical set`,
    });
  }

  if (nonOblRatio >= 0.2 || nonObligation >= 12) {
    findings.push({
      code: "CERTIFICATION_ANOMALY",
      severity: "CRITICAL",
      category: "QUALITY",
      message: `Excessive non-obligation text in canonical set (${nonObligation}/${n})`,
    });
  } else if (nonObligation > 0) {
    findings.push({
      code: "REQUIREMENT_NON_OBLIGATION",
      severity: "WARNING",
      category: "QUALITY",
      message: `${nonObligation} non-obligation-like requirement(s) detected`,
    });
  }

  if (shortRatio >= 0.35 && n >= 20) {
    findings.push({
      code: "CERTIFICATION_ANOMALY",
      severity: "HIGH",
      category: "QUALITY",
      message: `Suspiciously short requirements (${short}/${n})`,
    });
  }

  if (forbiddenKind > 0) {
    // already pushed per-row critical findings
  }

  return findings;
}
