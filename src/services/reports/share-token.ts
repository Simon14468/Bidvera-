import { getAuthSecret } from "@/lib/auth-secret";
import { generateToken, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { createHmac, timingSafeEqual } from "crypto";

export const REPORT_SHARE_TTL_MS = 72 * 60 * 60 * 1000;

export type ReportSharePayload = {
  companyId: string;
  tenderId: string;
  exp: number;
};

export type ReportShareRow = {
  companyId: string;
  tenderId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

type ShareLookup = (tokenHash: string) => Promise<ReportShareRow | null>;

function invalidShare(): never {
  throw new AppError(ErrorCode.FORBIDDEN, "Invalid share link.", 403);
}

/** Opaque DB tokens are base64url (no `.`). Legacy HMAC tokens are `body.sig`. */
export function isLegacyReportShareToken(token: string): boolean {
  return token.includes(".");
}

export function assertReportShareActive(
  row: ReportShareRow,
  expected?: { companyId?: string; tenderId?: string },
): ReportSharePayload {
  if (expected?.companyId && expected.companyId !== row.companyId) {
    invalidShare();
  }
  if (expected?.tenderId && expected.tenderId !== row.tenderId) {
    invalidShare();
  }
  if (row.revokedAt) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link has been revoked.", 403);
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link has expired.", 403);
  }
  return {
    companyId: row.companyId,
    tenderId: row.tenderId,
    exp: row.expiresAt.getTime(),
  };
}

/** Legacy HMAC constructor — existing 72h links remain verifiable. */
export function createLegacyHmacReportShareToken(input: {
  companyId: string;
  tenderId: string;
  ttlMs?: number;
}): string {
  const payload: ReportSharePayload = {
    companyId: input.companyId,
    tenderId: input.tenderId,
    exp: Date.now() + (input.ttlMs ?? REPORT_SHARE_TTL_MS),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyLegacyHmacReportShareToken(token: string): ReportSharePayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) invalidShare();
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    invalidShare();
  }
  let payload: ReportSharePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ReportSharePayload;
  } catch {
    invalidShare();
  }
  if (!payload.companyId || !payload.tenderId || !payload.exp) {
    invalidShare();
  }
  if (payload.exp < Date.now()) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link has expired.", 403);
  }
  return payload;
}

async function defaultShareLookup(tokenHash: string): Promise<ReportShareRow | null> {
  return prisma.reportShare.findUnique({
    where: { tokenHash },
    select: {
      companyId: true,
      tenderId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}

export async function verifyOpaqueReportShareToken(
  token: string,
  lookup: ShareLookup = defaultShareLookup,
  expected?: { companyId?: string; tenderId?: string },
): Promise<ReportSharePayload> {
  if (!token || isLegacyReportShareToken(token)) invalidShare();
  const row = await lookup(hashToken(token));
  if (!row) invalidShare();
  return assertReportShareActive(row, expected);
}

/** Issue a revocable hashed share token (new shares). */
export async function createReportShareToken(input: {
  companyId: string;
  tenderId: string;
  createdByUserId?: string | null;
  ttlMs?: number;
}): Promise<string> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? REPORT_SHARE_TTL_MS));
  await prisma.reportShare.create({
    data: {
      companyId: input.companyId,
      tenderId: input.tenderId,
      tokenHash: hashToken(token),
      expiresAt,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
  return token;
}

export async function verifyReportShareToken(token: string): Promise<ReportSharePayload> {
  if (isLegacyReportShareToken(token)) {
    return verifyLegacyHmacReportShareToken(token);
  }
  return verifyOpaqueReportShareToken(token);
}

/** Tenant-scoped revocation: only rows for this company + tender. */
export async function revokeReportSharesForTender(
  companyId: string,
  tenderId: string,
): Promise<number> {
  const result = await prisma.reportShare.updateMany({
    where: {
      companyId,
      tenderId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

function sign(body: string) {
  return createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
}
