/**
 * Microsoft Entra ID (Azure AD) OAuth 2.0 helpers — authorization URL, PKCE + state,
 * token exchange, and ID token verification. Never logs secrets or tokens.
 */

import { createHash } from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { generateToken } from "@/lib/crypto";
import { AppError, ErrorCode } from "@/lib/errors";
import { resolveMicrosoftOAuthCredentials } from "@/services/auth/settings";
import {
  GOOGLE_OAUTH_STATE_TTL_SEC,
  oauthStateCookieOptions,
  openOAuthStateCookie,
  sealOAuthStateCookie,
  type GoogleOAuthStatePayload,
} from "@/services/auth/google-oauth";
import { safeInternalPath } from "@/domain/security/safe-redirect";

export const MICROSOFT_OAUTH_PROVIDER = "microsoft";
export const MICROSOFT_OAUTH_SCOPES = "openid profile email";
export const MICROSOFT_OAUTH_STATE_COOKIE = "bidvera_oauth_microsoft";
export const MICROSOFT_OAUTH_STATE_TTL_SEC = GOOGLE_OAUTH_STATE_TTL_SEC;
export const MICROSOFT_DEFAULT_TENANT = "common";
export const MICROSOFT_AUTHORITY_ORIGIN = "https://login.microsoftonline.com";

const TENANT_ALIASES = new Set(["common", "organizations", "consumers"]);
const TENANT_GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const jwksByTenant = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type MicrosoftOAuthStatePayload = GoogleOAuthStatePayload;

export type MicrosoftIdClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export function resolveMicrosoftTenantId(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = (env.MICROSOFT_TENANT_ID ?? MICROSOFT_DEFAULT_TENANT).trim();
  const lower = raw.toLowerCase();
  if (TENANT_ALIASES.has(lower)) return lower;
  if (TENANT_GUID_RE.test(raw)) return raw.toLowerCase();
  return MICROSOFT_DEFAULT_TENANT;
}

export function microsoftAuthority(
  tenant: string = resolveMicrosoftTenantId(),
): string {
  return `${MICROSOFT_AUTHORITY_ORIGIN}/${tenant}`;
}

/** Stable redirect URI registered in Microsoft Entra. */
export function microsoftOAuthRedirectUri(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.MICROSOFT_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  const base = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/auth/microsoft/callback`;
}

function microsoftJwks(tenant: string) {
  const existing = jwksByTenant.get(tenant);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(
    new URL(`${MICROSOFT_AUTHORITY_ORIGIN}/${tenant}/discovery/v2.0/keys`),
  );
  jwksByTenant.set(tenant, jwks);
  return jwks;
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function extractMicrosoftEmail(payload: JWTPayload): string {
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (email.includes("@")) return email;
  const upn =
    typeof payload.preferred_username === "string"
      ? payload.preferred_username.trim().toLowerCase()
      : "";
  if (upn.includes("@")) return upn;
  return "";
}

export function isMicrosoftEmailExplicitlyUnverified(payload: JWTPayload): boolean {
  if (payload.email_verified === false || payload.email_verified === "false") {
    return true;
  }
  if (payload.xms_edov === false || payload.xms_edov === "false") {
    return true;
  }
  return false;
}

export function isValidMicrosoftIssuer(
  iss: unknown,
  tid: unknown,
  configuredTenant: string,
): boolean {
  if (typeof iss !== "string" || typeof tid !== "string") return false;
  if (!TENANT_GUID_RE.test(tid)) return false;
  if (iss !== `${MICROSOFT_AUTHORITY_ORIGIN}/${tid}/v2.0`) return false;
  if (TENANT_ALIASES.has(configuredTenant)) return true;
  return tid.toLowerCase() === configuredTenant.toLowerCase();
}

export function microsoftIdClaimsFromPayload(
  payload: JWTPayload,
  expectedNonce?: string,
): MicrosoftIdClaims {
  if (expectedNonce && typeof payload.nonce === "string" && payload.nonce !== expectedNonce) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Microsoft sign-in failed. Try again.",
      401,
    );
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = extractMicrosoftEmail(payload);
  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const picture =
    typeof payload.picture === "string" ? payload.picture.trim() : null;

  if (!sub || !email || !email.includes("@")) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Microsoft did not provide a usable email address.",
      400,
    );
  }
  if (isMicrosoftEmailExplicitlyUnverified(payload)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Verify your Microsoft email address, then try again.",
      403,
    );
  }

  return { sub, email, emailVerified: true, name, picture };
}

export async function buildMicrosoftAuthorizationRequest(input: {
  nextPath?: string | null;
}): Promise<{
  authorizationUrl: string;
  stateCookie: string;
  redirectUri: string;
}> {
  const creds = await resolveMicrosoftOAuthCredentials();
  if (!creds) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Microsoft sign-in is not available.",
      403,
    );
  }

  const nonce = generateToken(24);
  const codeVerifier = generateToken(48);
  const redirectPath = safeInternalPath(input.nextPath, "/dashboard");
  const payload: MicrosoftOAuthStatePayload = {
    n: nonce,
    cv: codeVerifier,
    r: redirectPath,
    t: Date.now(),
  };
  const redirectUri = microsoftOAuthRedirectUri();
  const tenant = resolveMicrosoftTenantId();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: MICROSOFT_OAUTH_SCOPES,
    state: nonce,
    nonce,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return {
    authorizationUrl: `${microsoftAuthority(tenant)}/oauth2/v2.0/authorize?${params.toString()}`,
    stateCookie: sealOAuthStateCookie(payload),
    redirectUri,
  };
}

export async function exchangeMicrosoftAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ idToken: string }> {
  const creds = await resolveMicrosoftOAuthCredentials();
  if (!creds) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Microsoft sign-in is not available.",
      403,
    );
  }

  const tenant = resolveMicrosoftTenantId();
  const body = new URLSearchParams({
    code: input.code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });

  let response: Response;
  try {
    response = await fetch(
      `${microsoftAuthority(tenant)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      },
    );
  } catch {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Could not reach Microsoft. Try again.",
      502,
    );
  }

  if (!response.ok) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Microsoft sign-in failed. Try again.",
      401,
    );
  }

  const json = (await response.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string" || !json.id_token) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Microsoft sign-in failed. Try again.",
      401,
    );
  }
  return { idToken: json.id_token };
}

export async function verifyMicrosoftIdToken(
  idToken: string,
  audience?: string,
  expectedNonce?: string,
): Promise<MicrosoftIdClaims> {
  const creds = audience
    ? { clientId: audience }
    : await resolveMicrosoftOAuthCredentials();
  if (!creds?.clientId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Microsoft sign-in is not available.",
      403,
    );
  }

  const tenant = resolveMicrosoftTenantId();
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, microsoftJwks(tenant), {
      audience: creds.clientId,
    }));
  } catch {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Microsoft sign-in failed. Try again.",
      401,
    );
  }

  if (!isValidMicrosoftIssuer(payload.iss, payload.tid, tenant)) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Microsoft sign-in failed. Try again.",
      401,
    );
  }

  return microsoftIdClaimsFromPayload(payload, expectedNonce);
}

export {
  oauthStateCookieOptions,
  openOAuthStateCookie,
  sealOAuthStateCookie,
};
