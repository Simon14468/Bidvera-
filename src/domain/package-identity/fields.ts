/**
 * Authority-weighted metadata resolution.
 * Labelled evidence only. Non-authoritative documents cannot invent
 * buyer/title/value or force CONFLICT against a higher-authority source.
 */

import type {
  FieldResolutionStatus,
  IdentityCandidate,
  PackageIdentityDocument,
  PackageIdentityPart,
  ResolvedIdentityField,
} from "./types";
import { metadataAuthority } from "./roles";

const TEMPLATE_VALUE =
  /\[(?:insert|name|to\s+be\s+completed|procuring\s+entity)[^\]]*\]|_{4,}|\bto\s+be\s+completed\b|\bname\s+of\s+(?:the\s+)?procuring\s+entity\b/i;

function foldKey(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltd|limited|llc|inc|plc|sdn|bhd)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTemplateOrIncomplete(value: string): boolean {
  const v = value.trim();
  if (v.length < 4) return true;
  if (TEMPLATE_VALUE.test(v)) return true;
  if (/\b(?:see\s+below|tba|tbd|n\/?a)\b/i.test(v)) return true;
  return false;
}

export function resolveIdentityField(
  candidates: IdentityCandidate[],
): ResolvedIdentityField {
  const usable = candidates.filter((c) => c.value.trim().length > 0 && !isTemplateOrIncomplete(c.value));
  if (usable.length === 0) {
    const truncatedOnly = candidates.some((c) => c.truncated && c.value.trim().length > 0);
    return {
      value: null,
      status: truncatedOnly ? "INCOMPLETE" : "UNKNOWN",
      candidates,
    };
  }

  const maxAuthority = Math.max(...usable.map((c) => c.authority));
  const pool =
    maxAuthority > 0
      ? usable.filter((c) => c.authority === maxAuthority)
      : usable;
  if (pool.length === 0) {
    return { value: null, status: "UNKNOWN", candidates };
  }

  const complete = pool.filter((c) => !c.truncated);
  const working = complete.length > 0 ? complete : pool;
  if (complete.length === 0 && working.every((c) => c.truncated)) {
    const groups = group(working);
    if (groups.size > 1) {
      return { value: null, status: "CONFLICT", candidates };
    }
    return { value: null, status: "INCOMPLETE", candidates };
  }

  const groups = group(working);
  if (groups.size > 1) {
    return { value: null, status: "CONFLICT", candidates };
  }
  const winner = [...groups.values()][0]![0]!;
  return { value: winner.value, status: "OK", candidates };
}

function group(list: IdentityCandidate[]): Map<string, IdentityCandidate[]> {
  const groups = new Map<string, IdentityCandidate[]>();
  for (const c of list) {
    const k = foldKey(c.value);
    if (!k) continue;
    const cur = groups.get(k) ?? [];
    cur.push(c);
    groups.set(k, cur);
  }
  return groups;
}

export function collectLabelledCandidates(
  parts: PackageIdentityPart[],
  documents: PackageIdentityDocument[],
  field: "client" | "title" | "reference" | "estimatedValue" | "location" | "country" | "procurementType",
): IdentityCandidate[] {
  const byFile = new Map(documents.map((d) => [d.fileName, d]));
  const out: IdentityCandidate[] = [];
  for (const part of parts) {
    const doc = byFile.get(part.fileName);
    const role = doc?.role ?? "UNKNOWN";
    const truncated =
      part.truncated === true || doc?.completeness === "TRUNCATED";
    const raw =
      field === "estimatedValue"
        ? part.extraction?.estimatedValue != null
          ? String(part.extraction.estimatedValue)
          : null
        : field === "client"
          ? part.extraction?.client
          : field === "title"
            ? part.extraction?.title
            : field === "reference"
              ? part.extraction?.reference
              : field === "location"
                ? part.extraction?.location ?? labelledLocation(part.text)
                : field === "country"
                  ? part.extraction?.country ?? null
                  : field === "procurementType"
                    ? part.extraction?.procurementType ?? labelledProcurementType(part.text)
                    : part.extraction?.reference;
    if (!raw?.trim()) continue;
    if (field === "title") {
      const stem = part.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      if (foldKey(raw) === foldKey(stem) || foldKey(raw) === foldKey(part.fileName)) {
        continue;
      }
    }
    const authority = metadataAuthority(role);
    if (authority === 0 && role !== "UNKNOWN" && role !== "OTHER" && role !== "ANNEX") {
      continue;
    }
    out.push({
      value: raw.replace(/\s+/g, " ").trim(),
      sourceFile: part.fileName,
      sourceText: raw.replace(/\s+/g, " ").trim().slice(0, 240),
      authority,
      role,
      truncated,
    });
  }
  return out;
}

function labelledLocation(text: string): string | null {
  const m = text.match(
    /(?:place\s+of\s+(?:performance|delivery|execution)|delivery\s+location|lieu\s+(?:de\s+)?(?:livraison|execution)|location)\s*[:\-]\s*([^\n]{4,80})/i,
  );
  const value = m?.[1]?.replace(/\s+/g, " ").trim().slice(0, 80) ?? null;
  if (!value || isTemplateOrIncomplete(value)) return null;
  return value;
}

function labelledProcurementType(text: string): string | null {
  const m = text.match(
    /(?:procurement\s+(?:type|method)|procedure|mode\s+de\s+passation)\s*[:\-]\s*([^\n]{4,80})/i,
  );
  return m?.[1]?.replace(/\s+/g, " ").trim().slice(0, 80) ?? null;
}

export function fieldStatusNote(
  key: string,
  field: { status: FieldResolutionStatus; value: string | null; candidates: IdentityCandidate[] },
): string | null {
  if (field.status === "CONFLICT") {
    const vs = field.candidates
      .filter((c) => c.authority > 0)
      .map((c) => `${c.value} [${c.sourceFile}/${c.role}]`)
      .join(" | ");
    return `${key}=CONFLICT (${vs})`;
  }
  if (field.status === "INCOMPLETE") {
    return `${key}=INCOMPLETE`;
  }
  if (field.status === "OK" && field.value) {
    const src = field.candidates.find((c) => foldKey(c.value) === foldKey(field.value!));
    return `${key}=${field.value} (source=${src?.sourceFile ?? "package"})`;
  }
  return null;
}
