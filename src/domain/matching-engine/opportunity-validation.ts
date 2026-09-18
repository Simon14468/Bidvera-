/**
 * Public opportunity field validation for corpus ingestion.
 * Does not change scoring — rejects malformed / non-matchable ACTIVE rows.
 */

const PRIVATE_KEY_RE =
  /knowledge|draftText|storageKey|evidenceFile|password|secret|apiKey|token/i;

const ALLOWED_STATUS = new Set([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "ARCHIVED",
]);

export type OpportunityIngestValidationInput = {
  title?: string | null;
  summary?: string | null;
  category?: string | null;
  industry?: string | null;
  services?: string[] | null;
  industries?: string[] | null;
  geographies?: string[] | null;
  certifications?: string[] | null;
  status?: string | null;
  source?: string | null;
  externalRef?: string | null;
  sponsorshipMeta?: unknown;
  signalsJson?: unknown;
};

export type OpportunityIngestValidationResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

function nonEmptyStrings(arr: string[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function rejectPrivateKeys(value: unknown, label: string, reasons: string[]) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    if (typeof value === "string" && value.length > 50_000) {
      reasons.push(`${label} exceeds size limit.`);
    }
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (PRIVATE_KEY_RE.test(key)) {
      reasons.push(`${label} must not include private field "${key}".`);
    }
  }
}

/**
 * Validate opportunity ingest payload.
 * ACTIVE opportunities must carry public capability + geography dimensions.
 * DRAFT may be incomplete for staged corpus loading.
 */
export function validateOpportunityIngest(
  input: OpportunityIngestValidationInput,
): OpportunityIngestValidationResult {
  const reasons: string[] = [];
  const title = input.title?.trim() ?? "";
  if (!title) reasons.push("title is required.");
  if (title.length > 500) reasons.push("title is too long.");

  const status = (input.status ?? "DRAFT").toUpperCase();
  if (!ALLOWED_STATUS.has(status)) {
    reasons.push(`status must be one of ${[...ALLOWED_STATUS].join(", ")}.`);
  }

  const source = input.source?.trim() ?? "";
  if (source.length > 64) reasons.push("source is too long.");
  const externalRef = input.externalRef?.trim() ?? "";
  if (externalRef.length > 191) reasons.push("externalRef is too long.");

  const services = nonEmptyStrings(input.services ?? undefined);
  const industries = nonEmptyStrings(input.industries ?? undefined);
  const geographies = nonEmptyStrings(input.geographies ?? undefined);
  const category = input.category?.trim() || "";
  const industry = input.industry?.trim() || "";

  if (status === "ACTIVE") {
    const hasCapability =
      services.length > 0 ||
      industries.length > 0 ||
      Boolean(category) ||
      Boolean(industry);
    if (!hasCapability) {
      reasons.push(
        "ACTIVE opportunities require at least one public capability signal (services, industries, category, or industry).",
      );
    }
    if (geographies.length === 0) {
      reasons.push("ACTIVE opportunities require at least one geography.");
    }
  }

  rejectPrivateKeys(input.sponsorshipMeta, "sponsorshipMeta", reasons);
  rejectPrivateKeys(input.signalsJson, "signalsJson", reasons);

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}
