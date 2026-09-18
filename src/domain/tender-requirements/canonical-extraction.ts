/**
 * Canonical requirement extraction — single convergence point.
 *
 * Architectural invariant:
 *   RAW TEXT → candidate discovery → STI → STI entry gate → STI seal
 *   → final admission gate → normalize (format/dedupe only)
 *   → canonical admission firewall → HERE
 *
 * Production path MUST pass StiApprovedRequirementBatch (private constructor seal).
 * Draft-only callers go through STI via buildCanonicalRequirementsThroughSti.
 * No alternative path may create bidder-stage canonical requirements.
 */

import {
  buildCanonicalSemanticCandidates,
  type SemanticInterpretationContext,
  StiApprovedRequirementBatch,
  isStiApprovedRequirementBatch,
  stiApprovedBatchToDrafts,
  type FinalGateRejection,
} from "@/domain/semantic-tender-intelligence";
import { mergeSparseExtractionRequirements } from "./merge-sparse";
import {
  mergeNormalizedRequirements,
  normalizeRequirements,
  type RequirementDraftLike,
} from "./normalize";
import {
  assertBidderStageCanonicalInvariants,
  enforceCanonicalAdmissionFirewall,
  type FirewallRejection,
} from "./admission-firewall";
import type { NormalizedRequirement } from "./types";

export type BuildCanonicalRequirementsFromStiInput = {
  stiApproved: StiApprovedRequirementBatch;
};

/** Draft shape — always forced through STI before canonicalization. */
export type BuildCanonicalRequirementsDraftInput = {
  aiDrafts?: RequirementDraftLike[];
  heuristicDrafts?: RequirementDraftLike[];
  sourceDocument?: string | null;
  context?: SemanticInterpretationContext | null;
  /** @deprecated All sources are always merged; kept for API compatibility. */
  minAiCount?: number;
};

export type BuildCanonicalRequirementsInput =
  | BuildCanonicalRequirementsFromStiInput
  | BuildCanonicalRequirementsDraftInput;

/** Optional audit sink for sealed / firewall exclusions (persistence / diagnostics). */
export type CanonicalAdmissionAudit = {
  stiFinalGateRejected: readonly FinalGateRejection[];
  firewallRejected: readonly FirewallRejection[];
  admittedCount: number;
};

let lastAdmissionAudit: CanonicalAdmissionAudit | null = null;

/** Last buildCanonicalRequirements admission audit (process-local diagnostics). */
export function getLastCanonicalAdmissionAudit(): CanonicalAdmissionAudit | null {
  return lastAdmissionAudit;
}

function isUsableDraft(d: RequirementDraftLike): boolean {
  const text = d.description.replace(/\s+/g, " ").trim();
  if (text.length < 12) return false;
  if (/structured requirements unavailable/i.test(text)) return false;
  return true;
}

function sealNormalizeAndFirewall(
  sealed: StiApprovedRequirementBatch,
): NormalizedRequirement[] {
  const drafts = stiApprovedBatchToDrafts(sealed);
  const normalized = normalizeRequirements(drafts, {
    includeInformational: false,
    sourceDocument: sealed.sourceDocument,
    trustStiSemantics: true,
  });

  const { admitted, rejected } = enforceCanonicalAdmissionFirewall(normalized);
  // Authoritative last-mile: one row per canonical obligation fingerprint.
  const collapsed = mergeNormalizedRequirements(admitted);
  assertBidderStageCanonicalInvariants(collapsed);

  lastAdmissionAudit = {
    stiFinalGateRejected: sealed.finalRejected,
    firewallRejected: rejected,
    admittedCount: collapsed.length,
  };

  return collapsed;
}

/**
 * Force drafts through STI interpretation + entry gate, then seal + normalize + firewall.
 */
export function buildCanonicalRequirementsThroughSti(
  input: BuildCanonicalRequirementsDraftInput,
): NormalizedRequirement[] {
  const ai = (input.aiDrafts ?? []).filter(isUsableDraft);
  const heuristic = (input.heuristicDrafts ?? []).filter(isUsableDraft);

  const mergedDrafts = mergeSparseExtractionRequirements({
    aiRequirements: ai,
    heuristicRequirements: heuristic,
    minAiCount: Number.MAX_SAFE_INTEGER,
  });

  const packageLabel = input.sourceDocument ?? "canonical-draft-source";
  const semantic = buildCanonicalSemanticCandidates(
    mergedDrafts.map((d) => ({
      description: d.description,
      category: d.category,
      mandatory: d.mandatory,
      sourceDocument: d.sourceDocument ?? packageLabel,
      sourcePage: d.sourcePage ?? null,
      sourceSection: d.sourceSection ?? null,
      evidenceText: d.evidenceText ?? null,
    })),
    {
      packageLabel,
      context: input.context ?? null,
    },
  );

  const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
    semantic.candidates,
    packageLabel,
  );

  return buildCanonicalRequirements({ stiApproved: sealed });
}

/**
 * Produce one deduplicated canonical requirement set.
 *
 * - Preferred: `{ stiApproved }` sealed by STI in production
 * - Draft inputs: automatically routed through STI (cannot bypass)
 * - Post-normalize firewall enforces I1–I18 before return
 */
export function buildCanonicalRequirements(
  input: BuildCanonicalRequirementsInput,
): NormalizedRequirement[] {
  if ("stiApproved" in input && isStiApprovedRequirementBatch(input.stiApproved)) {
    return sealNormalizeAndFirewall(input.stiApproved);
  }

  // Reject forged seals (plain objects pretending to be approved).
  if ("stiApproved" in input && input.stiApproved != null) {
    throw new Error(
      "STI seal required: stiApproved must be a StiApprovedRequirementBatch instance",
    );
  }

  return buildCanonicalRequirementsThroughSti(
    input as BuildCanonicalRequirementsDraftInput,
  );
}
