/**
 * Supplier Qualification service — tenant-scoped profile + evidence.
 * No AI. No tender logic. Evidence is never auto-verified.
 */

import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { storageService } from "@/services/storage";
import {
  completenessChecklist,
  computeProfileCompleteness,
} from "./completeness";
import type {
  SupplierQualificationDashboardDto,
  SupplierQualificationEvidenceDto,
  SupplierQualificationProfileDto,
} from "./types";
import {
  evidenceCreateSchema,
  normalizeStringList,
  profileUpdateSchema,
  type ProfileUpdateInput,
} from "./validation";
import type { Prisma } from "@prisma/client";

type ProfileRow = Prisma.SupplierQualificationProfileGetPayload<{
  include: { _count: { select: { evidence: true } } };
}>;

type EvidenceRow = Prisma.SupplierQualificationEvidenceGetPayload<object>;

function toProfileDto(row: ProfileRow): SupplierQualificationProfileDto {
  return {
    id: row.id,
    companyId: row.companyId,
    legalCompanyName: row.legalCompanyName,
    tradingName: row.tradingName,
    registrationNumber: row.registrationNumber,
    taxVatNumber: row.taxVatNumber,
    country: row.country,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    website: row.website,
    companyType: row.companyType,
    yearEstablished: row.yearEstablished,
    employeeCount: row.employeeCount,
    annualTurnover: row.annualTurnover,
    currencies: row.currencies,
    businessSectors: row.businessSectors,
    servicesProducts: row.servicesProducts,
    certifications: row.certifications,
    licenses: row.licenses,
    geographicCoverage: row.geographicCoverage,
    languages: row.languages,
    notes: row.notes,
    completenessPercent: row.completenessPercent,
    evidenceCount: row._count.evidence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEvidenceDto(row: EvidenceRow): SupplierQualificationEvidenceDto {
  return {
    id: row.id,
    companyId: row.companyId,
    profileId: row.profileId,
    title: row.title,
    kind: row.kind,
    description: row.description,
    hasFile: Boolean(row.storageKey),
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteLength: row.byteLength,
    externalUrl: row.externalUrl,
    provenance: row.provenance,
    verified: row.verified,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mergeForCompleteness(
  existing: ProfileRow | null,
  patch: ProfileUpdateInput,
) {
  const pick = <K extends keyof ProfileUpdateInput>(key: K) =>
    Object.prototype.hasOwnProperty.call(patch, key)
      ? patch[key]
      : existing?.[key as keyof ProfileRow];

  return {
    legalCompanyName: pick("legalCompanyName") as string | null | undefined,
    registrationNumber: pick("registrationNumber") as string | null | undefined,
    taxVatNumber: pick("taxVatNumber") as string | null | undefined,
    country: pick("country") as string | null | undefined,
    addressLine1: pick("addressLine1") as string | null | undefined,
    city: pick("city") as string | null | undefined,
    contactEmail: pick("contactEmail") as string | null | undefined,
    contactPhone: pick("contactPhone") as string | null | undefined,
    companyType: pick("companyType") as string | null | undefined,
    yearEstablished: pick("yearEstablished") as number | null | undefined,
    businessSectors: pick("businessSectors") as string[] | null | undefined,
    servicesProducts: pick("servicesProducts") as string[] | null | undefined,
    geographicCoverage: pick("geographicCoverage") as
      | string[]
      | null
      | undefined,
  };
}

export async function getOrCreateProfile(
  companyId: string,
): Promise<SupplierQualificationProfileDto> {
  let row = await prisma.supplierQualificationProfile.findUnique({
    where: { companyId },
    include: { _count: { select: { evidence: true } } },
  });
  if (!row) {
    row = await prisma.supplierQualificationProfile.create({
      data: { companyId, completenessPercent: 0 },
      include: { _count: { select: { evidence: true } } },
    });
  }
  return toProfileDto(row);
}

export async function getProfile(
  companyId: string,
): Promise<SupplierQualificationProfileDto | null> {
  const row = await prisma.supplierQualificationProfile.findUnique({
    where: { companyId },
    include: { _count: { select: { evidence: true } } },
  });
  return row ? toProfileDto(row) : null;
}

export async function upsertProfile(
  companyId: string,
  raw: unknown,
): Promise<SupplierQualificationProfileDto> {
  const parsed = profileUpdateSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid profile fields.",
      400,
    );
  }
  const patch = parsed.data;

  const listFields = {
    currencies: patch.currencies
      ? normalizeStringList(patch.currencies)
      : undefined,
    businessSectors: patch.businessSectors
      ? normalizeStringList(patch.businessSectors)
      : undefined,
    servicesProducts: patch.servicesProducts
      ? normalizeStringList(patch.servicesProducts)
      : undefined,
    certifications: patch.certifications
      ? normalizeStringList(patch.certifications)
      : undefined,
    licenses: patch.licenses ? normalizeStringList(patch.licenses) : undefined,
    geographicCoverage: patch.geographicCoverage
      ? normalizeStringList(patch.geographicCoverage)
      : undefined,
    languages: patch.languages ? normalizeStringList(patch.languages) : undefined,
  };

  const existing = await prisma.supplierQualificationProfile.findUnique({
    where: { companyId },
    include: { _count: { select: { evidence: true } } },
  });

  const completenessSource = mergeForCompleteness(existing, {
    ...patch,
    ...listFields,
  });
  const completenessPercent = computeProfileCompleteness(completenessSource);

  const data = {
    legalCompanyName: patch.legalCompanyName,
    tradingName: patch.tradingName,
    registrationNumber: patch.registrationNumber,
    taxVatNumber: patch.taxVatNumber,
    country: patch.country,
    addressLine1: patch.addressLine1,
    addressLine2: patch.addressLine2,
    city: patch.city,
    region: patch.region,
    postalCode: patch.postalCode,
    contactName: patch.contactName,
    contactEmail: patch.contactEmail === "" ? null : patch.contactEmail,
    contactPhone: patch.contactPhone,
    website: patch.website,
    companyType: patch.companyType,
    yearEstablished: patch.yearEstablished,
    employeeCount: patch.employeeCount,
    annualTurnover: patch.annualTurnover,
    notes: patch.notes,
    ...listFields,
    completenessPercent,
  };

  // Strip undefined so Prisma partial update works
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  const row = await prisma.supplierQualificationProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      completenessPercent,
      ...clean,
    },
    update: clean,
    include: { _count: { select: { evidence: true } } },
  });

  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(companyId);

  return toProfileDto(row);
}

export async function getDashboard(
  companyId: string,
): Promise<SupplierQualificationDashboardDto> {
  const profile = await getOrCreateProfile(companyId);
  const checklist = completenessChecklist(profile);
  const missingRequired = Object.entries(checklist)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return {
    profile,
    completenessPercent: profile.completenessPercent,
    missingRequired,
    evidenceCount: profile.evidenceCount,
  };
}

export async function listEvidence(
  companyId: string,
): Promise<SupplierQualificationEvidenceDto[]> {
  const profile = await prisma.supplierQualificationProfile.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!profile) return [];
  const rows = await prisma.supplierQualificationEvidence.findMany({
    where: { companyId, profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toEvidenceDto);
}

export async function addEvidence(input: {
  companyId: string;
  meta: unknown;
  file?: { fileName: string; mimeType: string; body: Buffer } | null;
}): Promise<SupplierQualificationEvidenceDto> {
  const parsed = evidenceCreateSchema.safeParse(input.meta);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid evidence fields.",
      400,
    );
  }
  if (!input.file && !parsed.data.externalUrl) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Attach a file or provide an external URL reference.",
      400,
    );
  }

  const profile = await getOrCreateProfile(input.companyId);

  let storageKey: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let byteLength: number | null = null;
  let checksumSha256: string | null = null;

  if (input.file) {
    const stored = await storageService.putObject({
      companyId: input.companyId,
      tenderId: `sq/${profile.id}`,
      fileName: input.file.fileName,
      mimeType: input.file.mimeType,
      body: input.file.body,
    });
    storageKey = stored.storageKey;
    fileName = input.file.fileName;
    mimeType = stored.detectedMimeType || input.file.mimeType;
    byteLength = stored.byteLength;
    checksumSha256 = stored.checksumSha256;
  }

  const provenance = {
    source: input.file ? "upload" : "external_url",
    attachedAt: new Date().toISOString(),
    companyId: input.companyId,
    autoVerified: false,
  };

  const row = await prisma.supplierQualificationEvidence.create({
    data: {
      companyId: input.companyId,
      profileId: profile.id,
      title: parsed.data.title,
      kind: parsed.data.kind,
      description: parsed.data.description ?? null,
      storageKey,
      fileName,
      mimeType,
      byteLength,
      checksumSha256,
      externalUrl: parsed.data.externalUrl ?? null,
      provenance,
      verified: false,
    },
  });

  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(input.companyId);

  return toEvidenceDto(row);
}

export async function getEvidenceFile(input: {
  companyId: string;
  evidenceId: string;
}): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const row = await prisma.supplierQualificationEvidence.findFirst({
    where: { id: input.evidenceId, companyId: input.companyId },
  });
  if (!row?.storageKey) {
    throw new AppError(ErrorCode.NOT_FOUND, "Evidence file not found.", 404);
  }
  if (!row.storageKey.startsWith(`${input.companyId}/`)) {
    throw new AppError(ErrorCode.FORBIDDEN, "File ownership mismatch.", 403);
  }
  try {
    const buffer = await storageService.getObject(row.storageKey);
    return {
      buffer,
      fileName: row.fileName ?? "evidence",
      mimeType: row.mimeType ?? "application/octet-stream",
    };
  } catch {
    throw new AppError(ErrorCode.NOT_FOUND, "Evidence file not found.", 404);
  }
}

export async function deleteEvidence(
  companyId: string,
  evidenceId: string,
): Promise<void> {
  const row = await prisma.supplierQualificationEvidence.findFirst({
    where: { id: evidenceId, companyId },
  });
  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Evidence not found.", 404);
  }
  if (row.storageKey) {
    if (!row.storageKey.startsWith(`${companyId}/`)) {
      throw new AppError(ErrorCode.FORBIDDEN, "File ownership mismatch.", 403);
    }
    await storageService.deleteObject(row.storageKey).catch(() => undefined);
  }
  await prisma.supplierQualificationEvidence.deleteMany({
    where: { id: evidenceId, companyId },
  });
}
