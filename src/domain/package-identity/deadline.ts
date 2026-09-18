/**
 * Package-level bid-deadline identity.
 * Distinguishes bid submission from opening / clarification / delivery /
 * contract / validity / publication. Never invents timezone.
 */

import {
  extractTenderDeadlineFromText,
  type ParsedTenderDeadline,
} from "@/domain/tender-requirements/tender-deadline";
import type {
  DeadlineDateClass,
  PackageDeadlineIdentity,
  PackageDeadlineSource,
  PackageIdentityDocument,
  PackageIdentityPart,
} from "./types";
import { metadataAuthority } from "./roles";

function isBidSubmissionCue(t: string): boolean {
  return /\b(?:submission\s+deadline|deadline\s+for\s+(?:the\s+)?(?:proposal|bid|tender|offer)s?\s+submission|deadline\s+for\s+(?:the\s+)?submission|closing\s+date|receipt\s+of\s+(?:bids?|tenders?|offers?|proposals?))\b/i.test(
    t,
  );
}

export function classifyDeadlineDateClass(around: string): DeadlineDateClass {
  const t = around.replace(/\s+/g, " ");
  if (
    /\b(?:clarif(?:ication)?\s+deadline|deadline\s+for\s+(?:clarif|request\s+for\s+clarif)|last\s+date\s+for\s+clarif)/i.test(
      t,
    )
  ) {
    return "CLARIFICATION";
  }
  if (/\b(?:bid\s+)?opening|ouverture\s+des\s+plis|ouverture\s+publique\b/i.test(t)) {
    if (!isBidSubmissionCue(t)) {
      return "OPENING";
    }
  }
  if (/\b(?:bid\s+)?validity|validit[eé]\s+de\s+(?:l['’])?offre\b/i.test(t)) {
    return "VALIDITY";
  }
  if (
    /\b(?:delivery|livraison|commissioning|installation)\s+date\b/i.test(t) &&
    !/\b(?:deadline|submission|closing)\b/i.test(t)
  ) {
    return "DELIVERY";
  }
  if (
    /\b(?:contract\s+(?:start|commencement|end|date)|date\s+de\s+(?:d[eé]but|fin)\s+de\s+march[eé])\b/i.test(
      t,
    ) &&
    !isBidSubmissionCue(t)
  ) {
    return "CONTRACT";
  }
  if (
    /\b(?:publication\s+date|date\s+of\s+publication|published\s+on)\b/i.test(t) &&
    !/\bsubmission\s+deadline\b/i.test(t)
  ) {
    return "PUBLICATION";
  }
  if (
    /\b(?:pre[- ]?bid|pre[- ]?proposal|site\s+visit|clarification\s+meeting|bidders?['’]?\s+conference|pre[- ]?tender\s+meeting)\b/i.test(
      t,
    ) &&
    !isBidSubmissionCue(t)
  ) {
    return "OTHER";
  }
  if (/\bwarrant(?:y|ies)\s+(?:period|date|expires?|expiry|valid)/i.test(t)) {
    return "OTHER";
  }
  if (
    /\b(?:submission\s+deadline|deadline\s+for\s+(?:the\s+)?(?:proposal|bid|tender|offer)s?\s+submission|deadline\s+for\s+(?:the\s+)?submission|closing\s+date|bid\s+due|receipt\s+of\s+(?:bids?|tenders?|offers?|proposals?)|date\s+limite\s+(?:de\s+)?(?:remise|soumission)|cl[oô]ture\s+des\s+offres|tarikh\s+tutup)\b/i.test(
      t,
    )
  ) {
    return "BID_SUBMISSION";
  }
  return "OTHER";
}

function isExcludedDeadlineClass(dateClass: DeadlineDateClass, around: string): boolean {
  if (dateClass !== "BID_SUBMISSION" && dateClass !== "OTHER") return true;
  if (dateClass === "OTHER") {
    const t = around.replace(/\s+/g, " ");
    if (
      /\b(?:pre[- ]?bid|site\s+visit|clarification\s+meeting|bidders?['’]?\s+conference|warrant(?:y|ies)\s+(?:period|date|expires?|expiry))\b/i.test(
        t,
      )
    ) {
      return true;
    }
  }
  return false;
}

function isDeadlineReplacement(evidence: string, role: PackageDeadlineSource["role"]): boolean {
  if (role !== "AMENDMENT" && role !== "CORRIGENDUM") return false;
  return /\b(?:hereby\s+)?(?:amended?|revised?|extended?|postponed|replaced)\b.{0,80}\b(?:deadline|closing\s+date|submission)\b|\b(?:deadline|closing\s+date|submission).{0,80}\b(?:hereby\s+)?(?:amended?|revised?|extended?|postponed|replaced)\b/i.test(
    evidence,
  );
}

export function resolvePackageDeadline(
  parts: PackageIdentityPart[],
  documents: PackageIdentityDocument[],
): PackageDeadlineIdentity {
  const byFile = new Map(documents.map((d) => [d.fileName, d]));
  const sources: PackageDeadlineSource[] = [];
  let incompleteReason: string | null = null;
  let incompleteEvidence: string | null = null;
  let lastParse: ParsedTenderDeadline | null = null;

  for (const part of parts) {
    const doc = byFile.get(part.fileName);
    const role = doc?.role ?? "UNKNOWN";
    const truncated = part.truncated === true || doc?.completeness === "TRUNCATED";
    const parsed = extractTenderDeadlineFromText(part.text, null);
    lastParse = parsed;
    if (parsed.deadlineIso) {
      const around = parsed.evidence ?? "";
      const dateClass = classifyDeadlineDateClass(around);
      if (isExcludedDeadlineClass(dateClass, around)) {
        continue;
      }
      // OTHER with a parsed iso from submission-oriented parser is bid-submission.
      sources.push({
        fileName: part.fileName,
        role,
        iso: parsed.deadlineIso,
        timezone: parsed.deadlineTimezone,
        evidence: parsed.evidence ?? parsed.deadlineIso,
        dateClass: "BID_SUBMISSION",
        truncated,
      });
    } else if (parsed.reason) {
      const phraseOrPointer =
        parsed.reason.includes("phrase was found") ||
        parsed.reason.includes("referenced") ||
        parsed.reason.includes("calendar date");
      if (phraseOrPointer) {
        if (truncated || part.text.trim().length < 400) {
          incompleteReason =
            "A bid-deadline label was found but the calendar date is missing or the source text is incomplete.";
        } else if (!incompleteReason) {
          incompleteReason = parsed.reason;
        }
        if (!incompleteEvidence) incompleteEvidence = parsed.evidence;
      }
    }
  }

  const authoritativeDocs = documents.filter((d) => metadataAuthority(d.role) >= 2);
  const authoritativeSources = sources.filter((s) => metadataAuthority(s.role) >= 2);
  const nonAuthoringRoles = new Set<PackageIdentityDocument["role"]>([
    "PREBID_MATERIAL",
    "Q_AND_A",
    "CLARIFICATION",
    "RETURNABLE_FORMS",
    "SAMPLE_CONTRACT",
    "PRICING",
    "ANNEX",
    "APPENDIX",
    "QUALIFICATION",
  ]);
  const usableSources =
    authoritativeSources.length > 0
      ? authoritativeSources
      : sources.filter((s) => !nonAuthoringRoles.has(s.role));

  if (authoritativeSources.length === 0 && authoritativeDocs.length > 0) {
    return {
      deadlineIso: null,
      deadlineTimezone: null,
      localHour: null,
      localMinute: null,
      evidence: sources[0]?.evidence ?? incompleteEvidence ?? lastParse?.evidence ?? null,
      status: "INCOMPLETE",
      dateClass: sources.length > 0 || incompleteEvidence ? "BID_SUBMISSION" : null,
      reason:
        incompleteReason ??
        lastParse?.reason ??
        "Authoritative documents did not yield a parseable bid-submission deadline. Non-authoritative restatements (pre-bid, Q&A, forms) are not used as package truth.",
      sources,
    };
  }
  if (usableSources.length === 0) {
    if (sources.length > 0) {
      return {
        deadlineIso: null,
        deadlineTimezone: null,
        localHour: null,
        localMinute: null,
        evidence: sources[0]?.evidence ?? null,
        status: "INCOMPLETE",
        dateClass: "BID_SUBMISSION",
        reason:
          "Bid-deadline evidence appears only in non-authoritative material and is not treated as package truth.",
        sources,
      };
    }
    const status = incompleteReason ? "INCOMPLETE" : "UNKNOWN";
    return {
      deadlineIso: null,
      deadlineTimezone: null,
      localHour: null,
      localMinute: null,
      evidence: incompleteEvidence ?? lastParse?.evidence ?? null,
      status,
      dateClass: incompleteEvidence ? "BID_SUBMISSION" : null,
      reason:
        incompleteReason ??
        lastParse?.reason ??
        "No reliable bid-submission deadline was found in the tender package.",
      sources,
    };
  }

  const maxAuth = Math.max(...usableSources.map((s) => metadataAuthority(s.role)));
  const ranked = usableSources.filter((s) => metadataAuthority(s.role) === maxAuth);
  const complete = ranked.filter((s) => !s.truncated);
  const working = complete.length > 0 ? complete : ranked;

  const groups = new Map<string, PackageDeadlineSource[]>();
  for (const s of working) {
    const key = s.iso.slice(0, 16);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  if (groups.size > 1) {
    const replacementGroups = [...groups.entries()].filter(([, list]) =>
      list.some((s) => isDeadlineReplacement(s.evidence, s.role)),
    );
    if (replacementGroups.length !== 1) {
      return {
        deadlineIso: null,
        deadlineTimezone: null,
        localHour: null,
        localMinute: null,
        evidence: null,
        status: "CONFLICT",
        dateClass: "BID_SUBMISSION",
        reason: "Authoritative documents state different bid-submission deadlines.",
        sources,
      };
    }
    const replacement = replacementGroups[0]![1][0]!;
    const part = parts.find((p) => p.fileName === replacement.fileName);
    const parsed = extractTenderDeadlineFromText(part?.text ?? "", null);
    return {
      deadlineIso: replacement.iso,
      deadlineTimezone: replacement.timezone,
      localHour: parsed.localHour,
      localMinute: parsed.localMinute,
      evidence: replacement.evidence,
      status: "OK",
      dateClass: "BID_SUBMISSION",
      reason: replacement.timezone
        ? "Amendment/corrigendum replacement date used as package deadline."
        : "Amendment/corrigendum replacement date used; timezone UNKNOWN (not stated in source).",
      sources,
    };
  }

  if (complete.length === 0) {
    return {
      deadlineIso: null,
      deadlineTimezone: null,
      localHour: lastParse?.localHour ?? null,
      localMinute: lastParse?.localMinute ?? null,
      evidence: working[0]?.evidence ?? null,
      status: "INCOMPLETE",
      dateClass: "BID_SUBMISSION",
      reason:
        "Bid-deadline evidence exists only in truncated document text and is not treated as authoritative.",
      sources,
    };
  }

  const best = working[0]!;
  const part = parts.find((p) => p.fileName === best.fileName);
  const parsed = extractTenderDeadlineFromText(part?.text ?? "", null);
  return {
    deadlineIso: best.iso,
    deadlineTimezone: best.timezone,
    localHour: parsed.localHour,
    localMinute: parsed.localMinute,
    evidence: best.evidence,
    status: "OK",
    dateClass: "BID_SUBMISSION",
    reason: best.timezone
      ? null
      : "Local wall-clock time preserved; timezone UNKNOWN (not stated in source).",
    sources,
  };
}
