import { prisma } from "@/lib/db";
import {
  buildExtractionBlockedAnalysis,
  type ExtractionGateReason,
} from "@/domain/decision/extraction-gate";
import type { TenderDocumentRole } from "@/domain/tender-package";
import { logInfo } from "@/services/observability";
import { emitWorkflowSmartAlert } from "@/services/smart-alerts";

export const REQUIREMENTS_INCOMPLETE_MESSAGE =
  "Requirements could not be reliably extracted from this tender package. Bidvera marks this analysis as ANALYSIS INCOMPLETE — do not treat empty compliance rows as “no requirements”.";

type VerifiedFactsInput = {
  title?: string | null;
  client?: string | null;
  country?: string | null;
  region?: string | null;
  industry?: string | null;
  deadlineIso?: string | null;
  deadlineTimezone?: string | null;
  estimatedValue?: number | null;
  guarantee?: string | null;
  reference?: string | null;
  submissionMethod?: string | null;
  factsNote?: string | null;
};

type NoticeRequirement = {
  category: string;
  description: string;
  mandatory: boolean;
  value: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
  evidenceText: string | null;
  verificationStatus: "UNKNOWN" | "VERIFIED" | "INFERRED";
};

/**
 * Completed-looking report is forbidden when requirement extraction failed
 * or the tender package is incomplete (e.g. Avis-only).
 * Persist explicit UNAVAILABLE scores — never run fit/bid engines.
 * DB decision enum may be REVIEW as placeholder; canonical read exposes decision=null.
 * Verified notice facts (deadline, buyer, value) are still stored when present.
 */
export async function completeIncompleteRequirementsAnalysis(input: {
  tenderId: string;
  companyId: string;
  packageLabel: string;
  extractedText: string;
  deadlineUnknownReason: string | null;
  reason?: ExtractionGateReason;
  message?: string;
  verifiedFacts?: VerifiedFactsInput;
  packageRoles?: TenderDocumentRole[];
  missingDocumentTypes?: TenderDocumentRole[];
  /** Notice-level obligations for evidence display only — never scored. */
  noticeRequirements?: NoticeRequirement[];
}): Promise<void> {
  const {
    tenderId,
    companyId,
    packageLabel,
    extractedText,
    deadlineUnknownReason,
    reason = "NO_RELIABLE_REQUIREMENTS",
    message,
    verifiedFacts,
    packageRoles = [],
    missingDocumentTypes = [],
    noticeRequirements = [],
  } = input;

  await prisma.$transaction([
    prisma.tenderRequirement.deleteMany({ where: { tenderId } }),
    prisma.tenderEvidence.deleteMany({ where: { tenderId } }),
    prisma.missingDocument.deleteMany({ where: { tenderId } }),
    prisma.tenderRisk.deleteMany({ where: { tenderId } }),
    prisma.nextAction.deleteMany({ where: { tenderId } }),
  ]);

  const factsLines: string[] = [];
  if (verifiedFacts?.reference) factsLines.push(`Reference: ${verifiedFacts.reference}`);
  if (verifiedFacts?.title) factsLines.push(`Title: ${verifiedFacts.title}`);
  if (verifiedFacts?.client) factsLines.push(`Buyer / client: ${verifiedFacts.client}`);
  if (verifiedFacts?.country) factsLines.push(`Country: ${verifiedFacts.country}`);
  if (verifiedFacts?.deadlineIso) {
    factsLines.push(`Deadline: ${verifiedFacts.deadlineIso.slice(0, 10)} (from notice)`);
  }
  if (verifiedFacts?.estimatedValue != null) {
    factsLines.push(`Estimated value (from notice): ${verifiedFacts.estimatedValue}`);
  }
  if (verifiedFacts?.submissionMethod) {
    factsLines.push(`Submission: ${verifiedFacts.submissionMethod}`);
  }
  if (verifiedFacts?.factsNote) {
    factsLines.push(`Package metadata: ${verifiedFacts.factsNote}`);
  }
  if (packageRoles.length > 0) {
    factsLines.push(`Package document roles: ${packageRoles.join(", ")}`);
  }
  if (missingDocumentTypes.length > 0) {
    factsLines.push(`Missing document types: ${missingDocumentTypes.join(", ")}`);
  }

  const factsBlock =
    factsLines.length > 0
      ? `\n\nVerified tender information from the uploaded package:\n- ${factsLines.join("\n- ")}`
      : "";

  const blocked = buildExtractionBlockedAnalysis({
    reason,
    message: (message ?? REQUIREMENTS_INCOMPLETE_MESSAGE) + factsBlock,
    packageLabel,
  });

  // Persist notice-level requirements as evidence rows only (not scored).
  // Compliance matrix stays empty because scoringAvailable is false.
  if (noticeRequirements.length > 0) {
    let sortOrder = 0;
    for (const req of noticeRequirements.slice(0, 40)) {
      const created = await prisma.tenderRequirement.create({
        data: {
          tenderId,
          category: req.category,
          description: req.description,
          mandatory: req.mandatory,
          value: req.value,
          status: "UNCERTAIN",
          sourcePage: req.sourcePage,
          sourceSection: req.sourceSection,
          evidence: req.evidenceText,
          sortOrder: sortOrder++,
        },
      });
      if (req.evidenceText) {
        await prisma.tenderEvidence.create({
          data: {
            tenderId,
            requirementId: created.id,
            evidenceText: req.evidenceText,
            sourcePage: req.sourcePage,
            sourceSection: req.sourceSection,
            verificationStatus: "VERIFIED",
          },
        });
      }
    }
  }

  for (const missing of missingDocumentTypes) {
    await prisma.missingDocument.create({
      data: {
        tenderId,
        documentName: missing,
        reason:
          "Identified as missing from the uploaded tender package for decision analysis.",
        // Package gap — analysis blocker, not a scored tender risk.
        severity: "MEDIUM",
        sortOrder: 0,
      },
    });
  }

  // Do not invent HIGH tender risks for incomplete packages — blockers live in
  // missingDocuments + extractionGate / keyBlockers / nextActions.
  if (deadlineUnknownReason && !verifiedFacts?.deadlineIso) {
    await prisma.nextAction.create({
      data: {
        tenderId,
        title: "Verify tender deadline",
        description: `Deadline: Unknown — Verify. ${deadlineUnknownReason}`,
        priority: 2,
        sortOrder: 1,
      },
    });
  }

  const nextTitle =
    reason === "ONLY_AVIS" || reason === "CPS_MISSING"
      ? "Upload CPS / technical specifications"
      : reason === "INTAKE_BLOCKED" || reason === "INTAKE_NO_READABLE_DOCS"
        ? "Resolve Universal Intake blockers"
        : "Re-check tender package extraction";
  const nextDescription =
    reason === "ONLY_AVIS" || reason === "CPS_MISSING"
      ? "A tender notice was processed. Upload the CPS, RFP, or technical specifications to run Fit, Compliance, Bid Score and Bid/No-Bid analysis."
      : reason === "INTAKE_BLOCKED"
        ? "Universal Intake blocked this package (password, corruption, security, or unreadable files). Resolve the exact file issues reported, then re-upload or unlock to resume. Decision scoring stays REVIEW_REQUIRED / ANALYSIS_INCOMPLETE until intake clears."
        : reason === "INTAKE_NO_READABLE_DOCS"
          ? "No readable tender documents survived Universal Intake. Provide supported, recoverable documents — Bid / No-Bid will not be fabricated from empty extraction."
          : "Upload a clearer text-based pack (notice + CPS / RFP / technical specifications) or confirm extraction settings, then re-run analysis.";

  await prisma.nextAction.create({
    data: {
      tenderId,
      title: nextTitle,
      description: nextDescription,
      priority: 1,
      sortOrder: 0,
    },
  });

  await prisma.tenderDecision.upsert({
    where: { tenderId },
    create: {
      tenderId,
      companyId,
      decision: blocked.decision,
      fitScore: blocked.fitScoreDb,
      confidence: blocked.confidence,
      reasoning: blocked.reasoning,
      fitBreakdown: blocked.fitBreakdown as object,
      readinessBreakdown: blocked.readiness as object,
      intelligenceBreakdown: blocked.intelligence as object,
      bidScoreBreakdown: blocked.bidScore as object,
      isAiSuggested: false,
    },
    update: {
      decision: blocked.decision,
      fitScore: blocked.fitScoreDb,
      confidence: blocked.confidence,
      reasoning: blocked.reasoning,
      fitBreakdown: blocked.fitBreakdown as object,
      readinessBreakdown: blocked.readiness as object,
      intelligenceBreakdown: blocked.intelligence as object,
      bidScoreBreakdown: blocked.bidScore as object,
      isAiSuggested: false,
    },
  });

  const deadlineParts = parseIncompleteDeadline(
    verifiedFacts?.deadlineIso ?? null,
    verifiedFacts?.deadlineTimezone ?? null,
  );
  const safeTitle = sanitizeIncompleteTitle(verifiedFacts?.title ?? null);

  await prisma.tender.update({
    where: { id: tenderId },
    data: {
      analysisStatus: "COMPLETED",
      status: "ACTIVE",
      analyzedAt: new Date(),
      analysisError: null,
      analysisPhase: reason === "ONLY_AVIS" ? "NOTICE_ONLY" : "COMPLETE",
      ...(safeTitle ? { title: safeTitle } : {}),
      ...(verifiedFacts?.client ? { client: verifiedFacts.client } : {}),
      ...(verifiedFacts?.country ? { country: verifiedFacts.country } : {}),
      ...(verifiedFacts?.region ? { region: verifiedFacts.region } : {}),
      ...(verifiedFacts?.industry ? { industry: verifiedFacts.industry } : {}),
      ...(verifiedFacts?.guarantee ? { guarantee: verifiedFacts.guarantee } : {}),
      ...(deadlineParts.deadline
        ? {
            deadline: deadlineParts.deadline,
            deadlineTimezone: deadlineParts.timezone,
          }
        : {}),
      // Only persist estimated value when explicitly extracted from the notice
      estimatedValue:
        verifiedFacts?.estimatedValue != null && verifiedFacts.estimatedValue > 0
          ? verifiedFacts.estimatedValue
          : null,
    },
  });

  await emitWorkflowSmartAlert({
    companyId,
    tenderId,
    title: safeTitle?.trim() || "Tender",
    reason:
      reason === "ONLY_AVIS"
        ? "ONLY_AVIS"
        : reason === "CPS_MISSING"
          ? "CPS_MISSING"
          : "NO_REQUIREMENTS",
    message: blocked.reasoning.slice(0, 500),
  });

  logInfo("analysis.requirements_incomplete", {
    tenderId,
    companyId,
    chars: extractedText.length,
    gate: reason,
    roles: packageRoles,
    noticeRequirementCount: noticeRequirements.length,
    hasVerifiedDeadline: Boolean(verifiedFacts?.deadlineIso),
  });
}

/** Reject score-banner text that was mistaken for a tender title. */
function sanitizeIncompleteTitle(title: string | null): string | null {
  if (!title?.trim()) return null;
  const t = title.trim();
  if (
    /score\s*d['’]?\s*offre/i.test(t) ||
    /\b\d{1,3}\s*\/\s*100\b/.test(t) ||
    /^bid\s*score\b/i.test(t)
  ) {
    return null;
  }
  return t;
}

/**
 * Date-only notice deadlines must not invent 00:00/01:00 or attach a TZ.
 * Real local timestamps keep the provided ISO + timezone.
 */
function parseIncompleteDeadline(
  iso: string | null,
  timezone: string | null,
): { deadline: Date | null; timezone: string | null } {
  if (!iso) return { deadline: null, timezone: null };
  const dateOnly = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  const hasExplicitClock =
    /T\d{2}:\d{2}/.test(iso) && !/T00:00:00/.test(iso);
  if (!hasExplicitClock && dateOnly) {
    return {
      deadline: new Date(`${dateOnly[1]}T00:00:00.000Z`),
      timezone: null,
    };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { deadline: null, timezone: null };
  return { deadline: d, timezone: timezone ?? null };
}
