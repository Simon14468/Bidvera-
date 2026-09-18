import type {
  ClientRequestActivityType,
  ClientRequestItemStatus,
  ClientRequestItemType,
  ClientRequestLinkSource,
  ClientRequestStatus,
} from "@prisma/client";

export type ClientRequestItemDto = {
  id: string;
  type: ClientRequestItemType;
  label: string;
  description: string | null;
  sortOrder: number;
  status: ClientRequestItemStatus;
  informationValue: string | null;
  linkSource: ClientRequestLinkSource | null;
  complianceDocumentId: string | null;
  complianceDocumentName: string | null;
  supplierEvidenceId: string | null;
  supplierEvidenceTitle: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type ClientRequestActivityDto = {
  id: string;
  eventType: ClientRequestActivityType;
  message: string | null;
  actorUserId: string | null;
  createdAt: string;
  metadata: unknown;
};

export type ClientRequestShareDto = {
  id: string;
  tokenPrefix: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  itemIds: string[];
  /** Present only right after creation. */
  url?: string;
};

export type ClientRequestDto = {
  id: string;
  clientName: string;
  title: string;
  description: string | null;
  deadline: string;
  deadlineDateOnly: boolean;
  status: ClientRequestStatus;
  progressPercent: number;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  completedItemCount: number;
  items?: ClientRequestItemDto[];
  activities?: ClientRequestActivityDto[];
  shares?: ClientRequestShareDto[];
};

export type ClientRequestDashboardDto = {
  total: number;
  byStatus: Record<ClientRequestStatus, number>;
  requests: ClientRequestDto[];
};

export type SharedClientRequestView = {
  companyName: string;
  clientName: string;
  title: string;
  description: string | null;
  deadline: string;
  deadlineDateOnly: boolean;
  status: ClientRequestStatus;
  progressPercent: number;
  updatedAt: string;
  items: Array<{
    id: string;
    type: ClientRequestItemType;
    label: string;
    description: string | null;
    status: ClientRequestItemStatus;
    informationValue: string | null;
    linkSource: ClientRequestLinkSource | null;
    documentLabel: string | null;
    hasDownload: boolean;
  }>;
  companyProfile: {
    industry: string | null;
    country: string | null;
    companySize: string | null;
    services: string[];
    certifications: string[];
    employeeRange: string | null;
    geographicCoverage: string[];
  } | null;
};
