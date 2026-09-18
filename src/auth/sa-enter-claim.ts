/**
 * Short-lived one-time Super Admin enter-company exchange.
 * URL ticket carries only opaque claim id + HMAC — never the session bearer.
 * Consume is single-use (DB usedAt).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";
import { decryptDeliverySecret, encryptDeliverySecret } from "@/lib/delivery-secret";
import { prisma } from "@/lib/db";

const CLAIM_TTL_MS = 90_000;

type TicketPayload = {
  exp: number;
  jti: string;
};

function sign(payloadB64: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(payloadB64)
    .digest("base64url");
}

function parseTicket(ticket: string): TicketPayload | null {
  const trimmed = ticket.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return null;

  const payloadB64 = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  const expected = sign(payloadB64);

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: TicketPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as TicketPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string" ||
    !payload.jti ||
    payload.exp < Date.now()
  ) {
    return null;
  }
  // Ticket must never embed a session bearer field.
  if ("st" in (payload as object)) return null;
  return payload;
}

/**
 * Persist encrypted session bearer server-side; return opaque signed ticket (jti only).
 */
export async function mintSaEnterClaim(sessionToken: string): Promise<string> {
  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS);
  const row = await prisma.saEnterClaim.create({
    data: {
      sessionTokenEnc: encryptDeliverySecret(sessionToken),
      expiresAt,
    },
  });

  const payload: TicketPayload = {
    exp: expiresAt.getTime(),
    jti: row.id,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify HMAC + single-use consume. Returns company session bearer or null.
 * Does not grant Super Admin — only restores a company-user session minted by SA enter.
 */
export async function consumeSaEnterClaim(ticket: string): Promise<string | null> {
  const parsed = parseTicket(ticket);
  if (!parsed) return null;

  const claimed = await prisma.saEnterClaim.updateMany({
    where: {
      id: parsed.jti,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  const row = await prisma.saEnterClaim.findUnique({ where: { id: parsed.jti } });
  if (!row?.sessionTokenEnc) return null;

  const sessionToken = decryptDeliverySecret(row.sessionTokenEnc);
  await prisma.saEnterClaim
    .update({
      where: { id: row.id },
      data: { sessionTokenEnc: "" },
    })
    .catch(() => undefined);

  return sessionToken;
}

export const SA_ENTER_CLAIM_PATH = "/api/sa-enter-claim" as const;
