/**
 * Real multi-document pack audit for remaining intelligence-gap invariants.
 * Generic — no tender / country / filename rules. Uses the newest local pack.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageFromParts } from "@/services/tender-extraction/requirements-heuristic";
import {
  classifyPackageDocumentIdentity,
  resolvePackageIdentity,
} from "@/domain/package-identity";
import { buildSemanticIdentity } from "@/domain/semantic-tender-intelligence/identity";
import {
  actionTitleMatchesRequirement,
  buildTenderActionPlan,
} from "@/domain/tender-action-plan";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";
import { mapPackageDocumentRole } from "@/domain/semantic-tender-intelligence/document-context";
import {
  buildCanonicalSemanticCandidates,
  interpretSemanticStatement,
  StiApprovedRequirementBatch,
} from "@/domain/semantic-tender-intelligence";
import { lifecycleIdentityFamily } from "@/domain/semantic-tender-intelligence/phase";
import {
  assertAnalysisReadyForCompletion,
  buildCanonicalRequirements,
  canonicalObligationFingerprint,
  obligationFingerprint,
} from "@/domain/tender-requirements";

const ROOT = resolve(".");
const UPLOADS = resolve(ROOT, ".data/uploads");
const ARTIFACTS = resolve(ROOT, "artifacts");

function newestPack(): string {
  const env = process.env.BIDVERA_GAPS_PACK?.trim();
  if (env && existsSync(env)) return env;
  const stack = [UPLOADS];
  let best: { path: string; mtime: number } | null = null;
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    const files = entries.filter((n) =>
      [".pdf", ".docx", ".xlsx", ".doc"].includes(extname(n).toLowerCase()),
    );
    if (files.length >= 2) {
      const mtime = statSync(dir).mtimeMs;
      if (!best || mtime > best.mtime) best = { path: dir, mtime };
    }
    for (const e of entries) {
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory() && e !== "company-knowledge") stack.push(p);
      } catch {
        /* skip */
      }
    }
  }
  if (!best) throw new Error("No multi-file pack found under .data/uploads");
  return best.path;
}

function mimeFor(fileName: string): string {
  switch (extname(fileName).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

async function main() {
  const pack = newestPack();
  const files = readdirSync(pack).filter((n) => !n.startsWith(".") && n !== "intake-report.json");
  const extracted: Array<{ fileName: string; text: string; failed: boolean }> = [];
  for (const fileName of files) {
    try {
      const result = await extractDocumentText({
        buffer: readFileSync(join(pack, fileName)),
        mimeType: mimeFor(fileName),
        fileName,
      });
      extracted.push({ fileName, text: result.text ?? "", failed: !result.text });
    } catch {
      extracted.push({ fileName, text: "", failed: true });
    }
  }

  const identity = classifyPackageDocumentIdentity(
    extracted.map((f) => ({ fileName: f.fileName, text: f.text })),
  );
  const roleByFile = new Map(identity.map((d) => [d.fileName, d.role]));

  const identityRecord = resolvePackageIdentity(
    extracted.map((f) => ({ fileName: f.fileName, text: f.text })),
  );

  const heuristic = extractTenderPackageFromParts(
    extracted.map((f) => ({ fileName: f.fileName, text: f.text })),
    "gaps-pack",
  );

  const drafts = heuristic.requirements.map((r) => ({
    description: r.description,
    category: r.category,
    mandatory: r.mandatory,
    sourceDocument: r.sourceDocument ?? null,
    sourcePage: r.sourcePage ?? null,
    sourceSection: r.sourceSection ?? null,
    documentRole: mapPackageDocumentRole(
      roleByFile.get(String(r.sourceDocument ?? "").split(";")[0]?.trim() ?? "") ?? null,
    ),
  }));

  const { candidates, rejected } = buildCanonicalSemanticCandidates(drafts, {
    packageLabel: "gaps-pack",
  });
  const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, "gaps-pack");
  const canonical = buildCanonicalRequirements({ stiApproved: sealed });
  const canonicalFingerprints = canonical.map((r) => canonicalObligationFingerprint(r));
  const uniqueCanonicalFingerprints = new Set(canonicalFingerprints);
  const legacyUncontextualized = (text: string, category: string) =>
    obligationFingerprint(text, category)
      .replace(/\|life:[^|]+/g, "")
      .replace(/\|actor:[^|]+/g, "")
      .replace(/\|pol:[^|]+/g, "");
  const legacyForks: Array<{ key: string; phases: string[]; actors: string[] }> = [];
  const byLegacy = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const key = legacyUncontextualized(c.fullRequirementText, c.draft.category);
    const group = byLegacy.get(key) ?? [];
    group.push(c);
    byLegacy.set(key, group);
  }
  for (const [key, group] of byLegacy) {
    if (group.length < 2) continue;
    const phases = [...new Set(group.map((c) => c.procurementPhase))];
    const actors = [...new Set(group.map((c) => c.actor))];
    const life = [...new Set(phases.map((p) => lifecycleIdentityFamily(p)))];
    if (life.length > 1 || actors.length > 1) {
      legacyForks.push({ key: key.slice(0, 80), phases, actors });
    }
  }
  const sealedCanonicalKeys = sealed.items.map((c) =>
    canonicalObligationFingerprint({
      requirement: c.fullRequirementText,
      category: c.draft.category,
      lotApplicability: c.lotApplicability,
      stiConditionText: c.condition,
      stiProcurementPhase: c.procurementPhase,
      stiActor: c.actor,
    }),
  );
  const sealedUniqueCanonical = new Set(sealedCanonicalKeys);
  const collapsedPair = (() => {
    const seen = new Map<string, (typeof sealed.items)[number]>();
    for (let i = 0; i < sealed.items.length; i++) {
      const c = sealed.items[i]!;
      const fp = sealedCanonicalKeys[i]!;
      const prev = seen.get(fp);
      if (prev) {
        return {
          fingerprint: fp.slice(0, 120),
          a: {
            text: prev.fullRequirementText.slice(0, 160),
            actor: prev.actor,
            phase: prev.procurementPhase,
          },
          b: {
            text: c.fullRequirementText.slice(0, 160),
            actor: c.actor,
            phase: c.procurementPhase,
          },
        };
      }
      seen.set(fp, c);
    }
    return null;
  })();

  const chromeInHarvest = heuristic.requirements.filter((r) =>
    /\b[A-Z]{1,3}\d{1,4}=/.test(r.description),
  );
  const chromeInCanonical = canonical.filter((r) => /\b[A-Z]{1,3}\d{1,4}=/.test(r.requirement));

  const focal = interpretSemanticStatement({
    text: "The UNOPS appointed focal person shall issue a release Purchase Order (PO) to the supplier.",
    provenance: {
      sourceDocument: "schedule.pdf",
      sourcePage: 1,
      sourceSection: null,
      sourceCell: null,
      versionLabel: null,
      locator: null,
    },
  });

  const byRole = (role: string) =>
    canonical.filter((r) => {
      const src = String(r.sourceDocument ?? "");
      const file = identity.find((d) => src.includes(d.fileName));
      return file?.role === role;
    }).length;

  const contamination = canonical.filter(
    (r) =>
      r.stiActor === "BUYER" ||
      r.stiActor === "AUTHORITY" ||
      r.stiClausePurpose === "BUYER_OBLIGATION" ||
      r.stiClausePurpose === "POST_AWARD_OBLIGATION",
  );

  const brochurePlain = "Vendors shall provide relevant technical brochure with the offer.";
  const brochurePrefixed = `– Important : ${brochurePlain}`;
  const brochureIdsEqual =
    buildSemanticIdentity({
      text: brochurePlain,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    }) ===
    buildSemanticIdentity({
      text: brochurePrefixed,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
  const brochureAdmitted = canonical.filter((r) =>
    /technical brochure/i.test(r.requirement),
  );

  const matrix: ComplianceRow[] = canonical.map((r, index) => ({
    id: r.id ?? `req-${index}`,
    requirementId: r.id ?? `req-${index}`,
    requirement: r.requirement,
    requirementType: String(r.category),
    mandatory: r.mandatory,
    priority: "HIGH",
    status: "VERIFY",
    companyFit: null,
    sourceDocument: r.sourceDocument ?? null,
    pageNumber: typeof r.page === "number" ? r.page : null,
    section: r.sourceSection ?? null,
    evidence: null,
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "DIRECT_SOURCE",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: "Verify evidence for linked requirement",
  }));
  const actionPlan = buildTenderActionPlan({
    tenderId: "gaps-pack",
    companyId: "gaps",
    tenderDeadline: identityRecord.deadline.deadlineIso
      ? new Date(identityRecord.deadline.deadlineIso)
      : null,
    complianceMatrix: matrix,
    evidenceIntelligence: null,
    risks: [],
    keyBlockers: [],
    readiness: { attention: [], items: [] },
    fitBreakdown: null,
    recommendation: null,
    teamTasks: [],
    asOf: new Date("2026-09-06T12:00:00.000Z"),
  });
  const genericActions = actionPlan.items.filter((a) =>
    /linked requirement/i.test(a.title),
  );

  const report = {
    pack,
    files: extracted.length,
    failedFiles: extracted.filter((f) => f.failed).length,
    roles: identity.map((d) => ({ fileName: d.fileName, role: d.role })),
    heuristicDrafts: heuristic.requirements.length,
    harvestLimitReached: heuristic.harvestLimitReached ?? false,
    admittedCandidates: candidates.length,
    sealedAdmitted: sealed.size,
    canonical: canonical.length,
    uniqueCanonicalFingerprints: uniqueCanonicalFingerprints.size,
    sealedCanonicalCandidates: sealed.size,
    sealedUniqueCanonicalFingerprints: sealedUniqueCanonical.size,
    collapsedAtCanonical: sealed.size - sealedUniqueCanonical.size,
    collapsedPair,
    legacyIdentityForks: legacyForks.length,
    legacyIdentityForkSamples: legacyForks.slice(0, 4),
    rejected: rejected.length,
    chromeInHarvest: chromeInHarvest.length,
    chromeInCanonical: chromeInCanonical.length,
    focalPersonActor: focal.actor,
    focalPersonAdmitted: focal.admitToCanonical,
    vendorGuideAdmitted: byRole("VENDOR_GUIDE"),
    policyAdmitted: byRole("POLICY_OR_CODE"),
    contractFormsAdmitted:
      byRole("CONTRACT_FORMS") + byRole("CONTRACT_FORM") + byRole("SAMPLE_CONTRACT"),
    contaminationCount: contamination.length,
    deadline: {
      status: identityRecord.deadline.status,
      iso: identityRecord.deadline.deadlineIso,
      timezone: identityRecord.deadline.deadlineTimezone,
      reason: identityRecord.deadline.reason,
      evidence: identityRecord.deadline.evidence,
    },
    brochureIdentityMerged: brochureIdsEqual,
    brochureAdmitted: brochureAdmitted.length,
    actionPlanTotal: actionPlan.items.length,
    genericLinkedRequirementActions: genericActions.length,
    sampleActionTitles: actionPlan.items.slice(0, 8).map((a) => a.title),
    sampleAdmitted: canonical.slice(0, 8).map((r) => ({
      text: r.requirement.slice(0, 140),
      actor: r.stiActor,
      phase: r.stiProcurementPhase,
      source: r.sourceDocument,
    })),
  };

  mkdirSync(ARTIFACTS, { recursive: true });
  const out = join(ARTIFACTS, "remaining-intelligence-gaps-pack-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(`wrote ${out}`);

  if (chromeInHarvest.length > 0 || chromeInCanonical.length > 0) {
    throw new Error("Spreadsheet cell-address chrome leaked into harvest or canonical text");
  }
  if (focal.actor === "SUPPLIER" || focal.admitToCanonical) {
    throw new Error("Buyer-agent PO issuance was attributed as a supplier requirement");
  }
  if (contamination.length > 0) {
    throw new Error(`Buyer/post-award contamination in canonical: ${contamination.length}`);
  }
  if (identityRecord.deadline.deadlineIso && identityRecord.deadline.status !== "OK") {
    throw new Error("Parsed deadline did not reach package identity as OK");
  }
  if (!identityRecord.deadline.deadlineIso && identityRecord.deadline.status === "OK") {
    throw new Error("Package identity marked deadline OK without a calendar date");
  }
  if (!identityRecord.deadline.deadlineIso && !identityRecord.deadline.reason) {
    throw new Error("Absent deadline must be explicitly unavailable with a reason");
  }
  if (!brochureIdsEqual) {
    throw new Error("Decorative-prefix brochure clauses did not share one semantic identity");
  }
  if (uniqueCanonicalFingerprints.size !== canonical.length) {
    throw new Error(
      `Duplicate obligation fingerprints in canonical requirements (${canonical.length} rows, ${uniqueCanonicalFingerprints.size} unique)`,
    );
  }
  assertAnalysisReadyForCompletion({
    requirements: canonical,
    intelligence: {
      complianceMatrix: matrix,
      complianceSummary: {
        totalRequirements: canonical.length,
        ready: 0,
        missing: 0,
        verify: canonical.length,
        notApplicable: 0,
        unknown: 0,
        sources: canonical.length,
        risks: 0,
        requiredActions: actionPlan.items.length,
        clarifications: 0,
      },
      risks: [],
    },
    resolvedRequirementIds: matrix.map((row) => row.id),
    actionPlan: { items: actionPlan.items },
  });
  if (genericActions.length > 0) {
    throw new Error(`Generic linked-requirement actions remain: ${genericActions.length}`);
  }
  const mismatched = actionPlan.items.filter(
    (a) =>
      a.linkedRequirementId &&
      a.requirementText &&
      !actionTitleMatchesRequirement(a.title, a.requirementText),
  );
  if (mismatched.length > 0) {
    throw new Error(
      `Action title does not match linked requirement: ${mismatched
        .slice(0, 3)
        .map((a) => a.title)
        .join(" | ")}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
