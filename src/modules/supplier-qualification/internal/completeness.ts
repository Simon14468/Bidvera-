/**
 * Deterministic profile completeness — no AI inference.
 * Each required field contributes equally when populated.
 */

export type CompletenessProfileInput = {
  legalCompanyName?: string | null;
  registrationNumber?: string | null;
  taxVatNumber?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  companyType?: string | null;
  yearEstablished?: number | null;
  businessSectors?: string[] | null;
  servicesProducts?: string[] | null;
  geographicCoverage?: string[] | null;
};

export const REQUIRED_COMPLETENESS_FIELDS = [
  "legalCompanyName",
  "registrationNumber",
  "taxVatNumber",
  "country",
  "addressLine1",
  "city",
  "contact",
  "companyType",
  "yearEstablished",
  "businessSectors",
  "servicesProducts",
  "geographicCoverage",
] as const;

export type RequiredCompletenessField =
  (typeof REQUIRED_COMPLETENESS_FIELDS)[number];

function filledString(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function filledList(value: string[] | null | undefined): boolean {
  return Boolean(value && value.some((v) => v.trim().length > 0));
}

export function completenessChecklist(
  input: CompletenessProfileInput,
): Record<RequiredCompletenessField, boolean> {
  return {
    legalCompanyName: filledString(input.legalCompanyName),
    registrationNumber: filledString(input.registrationNumber),
    taxVatNumber: filledString(input.taxVatNumber),
    country: filledString(input.country),
    addressLine1: filledString(input.addressLine1),
    city: filledString(input.city),
    contact:
      filledString(input.contactEmail) || filledString(input.contactPhone),
    companyType: filledString(input.companyType),
    yearEstablished:
      typeof input.yearEstablished === "number" &&
      Number.isFinite(input.yearEstablished) &&
      input.yearEstablished >= 1800 &&
      input.yearEstablished <= 2100,
    businessSectors: filledList(input.businessSectors),
    servicesProducts: filledList(input.servicesProducts),
    geographicCoverage: filledList(input.geographicCoverage),
  };
}

/** Integer 0–100 from required field population only. */
export function computeProfileCompleteness(
  input: CompletenessProfileInput,
): number {
  const checklist = completenessChecklist(input);
  const total = REQUIRED_COMPLETENESS_FIELDS.length;
  const done = REQUIRED_COMPLETENESS_FIELDS.filter((k) => checklist[k]).length;
  return Math.round((done / total) * 100);
}
