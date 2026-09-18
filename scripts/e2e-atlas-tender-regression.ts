/**
 * End-to-end Atlas Company + Tender ground-truth regression.
 *
 * Does NOT modify production scoring/UI. Uses production domain modules only.
 * Oracle expectations are for PASS/FAIL reporting — never written into product logic.
 *
 * Run:
 *   npx tsx scripts/generate-atlas-regression-tender.ts
 *   npx tsx scripts/e2e-atlas-tender-regression.ts
 */
import fs from "fs";
import path from "path";
import {
  COMPANY_ONLY_MESSAGE,
  HISTORICAL_CANDIDATE_HEADLINE,
  classifyDocument,
  extractCompanyKnowledgeHeuristic,
  knowledgeToProfileFields,
  matchRequirementToKnowledge,
  missingDocumentsFromKnowledge,
  risksFromRelevantLimitations,
  type CompanyKnowledge,
  type RequirementMatchResult,
} from "@/domain/company-knowledge";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { isProfileSparse } from "@/domain/decision/company-fit";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { buildBidScoreFromAnalysis } from "@/domain/bid-score";
import { EMPTY_LEARNING_SIGNAL } from "@/domain/learning";
import { getDecisionLabel } from "@/lib/labels";

const ATLAS_PDF =
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtfy2tdc0032rkokbucq0ecq/1788102529143-Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf";
const TENDER_PDF = path.join(
  "tests",
  "fixtures",
  "regression",
  "Digital_Citizen_Services_Platform_Tender.pdf",
);

type Traffic = "GREEN" | "YELLOW" | "RED";
type Oracle = {
  id: string;
  expected: Traffic | "RED_OR_YELLOW";
  note: string;
};

/** Test oracle only — not production data. */
const ORACLE: Oracle[] = [
  { id: "R1", expected: "GREEN", note: "Web Application Development" },
  { id: "R2", expected: "GREEN", note: "Mobile Application Development" },
  { id: "R3", expected: "GREEN", note: "Cloud Deployment" },
  { id: "R4", expected: "GREEN", note: "REST API / System Integration" },
  { id: "R5", expected: "GREEN", note: "Public-sector digital project experience" },
  { id: "R6", expected: "GREEN", note: "ISO 9001" },
  { id: "R7", expected: "RED", note: "ISO 27001 mandatory / not held" },
  {
    id: "R8",
    expected: "RED",
    note: "24/7 support — explicit negative evidence → غير متوافق",
  },
  {
    id: "R9",
    expected: "RED_OR_YELLOW",
    note: "MAD 1,000,000 previous contract — limited experience above threshold",
  },
  { id: "R10", expected: "YELLOW", note: "Healthcare preferred / not stated" },
  { id: "R11", expected: "GREEN", note: "Morocco delivery" },
  {
    id: "R12",
    expected: "GREEN",
    note: "8-month operational capacity from stated company capacity",
  },
];

const ARABIC: Record<Traffic, string> = {
  GREEN: "متوافق",
  YELLOW: "يحتاج تحقق",
  RED: "غير متوافق",
};

function statusToTraffic(status: RequirementMatchResult["status"]): Traffic {
  if (status === "MATCHED") return "GREEN";
  if (status === "FAILED" || status === "MISSING") return "RED";
  return "YELLOW";
}

function oraclePass(expected: Oracle["expected"], actual: Traffic): boolean {
  if (expected === "RED_OR_YELLOW") return actual === "RED" || actual === "YELLOW";
  return expected === actual;
}

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  return typeof result === "string" ? result : (result.text ?? "");
}

/** Parse R1–R12 from the tender PDF text (tender is the requirement source). */
function extractRequirementsFromTenderText(tenderText: string): {
  id: string;
  category: string;
  description: string;
  mandatory: boolean;
  value: string | null;
}[] {
  const reqs: {
    id: string;
    category: string;
    description: string;
    mandatory: boolean;
    value: string | null;
  }[] = [];
  const re =
    /\b(R\d+)\s*[—\-]\s*([^\n(]+?)\s*\((Required|MANDATORY|Preferred[^)]*)\)\s*\n([\s\S]*?)(?=\nR\d+\s*[—\-]|\nEVALUATION|\nTenderers shall provide supporting|$)/gi;
  for (const m of tenderText.matchAll(re)) {
    const id = m[1].toUpperCase();
    const title = m[2].trim();
    const flag = m[3];
    const body = m[4].replace(/\s+/g, " ").trim();
    const mandatory = /required|mandatory/i.test(flag) && !/not mandatory/i.test(flag);
    let category = "technical";
    if (/ISO|certification/i.test(title)) category = "certification";
    else if (/24\/7|support/i.test(title)) category = "support";
    else if (/MAD|contract experience|financial|capacity/i.test(title)) category = "financial";
    else if (/Morocco|geographic|delivery/i.test(title)) category = "geography";
    else if (/Healthcare|public-sector|experience/i.test(title)) category = "experience";
    reqs.push({
      id,
      category,
      description: `${title}. ${body}`.trim(),
      mandatory,
      value: /ISO\s*\d+/i.test(title) ? title.match(/ISO\s*\d+/i)?.[0] ?? null : null,
    });
  }
  return reqs.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

function knowledgeToRuleProfile(knowledge: CompanyKnowledge): RuleCompanyProfile {
  const fields = knowledgeToProfileFields(knowledge);
  return {
    companyName: knowledge.identity.companyName,
    industry: fields.industry,
    country: fields.country,
    companySize: fields.companySize,
    experienceLevel: null,
    services: fields.services,
    certifications: fields.certifications,
    experienceYears: fields.experienceYears,
    revenueRange: null,
    employeeRange: fields.employeeRange,
    geographicCoverage: fields.geographicCoverage,
    contractSizeMin: fields.contractSizeMin,
    contractSizeMax: fields.contractSizeMax,
    customQualificationRules: fields.customQualificationRules,
  };
}

function historicalSignal(knowledge: CompanyKnowledge) {
  if (knowledge.historicalOutcomes.length === 0) return null;
  const won = knowledge.historicalOutcomes.filter((h) => h.outcome === "WON").length;
  const lost = knowledge.historicalOutcomes.filter((h) => h.outcome === "LOST").length;
  const noBid = knowledge.historicalOutcomes.filter((h) => h.outcome === "DID_NOT_BID").length;
  return {
    ...EMPTY_LEARNING_SIGNAL,
    detected: true,
    strength: "LOW" as const,
    headline: HISTORICAL_CANDIDATE_HEADLINE,
    detail: `Company-private historical records (${won} WON, ${lost} LOST, ${noBid} DID_NOT_BID).`,
    priorityNote:
      "Current tender evidence and company profile take priority. Not a verified predictive pattern.",
    validated: false,
    lifecycle: "CANDIDATE" as const,
    influenceAllowed: false,
    suppressedReason: "CANDIDATE lifecycle — not VERIFIED/ACTIVE.",
    patternRef: null,
    outcomeLean: "insufficient" as const,
    similarity: null,
  };
}

async function main() {
  if (!fs.existsSync(ATLAS_PDF)) {
    console.error("FAIL: Atlas company profile PDF not found at", ATLAS_PDF);
    process.exit(1);
  }
  if (!fs.existsSync(TENDER_PDF)) {
    console.error("Tender PDF missing — generating…");
    const { spawnSync } = await import("child_process");
    const gen = spawnSync("npx", ["tsx", "scripts/generate-atlas-regression-tender.ts"], {
      stdio: "inherit",
      shell: true,
    });
    if (gen.status !== 0 || !fs.existsSync(TENDER_PDF)) {
      console.error("FAIL: could not generate tender PDF");
      process.exit(1);
    }
  }

  const atlasText = await extractPdfText(ATLAS_PDF);
  const tenderText = await extractPdfText(TENDER_PDF);
  const atlasFile = path.basename(ATLAS_PDF);
  const tenderFile = path.basename(TENDER_PDF);

  // —— Classification ——
  const companyClass = classifyDocument({ text: atlasText, fileName: atlasFile });
  const tenderClass = classifyDocument({ text: tenderText, fileName: tenderFile });

  console.log("\n=== 0. CLASSIFICATION ===");
  console.log("Company doc:", companyClass.kind, `(confidence ${companyClass.confidence})`);
  console.log("Tender doc:", tenderClass.kind, `(confidence ${tenderClass.confidence})`);

  if (companyClass.kind !== "COMPANY_PROFILE") {
    console.error("FAIL stage=Classification: company profile not classified as COMPANY_PROFILE");
  }
  if (tenderClass.kind !== "TENDER") {
    console.error("FAIL stage=Classification: tender not classified as TENDER");
  }

  // —— Company knowledge (from company PDF only) ——
  const knowledge = extractCompanyKnowledgeHeuristic({
    text: atlasText,
    fileName: atlasFile,
  });

  console.log("\n=== 1. COMPANY KNOWLEDGE (from Company Profile PDF) ===");
  console.log("Company:", knowledge.identity.companyName);
  console.log(
    "Services:",
    knowledge.services.map((s) => s.normalizedValue).join("; "),
  );
  console.log(
    "Projects:",
    knowledge.projects.map((p) => p.name).join("; "),
  );
  console.log(
    "Certs:",
    knowledge.certifications.map((c) => `${c.name}=${c.status}`).join("; "),
  );
  const won = knowledge.historicalOutcomes.filter((h) => h.outcome === "WON").length;
  const lost = knowledge.historicalOutcomes.filter((h) => h.outcome === "LOST").length;
  const noBid = knowledge.historicalOutcomes.filter((h) => h.outcome === "DID_NOT_BID").length;
  console.log(`Historical outcomes: ${won} WON / ${lost} LOST / ${noBid} DID_NOT_BID`);

  // —— Tender requirements (from tender PDF only) ——
  const extractedReqs = extractRequirementsFromTenderText(tenderText);
  console.log("\n=== 2. REQUIREMENTS EXTRACTED (from Tender PDF) ===");
  if (extractedReqs.length === 0) {
    console.error("FAIL stage=Requirement Extraction: no R1–R12 parsed from tender PDF");
    process.exit(1);
  }
  for (const r of extractedReqs) {
    console.log(`${r.id} [${r.mandatory ? "mandatory" : "optional"}] ${r.description.slice(0, 90)}…`);
  }

  // —— Matching ——
  type Row = {
    id: string;
    description: string;
    mandatory: boolean;
    match: RequirementMatchResult;
    traffic: Traffic;
    expected: Oracle["expected"];
    pass: boolean;
  };

  const rows: Row[] = extractedReqs.map((r) => {
    const match = matchRequirementToKnowledge({
      requirementId: r.id,
      requirement: r.description,
      category: r.category,
      mandatory: r.mandatory,
      value: r.value,
      knowledge,
    });
    const traffic = statusToTraffic(match.status);
    const oracle = ORACLE.find((o) => o.id === r.id);
    const expected = oracle?.expected ?? "YELLOW";
    return {
      id: r.id,
      description: r.description,
      mandatory: r.mandatory,
      match,
      traffic,
      expected,
      pass: oraclePass(expected, traffic),
    };
  });

  console.log("\n=== 3–5. REQUIREMENT RESULTS (Expected vs Actual) ===");
  console.log(
    "ID | Expected | Actual | PASS/FAIL | Evidence | Source | Page/Section | Explanation",
  );
  for (const row of rows) {
    const expLabel =
      row.expected === "RED_OR_YELLOW"
        ? "RED|YELLOW"
        : `${row.expected} (${ARABIC[row.expected]})`;
    const actLabel = `${row.traffic} (${ARABIC[row.traffic]})`;
    const page =
      row.match.page == null
        ? "—"
        : row.match.page === "UNKNOWN"
          ? "UNKNOWN"
          : String(row.match.page);
    console.log(
      [
        row.id,
        expLabel,
        actLabel,
        row.pass ? "PASS" : "FAIL",
        row.match.evidence ?? "Evidence not found",
        row.match.sourceDocument ?? "—",
        `${page} / ${row.match.section ?? "—"}`,
        row.match.rationale,
      ].join(" | "),
    );
  }

  const reqPass = rows.filter((r) => r.pass).length;
  const reqFail = rows.filter((r) => !r.pass).length;
  console.log(`\nRequirement oracle: ${reqPass} PASS / ${reqFail} FAIL of ${rows.length}`);

  // —— Risks ——
  const risks = risksFromRelevantLimitations({
    knowledge,
    tenderText,
    estimatedValue: 600_000,
  });
  const missingDocs = missingDocumentsFromKnowledge({
    knowledge,
    tenderText,
  });
  console.log("\n=== 6. RISKS (production relevant-limitation logic) ===");
  if (risks.length === 0) console.log("(none)");
  for (const risk of risks) {
    console.log(`- [${risk.severity}] ${risk.category}: ${risk.description}`);
    console.log(
      `  source=${risk.sourceDocument ?? "—"} page=${risk.sourcePage ?? "—"}`,
    );
  }
  console.log("Missing documents:");
  if (missingDocs.length === 0) console.log("(none)");
  for (const d of missingDocs) {
    console.log(`- ${d.documentName}: ${d.reason}`);
  }

  // —— Historical ——
  const learning = historicalSignal(knowledge);
  console.log("\n=== 7. HISTORICAL INTELLIGENCE ===");
  console.log(learning?.headline ?? "No historical signal");
  console.log(learning?.detail ?? "");
  console.log(
    `lifecycle=${learning?.lifecycle} validated=${learning?.validated} influenceAllowed=${learning?.influenceAllowed}`,
  );
  console.log(
    `counts from company knowledge: WON=${won} LOST=${lost} DID_NOT_BID=${noBid}`,
  );

  // —— Decision engine + readiness + bid score (production) ——
  const profile = knowledgeToRuleProfile(knowledge);
  const engineReqs: RuleRequirement[] = rows.map((r) => ({
    id: r.id,
    category: extractedReqs.find((x) => x.id === r.id)!.category,
    description: r.description,
    mandatory: r.mandatory,
    value: extractedReqs.find((x) => x.id === r.id)!.value,
    status: r.match.status,
    evidence: r.match.evidence,
  }));

  const decision = runDecisionEngine({
    profile,
    requirements: engineReqs,
    estimatedValue: 600_000,
    tenderContext: {
      title: "Digital Citizen Services Platform",
      client: "National Public Services Authority",
      country: "Morocco",
      industry: "Public administration / Digital services",
      tenderText,
    },
    ai: null,
  });

  const readiness = computeTenderReadiness({
    requirements: decision.requirements,
    missingDocuments: missingDocs.map((d, i) => ({
      id: `md-${i}`,
      documentName: d.documentName,
      reason: d.reason,
      severity: d.severity,
    })),
    fit: decision.fitBreakdown,
    profileHasAnyCapability: !isProfileSparse(profile),
  });

  const intelligence = buildTenderIntelligence({
    tenderId: "regression-atlas-tender",
    documentName: tenderFile,
    tenderDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    extractedText: tenderText,
    requirements: decision.requirements.map((r) => ({
      id: r.id ?? "x",
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: null,
      sourceSection: null,
      evidence: r.evidence ?? null,
    })),
    evidence: rows
      .filter((r) => r.match.evidence)
      .map((r, i) => ({
        id: `ev-${i}`,
        requirementId: r.id,
        sourcePage: typeof r.match.page === "number" ? r.match.page : null,
        sourceSection: r.match.section,
        evidenceText: r.match.evidence!,
        verificationStatus:
          r.match.status === "MATCHED" ? ("VERIFIED" as const) : ("INFERRED" as const),
      })),
    readiness,
    findings: decision.findings,
    existingRisks: risks.map((r, i) => ({
      id: `risk-${i}`,
      category: r.category,
      description: r.description,
      severity: r.severity,
      sourcePage: r.sourcePage,
      mitigation: null,
    })),
    decision: decision.decision,
    fitScore: decision.fitScore,
  });
  intelligence.learningSignal = learning;

  const bidScore = buildBidScoreFromAnalysis({
    fitScore: decision.fitScore,
    fitBreakdown: decision.fitBreakdown,
    readiness,
    intelligence,
    estimatedValue: 600_000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    decision: decision.decision,
    asOf: new Date(),
  });

  console.log("\n=== 8–10. FIT / READINESS / BID SCORE / EXPECTED VALUE / DECISION ===");
  console.log(`Company–Tender Fit (single canonical): ${decision.fitScore}%`);
  console.log(
    `Fit dimensions:`,
    decision.fitBreakdown.dimensions
      .map((d) => `${d.label}=${d.score ?? "Unknown"}`)
      .join("; "),
  );
  console.log(
    `Readiness: ${readiness.score ?? "—"}% · ready=${readiness.counts.ready} verify=${readiness.counts.verify} missing=${readiness.counts.missing}`,
  );
  console.log(
    `Bid Score: ${bidScore.score}/100 — ${bidScore.priorityLabel} (${bidScore.priority})`,
  );
  console.log(`Expected Value (qualitative): ${bidScore.expectedValue}`);
  console.log(`Contract value label: ${bidScore.contractValueLabel}`);
  console.log(`Risk level: ${bidScore.riskLevel} · Effort: ${bidScore.effort}`);
  console.log(
    `Final recommendation: ${decision.decision} (${getDecisionLabel(decision.decision, "ar")} / ${getDecisionLabel(decision.decision, "en")})`,
  );
  console.log(`Confidence: ${decision.confidence}`);
  console.log(`Hard failure: ${decision.hardFailure}`);

  // Consistency: one fit value
  const fitOverall = decision.fitBreakdown.overall;
  const fitConsistent =
    fitOverall != null &&
    (decision.fitScore === fitOverall ||
      Math.abs(decision.fitScore - fitOverall) <= 1);
  console.log(`\nFit consistency (fitScore vs breakdown.overall): ${fitConsistent ? "PASS" : "FAIL"}`);

  // —— Discrepancy analysis ——
  console.log("\n=== 11. DISCREPANCIES / ROOT CAUSE ===");
  const fails = rows.filter((r) => !r.pass);
  if (fails.length === 0) {
    console.log("All requirement oracle checks PASS.");
  } else {
    for (const f of fails) {
      console.log(`\n${f.id} FAIL — expected ${f.expected}, actual ${f.traffic}`);
      console.log(`  rationale: ${f.match.rationale}`);
      let stage = "Evidence Matching";
      if (f.id === "R8" && f.traffic === "RED" && f.expected === "RED") {
        stage = "Evidence Matching — explicit negative 24/7 evidence correctly RED";
      } else if (f.id === "R9") {
        stage = "Evidence Matching / Company Knowledge — contract-value experience interpretation";
      } else if (f.id === "R5" && f.traffic !== "GREEN") {
        stage =
          "Evidence Matching — public-sector project synonym / project reference linkage";
      } else if (f.id === "R12" && f.traffic !== "GREEN") {
        stage = "Evidence Matching — capacity evidence not mapped as MATCHED";
      } else if (f.traffic === "YELLOW" && f.expected === "GREEN") {
        stage = "Evidence Matching — insufficient semantic/project link for GREEN";
      }
      console.log(`  pipeline stage: ${stage}`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        classification: { company: companyClass.kind, tender: tenderClass.kind },
        requirementsExtracted: extractedReqs.map((r) => r.id),
        requirementResults: rows.map((r) => ({
          id: r.id,
          expected: r.expected,
          actual: r.traffic,
          pass: r.pass,
          evidence: r.match.evidence ?? "Evidence not found",
        })),
        requirementPassCount: reqPass,
        requirementFailCount: reqFail,
        risks: risks.map((r) => r.description),
        missingDocuments: missingDocs.map((d) => d.documentName),
        historical: { won, lost, noBid, lifecycle: "CANDIDATE", headline: learning?.headline },
        fitScore: decision.fitScore,
        fitOverall: decision.fitBreakdown.overall,
        fitConsistent,
        readinessScore: readiness.score,
        bidScore: bidScore.score,
        expectedValue: bidScore.expectedValue,
        decision: decision.decision,
        note: COMPANY_ONLY_MESSAGE.includes("successfully")
          ? "Company+Tender path exercised (not company-only)"
          : null,
      },
      null,
      2,
    ),
  );

  // Exit non-zero if oracle fails — regression signal only
  process.exit(reqFail > 0 || !fitConsistent ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
