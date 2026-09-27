/**
 * Sign in with Apple helpers — authorization URL, HMAC state, client_secret JWT,
 * token exchange, and ID token verification. Never logs secrets, tokens, or the .p8 key.
 */

import { createHash } from "crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { generateToken } from "@/lib/crypto";
import { AppError, ErrorCode } from "@/lib/errors";
import { resolveAppleOAuthCredentials } from "@/services/auth/settings";
import {
  GOOGLE_OAUTH_STATE_TTL_SEC,
  oauthStateCookieOptions,
  openOAuthStateCookie,
  sealOAuthStateCookie,
  type GoogleOAuthStatePayload,
} from "@/services/auth/google-oauth";
import { safeInternalPath } from "@/domain/security/safe-redirect";

export const APPLE_OAUTH_PROVIDER = "apple";
export const APPLE_OAUTH_SCOPES = "name email";
export const APPLE_OAUTH_STATE_COOKIE = "bidvera_oauth_apple";
export const APPLE_OAUTH_STATE_TTL_SEC = GOOGLE_OAUTH_STATE_TTL_SEC;
export const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_PRIVATE_RELAY_DOMAIN = "privaterelay.appleid.com";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type AppleOAuthStatePayload = GoogleOAuthStatePayload;

export type AppleOAuthCredentials = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export type AppleIdClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/** Stable redirect URI registered in Apple Developer (Services ID). */
export function appleOAuthRedirectUri(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.APPLE_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  const base = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/auth/apple/callback`;
}

export function normalizeApplePrivateKey(raw: string): string {
  const pem = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").replace(/\\n/g, "\n").trim();
  if (pem.includes("BEGIN PRIVATE KEY")) return pem;
  const body = pem.replace(/\s+/g, "");
  if (!body) return pem;
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

export function isApplePrivateRelayEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return email.slice(at + 1).toLowerCase() === APPLE_PRIVATE_RELAY_DOMAIN;
}

export function extractAppleEmail(payload: JWTPayload): string {
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  return email.includes("@") ? email : "";
}

export function isAppleEmailExplicitlyUnverified(payload: JWTPayload): boolean {
  return payload.email_verified === false || payload.email_verified === "false";
}

export function parseAppleUserName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      name?: { firstName?: unknown; lastName?: unknown };
    };
    const first =
      typeof parsed?.name?.firstName === "string" ? parsed.name.firstName.trim() : "";
    const last =
      typeof parsed?.name?.lastName === "string" ? parsed.name.lastName.trim() : "";
    const name = [first, last].filter(Boolean).join(" ").trim();
    return name.length > 0 ? name.slice(0, 120) : null;
  } catch {
    return null;
  }
}

function appleNonceMatches(claimed: unknown, expected: string): boolean {
  if (typeof claimed !== "string" || !claimed) return false;
  if (claimed === expected) return true;
  const hashed = createHash("sha256").update(expected).digest("hex");
  return claimed === hashed;
}

export function appleIdClaimsFromPayload(
  payload: JWTPayload,
  expectedNonce?: string,
): AppleIdClaims {
  if (
    expectedNonce &&
    typeof payload.nonce === "string" &&
    !appleNonceMatches(payload.nonce, expectedNonce)
  ) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Apple sign-in failed. Try again.",
      401,
    );
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = extractAppleEmail(payload);

  if (!sub || !email || !email.includes("@")) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Apple did not provide a usable email address.",
      400,
    );
  }
  if (isAppleEmailExplicitlyUnverified(payload)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Verify your Apple email address, then try again.",
      403,
    );
  }

  return { sub, email, emailVerified: true, name: null, picture: null };
}

export async function createAppleClientSecret(
  creds: AppleOAuthCredentials,
): Promise<string> {
  let key;
  try {
    key = await importPKCS8(normalizeApplePrivateKey(creds.privateKey), "ES256");
  } catch {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Apple sign-in is not available.",
      403,
    );
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: creds.keyId })
    .setIssuer(creds.teamId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(APPLE_ISSUER)
    .setSubject(creds.clientId)
    .sign(key);
}

export async function buildAppleAuthorizationRequest(input: {
  nextPath?: string | null;
}): Promise<{
  authorizationUrl: string;
  stateCookie: string;
  redirectUri: string;
}> {
  const creds = await resolveAppleOAuthCredentials();
  if (!creds) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Apple sign-in is not available.",
      403,
    );
  }

  const nonce = generateToken(24);
  const codeVerifier = generateToken(48);
  const redirectPath = safeInternalPath(input.nextPath, "/dashboard");
  const payload: AppleOAuthStatePayload = {
    n: nonce,
    cv: codeVerifier,
    r: redirectPath,
    t: Date.now(),
  };
  const redirectUri = appleOAuthRedirectUri();
  const stateCookie = sealOAuthStateCookie(payload);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "form_post",
    scope: APPLE_OAUTH_SCOPES,
    state: stateCookie,
    nonce,
  });

  return {
    authorizationUrl: `${APPLE_AUTHORIZE_URL}?${params.toString()}`,
    stateCookie,
    redirectUri,
  };
}

export async function exchangeAppleAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ idToken: string }> {
  const creds = await resolveAppleOAuthCredentials();
  if (!creds) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Apple sign-in is not available.",
      403,
    );
  }

  const clientSecret = await createAppleClientSecret(creds);
  const body = new URLSearchParams({
    code: input.code,
    client_id: creds.clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });

  let response: Response;
  try {
    response = await fetch(APPLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Could not reach Apple. Try again.",
      502,
    );
  }

  if (!response.ok) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Apple sign-in failed. Try again.",
      401,
    );
  }

  const json = (await response.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string" || !json.id_token) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Apple sign-in failed. Try again.",
      401,
    );
  }
  return { idToken: json.id_token };
}

export async function verifyAppleIdToken(
  idToken: string,
  audience?: string,
  expectedNonce?: string,
): Promise<AppleIdClaims> {
  const creds = audience
    ? { clientId: audience }
    : await resolveAppleOAuthCredentials();
  if (!creds?.clientId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Apple sign-in is not available.",
      403,
    );
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: creds.clientId,
    }));
  } catch {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Apple sign-in failed. Try again.",
      401,
    );
  }

  return appleIdClaimsFromPayload(payload, expectedNonce);
}

export {
  oauthStateCookieOptions,
  openOAuthStateCookie,
  sealOAuthStateCookie,
};
