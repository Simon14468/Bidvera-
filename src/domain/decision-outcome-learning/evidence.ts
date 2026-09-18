/**
 * User-provided outcome evidence — never treated as AI-generated tender evidence.
 */

export type OutcomeUserEvidence = {
  userProvided: true;
  attachmentDocumentId?: string;
  attachmentFileName?: string;
  notes?: string;
};

export const USER_OUTCOME_EVIDENCE_DISCLAIMER =
  "User-recorded outcome notes and attachments are company-provided context only — not AI-extracted tender evidence.";

export function parseOutcomeUserEvidence(raw: unknown): OutcomeUserEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.userProvided !== true) return null;
  return {
    userProvided: true,
    attachmentDocumentId:
      typeof o.attachmentDocumentId === "string" ? o.attachmentDocumentId : undefined,
    attachmentFileName:
      typeof o.attachmentFileName === "string" ? o.attachmentFileName : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
  };
}

export function buildOutcomeUserEvidence(input: {
  attachmentDocumentId?: string | null;
  attachmentFileName?: string | null;
  notes?: string | null;
}): OutcomeUserEvidence | null {
  const hasAttachment = Boolean(input.attachmentDocumentId);
  const notes = input.notes?.trim() || undefined;
  if (!hasAttachment && !notes) return null;
  return {
    userProvided: true,
    attachmentDocumentId: input.attachmentDocumentId ?? undefined,
    attachmentFileName: input.attachmentFileName ?? undefined,
    notes,
  };
}

export function outcomeEvidenceChanged(
  prev: OutcomeUserEvidence | null,
  next: OutcomeUserEvidence | null,
): boolean {
  const prevId = prev?.attachmentDocumentId ?? null;
  const nextId = next?.attachmentDocumentId ?? null;
  const prevNotes = prev?.notes ?? null;
  const nextNotes = next?.notes ?? null;
  return prevId !== nextId || prevNotes !== nextNotes;
}
