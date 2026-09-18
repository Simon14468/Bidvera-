import { z } from "zod";

const stringList = z
  .array(z.string().trim().min(1).max(200))
  .max(100)
  .default([]);

export const profileUpdateSchema = z.object({
  legalCompanyName: z.string().trim().max(200).nullable().optional(),
  tradingName: z.string().trim().max(200).nullable().optional(),
  registrationNumber: z.string().trim().max(100).nullable().optional(),
  taxVatNumber: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  addressLine1: z.string().trim().max(300).nullable().optional(),
  addressLine2: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(40).nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z
    .union([
      z.string().trim().email().max(200),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  contactPhone: z.string().trim().max(60).nullable().optional(),
  website: z.string().trim().max(300).nullable().optional(),
  companyType: z.string().trim().max(120).nullable().optional(),
  yearEstablished: z
    .number()
    .int()
    .min(1800)
    .max(2100)
    .nullable()
    .optional(),
  employeeCount: z.number().int().min(0).max(10_000_000).nullable().optional(),
  annualTurnover: z.string().trim().max(120).nullable().optional(),
  currencies: stringList.optional(),
  businessSectors: stringList.optional(),
  servicesProducts: stringList.optional(),
  certifications: stringList.optional(),
  licenses: stringList.optional(),
  geographicCoverage: stringList.optional(),
  languages: stringList.optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
});

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdateParsed = z.output<typeof profileUpdateSchema>;

export const evidenceCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.string().trim().min(1).max(60).default("OTHER"),
  description: z.string().trim().max(2000).nullable().optional(),
  externalUrl: z
    .union([
      z
        .string()
        .trim()
        .url()
        .max(500)
        .refine(
          (u) => /^https?:\/\//i.test(u),
          "externalUrl must be an http(s) URL",
        ),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export type EvidenceCreateInput = z.infer<typeof evidenceCreateSchema>;

export function normalizeStringList(values: string[] | undefined): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v.slice(0, 200));
  }
  return out;
}
