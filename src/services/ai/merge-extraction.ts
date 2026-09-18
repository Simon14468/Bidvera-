/**
 * Merge per-chunk AI extraction drafts against the full corpus.
 * Chunk windows are CONTEXT_WINDOW_ONLY; the merge is the analysis draft, not the source.
 */

import {
  extractionResultSchema,
  type ExtractionResult,
} from "@/domain/schemas";

function firstFilled<T>(values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    return value;
  }
  return null;
}

function requirementKey(description: string): string {
  return description.replace(/\s+/g, " ").trim().toLowerCase();
}

export function mergeExtractionResults(parts: ExtractionResult[]): ExtractionResult {
  if (parts.length === 0) {
    return extractionResultSchema.parse({
      title: null,
      client: null,
      country: null,
      region: null,
      industry: null,
      deadlineIso: null,
      deadlineTimezone: null,
      estimatedValue: null,
      guarantee: null,
      requirements: [],
      missingDocuments: [],
    });
  }
  if (parts.length === 1) return parts[0]!;

  const seenReq = new Set<string>();
  const requirements: ExtractionResult["requirements"] = [];
  for (const part of parts) {
    for (const req of part.requirements) {
      const key = requirementKey(req.description);
      if (!key || seenReq.has(key)) continue;
      seenReq.add(key);
      requirements.push(req);
    }
  }

  const seenMissing = new Set<string>();
  const missingDocuments: ExtractionResult["missingDocuments"] = [];
  for (const part of parts) {
    for (const doc of part.missingDocuments ?? []) {
      const key = doc.documentName.replace(/\s+/g, " ").trim().toLowerCase();
      if (!key || seenMissing.has(key)) continue;
      seenMissing.add(key);
      missingDocuments.push(doc);
    }
  }

  return extractionResultSchema.parse({
    title: firstFilled(parts.map((p) => p.title)),
    client: firstFilled(parts.map((p) => p.client)),
    country: firstFilled(parts.map((p) => p.country)),
    region: firstFilled(parts.map((p) => p.region)),
    industry: firstFilled(parts.map((p) => p.industry)),
    deadlineIso: firstFilled(parts.map((p) => p.deadlineIso)),
    deadlineTimezone: firstFilled(parts.map((p) => p.deadlineTimezone)),
    estimatedValue: firstFilled(parts.map((p) => p.estimatedValue)),
    guarantee: firstFilled(parts.map((p) => p.guarantee)),
    requirements,
    missingDocuments,
  });
}
