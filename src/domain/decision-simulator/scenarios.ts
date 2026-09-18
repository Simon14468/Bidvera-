/**
 * Quick-action simulation scenarios derived from canonical blockers.
 */

import type { SimulationOverrides, SimulationSnapshot } from "./types";

export type SimulationScenarioId = string;

export type SimulationQuickScenario = {
  id: SimulationScenarioId;
  label: string;
  description: string;
  kind: "verify_requirement" | "provide_evidence" | "resolve_blocker" | "resolve_missing_doc" | "company_fit";
  overrides: SimulationOverrides;
  /** Linked team task when human verification would be required in reality. */
  linkedTaskId: string | null;
  requiresVerification: boolean;
};

function truncateLabel(text: string, max = 48): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function buildQuickScenarios(
  snapshot: SimulationSnapshot,
  workflowTasks: Array<{
    id: string;
    title: string;
    requirementId: string | null;
    missingDocId: string | null;
    status: string;
  }> = [],
): SimulationQuickScenario[] {
  const scenarios: SimulationQuickScenario[] = [];
  const seen = new Set<string>();

  const taskForRequirement = (requirementId: string) =>
    workflowTasks.find(
      (t) => t.requirementId === requirementId && t.status !== "COMPLETED",
    ) ?? null;

  const taskForMissingDoc = (docId: string) =>
    workflowTasks.find(
      (t) => t.missingDocId === docId && t.status !== "COMPLETED",
    ) ?? null;

  for (const blocker of snapshot.baselineIntelligence.keyBlockers ?? []) {
    const matchedReq = snapshot.requirements.find(
      (r) =>
        blocker.toLowerCase().includes(r.description.slice(0, 24).toLowerCase()) ||
        r.description.toLowerCase().includes(blocker.slice(0, 24).toLowerCase()),
    );
    if (matchedReq && matchedReq.status !== "MATCHED") {
      const id = `blocker-req-${matchedReq.id}`;
      if (!seen.has(id)) {
        seen.add(id);
        const task = taskForRequirement(matchedReq.id);
        scenarios.push({
          id,
          label: `Resolve blocker: ${truncateLabel(matchedReq.description)}`,
          description: `SIMULATED: mark requirement as verified/matched to test blocker "${truncateLabel(blocker, 60)}"`,
          kind: "resolve_blocker",
          overrides: { requirements: [{ id: matchedReq.id, status: "MATCHED" }] },
          linkedTaskId: task?.id ?? null,
          requiresVerification: task != null || matchedReq.mandatory,
        });
      }
    }
  }

  for (const req of snapshot.requirements) {
    if (req.status === "MATCHED") continue;
    const id = `verify-req-${req.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const task = taskForRequirement(req.id);
    scenarios.push({
      id,
      label: req.mandatory
        ? `Verify mandatory: ${truncateLabel(req.description)}`
        : `Verify: ${truncateLabel(req.description)}`,
      description: "SIMULATED: requirement marked MATCHED — not real verification.",
      kind: "verify_requirement",
      overrides: { requirements: [{ id: req.id, status: "MATCHED" }] },
      linkedTaskId: task?.id ?? null,
      requiresVerification: req.mandatory || task != null,
    });
  }

  for (const doc of snapshot.missingDocuments) {
    const id = `resolve-doc-${doc.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const task = taskForMissingDoc(doc.id);
    scenarios.push({
      id,
      label: `Provide document: ${truncateLabel(doc.documentName, 40)}`,
      description: "SIMULATED: missing document treated as resolved.",
      kind: "resolve_missing_doc",
      overrides: { resolveMissingDocumentIds: [doc.id] },
      linkedTaskId: task?.id ?? null,
      requiresVerification: true,
    });
  }

  for (const ev of snapshot.evidence) {
    if (ev.verificationStatus === "VERIFIED") continue;
    const id = `evidence-${ev.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const req = ev.requirementId
      ? snapshot.requirements.find((r) => r.id === ev.requirementId)
      : null;
    const task = ev.requirementId ? taskForRequirement(ev.requirementId) : null;
    scenarios.push({
      id,
      label: `Verify evidence: ${truncateLabel(req?.description ?? ev.evidenceText.slice(0, 40))}`,
      description: "SIMULATED: evidence verification status only — does not create real evidence.",
      kind: "provide_evidence",
      overrides: {
        evidence: [{ id: ev.id, verificationStatus: "VERIFIED" }],
        ...(req && req.status !== "MATCHED"
          ? { requirements: [{ id: req.id, status: "MATCHED" }] }
          : {}),
      },
      linkedTaskId: task?.id ?? null,
      requiresVerification: true,
    });
  }

  return scenarios.slice(0, 12);
}
