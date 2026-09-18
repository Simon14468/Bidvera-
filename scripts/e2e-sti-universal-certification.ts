/**
 * Offline universal STI certification across 3 fixture packages + optional DB packs.
 * Writes artifacts/sti-universal-certification.json
 * No tender-specific rules.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { extractTenderPackageHeuristic } from "../src/services/tender-extraction/requirements-heuristic";
import {
  buildCanonicalSemanticCandidates,
  StiApprovedRequirementBatch,
  isPostAwardOnlyPhase,
} from "../src/domain/semantic-tender-intelligence";
import type { ProcurementPhase } from "../src/domain/semantic-tender-intelligence/types";
import { buildCanonicalRequirements } from "../src/domain/tender-requirements";
import { TEST_2_FIXTURE } from "../src/domain/tender-requirements/test-2-canonical-regression.test";
import { AUDIOVISUAL_TENDER_FIXTURE } from "../src/domain/tender-requirements/audiovisual-regression.test";
import { STRESS_TEST_FIXTURE } from "../src/domain/tender-requirements/stress-test-regression.test";

type Report = {
  label: string;
  files: number;
  formats: string[];
  documentRoles: string[];
  drafts: number;
  stiCandidates: number;
  admitted: number;
  buyerExcluded: number;
  postAwardExcluded: number;
  templateExcluded: number;
  ambiguousMixed: number;
  samplesAdmitted: Array<Record<string, string | null | undefined>>;
  samplesExcluded: Array<Record<string, string | null | undefined>>;
  contaminationCount: number;
  result: "PASS" | "FAIL";
};

function analyze(label: string, text: string, fileName: string, roles: string[]): Report {
  const heuristic = extractTenderPackageHeuristic({ text, fileName });
  const { candidates, rejected } = buildCanonicalSemanticCandidates(
    heuristic.requirements.map((r) => ({
      description: r.description,
      category: r.category,
      mandatory: r.mandatory,
      sourceDocument: r.sourceDocument ?? fileName,
      sourcePage: r.sourcePage ?? null,
      sourceSection: r.sourceSection ?? null,
    })),
    { packageLabel: fileName },
  );
  const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, fileName);
  const canonical = buildCanonicalRequirements({ stiApproved: sealed });
  const contamination = canonical.filter(
    (r) =>
      isPostAwardOnlyPhase((r.stiProcurementPhase ?? "UNKNOWN") as ProcurementPhase) ||
      r.stiClausePurpose === "BUYER_OBLIGATION" ||
      r.stiActor === "CONTRACTOR" ||
      r.stiActor === "BUYER" ||
      r.stiActor === "AUTHORITY",
  );
  return {
    label,
    files: 1,
    formats: [fileName.split(".").pop() ?? "txt"],
    documentRoles: roles,
    drafts: heuristic.requirements.length,
    stiCandidates: candidates.length,
    admitted: canonical.length,
    buyerExcluded: rejected.filter((r) => r.clausePurpose === "BUYER_OBLIGATION").length,
    postAwardExcluded: rejected.filter((r) => r.clausePurpose === "POST_AWARD_OBLIGATION")
      .length,
    templateExcluded: rejected.filter(
      (r) => r.clausePurpose === "TEMPLATE" || r.clausePurpose === "FORM_INSTRUCTION",
    ).length,
    ambiguousMixed: rejected.filter((r) => r.procurementPhase === "MIXED_OR_AMBIGUOUS")
      .length,
    samplesAdmitted: canonical.slice(0, 4).map((r) => ({
      text: r.requirement.slice(0, 120),
      actor: r.stiActor,
      phase: r.stiProcurementPhase,
      purpose: r.stiClausePurpose,
    })),
    samplesExcluded: rejected.slice(0, 4).map((r) => ({
      text: r.requirementText.slice(0, 120),
      purpose: r.clausePurpose,
      code: r.exclusionCode,
    })),
    contaminationCount: contamination.length,
    result: contamination.length === 0 ? "PASS" : "FAIL",
  };
}

async function main() {
  const packages = [
    analyze("Test2-IT-Admin", TEST_2_FIXTURE, "test2.pdf", [
      "ITB",
      "TECHNICAL",
      "COMMERCIAL",
    ]),
    analyze("Audiovisual-Synthetic", AUDIOVISUAL_TENDER_FIXTURE, "av.pdf", [
      "TECHNICAL",
      "WARRANTY",
      "ADMIN",
      "ELIGIBILITY",
    ]),
    analyze("Stress-Network-Security", STRESS_TEST_FIXTURE, "stress.pdf", [
      "ITB",
      "TECHNICAL",
      "PERFORMANCE",
      "COMMERCIAL",
    ]),
  ];

  const status = packages.every((p) => p.result === "PASS") ? "PASS" : "FAIL";
  const out = {
    status,
    certifiedAt: new Date().toISOString(),
    architecture: {
      boundary: "STI interpret → entry gate → StiApprovedRequirementBatch → normalize → admission firewall",
      persistence: "canonicalSnapshot.stiAdmission (sti-admission/v3); TenderRequirement text-only",
    },
    packages,
  };
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/sti-universal-certification.json",
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
