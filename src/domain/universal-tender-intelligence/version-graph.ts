/**
 * Document version / corrigendum relationship graph.
 * Never silently overwrites conflicting statements.
 */

import type { DocumentRelationKind, DocumentVersionEdge, UniversalDocumentRole } from "./types";

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(text: string): string {
  return fold(text).slice(0, 400);
}

export function detectDocumentRelation(input: {
  fileName: string;
  role: UniversalDocumentRole;
  text: string;
}): DocumentRelationKind {
  const f = fold(input.fileName);
  const t = fold(input.text);
  if (input.role === "CORRIGENDUM" || /\bcorrigendum\b|\brectificatif\b/.test(f + " " + t)) {
    return "CORRIGENDUM";
  }
  if (input.role === "ADDENDUM" || /\baddendum\b|\bamendment\b/.test(f + " " + t)) {
    return "ADDENDUM";
  }
  if (input.role === "CLARIFICATION" || /\bclarification\b/.test(f)) {
    return "CLARIFICATION";
  }
  if (/\bsupersedes\b|\breplaces\b|\brevised\s+version\b|\brevision\b/.test(t)) {
    return "REVISED";
  }
  if (/\breplacement\b|\breplace(?:s|d)\b/.test(t)) {
    return "REPLACEMENT";
  }
  return "ORIGINAL";
}

export function buildDocumentVersionGraph(
  docs: Array<{
    fileId: string;
    fileName: string;
    role: UniversalDocumentRole;
    text: string;
  }>,
): DocumentVersionEdge[] {
  const edges: DocumentVersionEdge[] = [];
  const byFp = new Map<string, string[]>();

  for (const d of docs) {
    if (!d.text || d.text.length < 80) continue;
    const fp = fingerprint(d.text);
    const list = byFp.get(fp) ?? [];
    list.push(d.fileId);
    byFp.set(fp, list);
  }

  for (const [, ids] of byFp) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i++) {
      edges.push({
        fromFileId: ids[0]!,
        toFileId: ids[i]!,
        relation: "DUPLICATE",
        confidence: 0.9,
        evidence: "Near-identical extracted text fingerprint across package members.",
        conflict: false,
      });
    }
  }

  const bases = docs.filter((d) => {
    const rel = detectDocumentRelation(d);
    return rel === "ORIGINAL";
  });
  const overlays = docs.filter((d) => {
    const rel = detectDocumentRelation(d);
    return (
      rel === "CORRIGENDUM" ||
      rel === "ADDENDUM" ||
      rel === "CLARIFICATION" ||
      rel === "REVISED" ||
      rel === "REPLACEMENT" ||
      rel === "AMENDMENT"
    );
  });

  for (const overlay of overlays) {
    const rel = detectDocumentRelation(overlay);
    const target = bases[0] ?? docs.find((d) => d.fileId !== overlay.fileId);
    if (!target) continue;
    const conflict =
      /\bsupersedes\b|\breplaces\b|\bamends\b|\bmodifies\b|\bannule\b|\bremplace\b/.test(
        fold(overlay.text.slice(0, 4_000)),
      );
    edges.push({
      fromFileId: overlay.fileId,
      toFileId: target.fileId,
      relation: rel,
      confidence: 0.7,
      evidence: `${overlay.fileName} relates to ${target.fileName} as ${rel}`,
      conflict,
    });
  }

  return edges;
}
