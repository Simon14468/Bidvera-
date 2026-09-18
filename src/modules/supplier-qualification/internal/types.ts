import type { CompletenessProfileInput } from "./completeness";

export type SupplierQualificationEvidenceDto = {
  id: string;
  companyId: string;
  profileId: string;
  title: string;
  kind: string;
  description: string | null;
  /** True when a tenant-owned file is attached — storage keys are never exposed. */
  hasFile: boolean;
  fileName: string | null;
  mimeType: string | null;
  byteLength: number | null;
  externalUrl: string | null;
  provenance: unknown;
  /** Always false unless explicitly set — profile text is never auto-verified. */
  verified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierQualificationProfileDto = {
  id: string;
  companyId: string;
  legalCompanyName: string | null;
  tradingName: string | null;
  registrationNumber: string | null;
  taxVatNumber: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  companyType: string | null;
  yearEstablished: number | null;
  employeeCount: number | null;
  annualTurnover: string | null;
  currencies: string[];
  businessSectors: string[];
  servicesProducts: string[];
  certifications: string[];
  licenses: string[];
  geographicCoverage: string[];
  languages: string[];
  notes: string | null;
  completenessPercent: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierQualificationDashboardDto = {
  profile: SupplierQualificationProfileDto | null;
  completenessPercent: number;
  missingRequired: string[];
  evidenceCount: number;
};

export type ProfileFields = CompletenessProfileInput & {
  tradingName?: string | null;
  addressLine2?: string | null;
  region?: string | null;
  postalCode?: string | null;
  contactName?: string | null;
  website?: string | null;
  employeeCount?: number | null;
  annualTurnover?: string | null;
  currencies?: string[] | null;
  certifications?: string[] | null;
  licenses?: string[] | null;
  languages?: string[] | null;
  notes?: string | null;
};
