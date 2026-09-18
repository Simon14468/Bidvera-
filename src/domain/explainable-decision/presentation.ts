/**
 * UI/report presentation helpers — derived from structured explanation only.
 */

import type { EvidenceIntelligenceState } from "@/domain/evidence-intelligence";
import type {
  ExplainableDecision,
  ExplainableDecisionItem,
  ExplanationCategory,
} from "./types";

export type ExplainableTopReason = {
  tone: "negative" | "warning" | "positive";
  text: string;
  category: ExplanationCategory;
};

export function evidenceStateExplainLabel(state: EvidenceIntelligenceState | string): string {
  switch (state) {
    case "VERIFIED":
      return "Verified evidence supports this requirement";
    case "FOUND_UNVERIFIED":
      return "Verification required";
    case "MISSING":
      return "Evidence missing";
    case "EXPIRED":
      return "Evidence is expired";
    case "INVALID":
      return "Evidence rejected — unsupported";
    case "UNKNOWN":
      return "Unable to establish status";
    default:
      return "Unable to establish status";
  }
}

export function buildTopReasons(explanation: ExplainableDecision): ExplainableTopReason[] {
  const out: ExplainableTopReason[] = [];
  const seen = new Set<string>();

  function push(tone: ExplainableTopReason["tone"], text: string, category: ExplanationCategory) {
    const key = `${tone}:${text.slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ tone, text: text.slice(0, 200), category });
  }

  for (const b of explanation.sections.keyReasons.slice(0, 4)) {
    if (b.category === "BLOCKER" || b.impactRole === "DIRECT_DECISION_DRIVER") {
      push("negative", b.what, b.category);
    }
  }

  for (const e of explanation.sections.evidence.slice(0, 4)) {
    if (e.status === "MISSING") {
      push("negative", `${truncateReason(e.what)} — evidence missing`, e.category);
    } else if (e.status === "FOUND_UNVERIFIED" || e.status === "EXPIRED") {
      push("warning", `${truncateReason(e.what)} — ${evidenceStateExplainLabel(e.status)}`, e.category);
    }
  }

  for (const p of explanation.sections.companyFit.slice(0, 2)) {
    push("positive", p.what, p.category);
  }

  for (const p of explanation.items.filter((i) => i.category === "POSITIVE_FACTOR").slice(0, 2)) {
    push("positive", p.what, p.category);
  }

  if (out.filter((r) => r.tone === "positive").length === 0 && explanation.executiveSummary.positiveSummary) {
    push("positive", explanation.executiveSummary.positiveSummary, "POSITIVE_FACTOR");
  }

  return out.slice(0, 6);
}

function truncateReason(text: string): string {
  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

export function formatSourceLine(item: ExplainableDecisionItem): string {
  const s = item.source;
  if (!s.located && s.kind === "UNKNOWN") {
    return "Source: Unknown";
  }
  const parts = [
    s.documentName,
    s.section ? `Section ${s.section}` : null,
    s.page != null ? `Page ${s.page}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : s.label || "Source: Unknown";
}

export function sectionDetailRows(items: ExplainableDecisionItem[]): Array<{
  what: string;
  why: string;
  status: string | null;
  impact: string;
  sourceLine: string;
  requirementId: string | null;
  evidenceId: string | null;
}> {
  return items.map((item) => ({
    what: item.what,
    why: item.why,
    status: item.status,
    impact: item.impact,
    sourceLine: formatSourceLine(item),
    requirementId: item.requirementId,
    evidenceId: item.evidenceId,
  }));
}
