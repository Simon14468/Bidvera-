import type { ComplianceStatus } from "@prisma/client";
import type { ExtractionProvenanceEntry } from "./extract-metadata";

export type ComplianceDocumentDto = {
  id: string;
  companyId: string;
  name: string;
  categoryKey: string;
  categoryLabel: string;
  issuingAuthority: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: ComplianceStatus;
  extractionConfidence: number | null;
  extractionProvenance: ExtractionProvenanceEntry[] | null;
  currentVersionId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceCategoryDto = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
};

export type ComplianceReminderSettingsDto = {
  remind90d: boolean;
  remind30d: boolean;
  remind7d: boolean;
  remindExpired: boolean;
  expiringSoonDays: number;
};

export type ComplianceDashboardDto = {
  total: number;
  byStatus: Record<ComplianceStatus, number>;
  expiringSoon: ComplianceDocumentDto[];
  expired: ComplianceDocumentDto[];
};

export type UploadComplianceDocumentInput = {
  companyId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
  /** Optional user-provided overrides (never invent; only override when provided). */
  name?: string;
  categoryKey?: string;
  issuingAuthority?: string;
  documentNumber?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  /** When true, force NO_EXPIRY regardless of extraction. */
  noExpiry?: boolean;
};

export type AddComplianceVersionInput = {
  companyId: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
};
