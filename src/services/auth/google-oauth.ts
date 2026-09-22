/**
 * Google OAuth 2.0 helpers — authorization URL, PKCE + state cookies, token exchange,
 * and ID token verification. Never logs secrets or tokens.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/auth-secret";
import { generateToken } from "@/lib/crypto";
import { AppError, ErrorCode } from "@/lib/errors";
import { resolveGoogleOAuthCredentials } from "@/services/auth/settings";
import { safeInternalPath } from "@/domain/security/safe-redirect";

export const GOOGLE_OAUTH_PROVIDER = "google";
export const GOOGLE_OAUTH_SCOPES = "openid email profile";
export const GOOGLE_OAUTH_STATE_COOKIE = "bidvera_oauth_google";
/** Cookie lifetime — short window for the authorization round-trip. */
export const GOOGLE_OAUTH_STATE_TTL_SEC = 600;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type GoogleOAuthStatePayload = {
  /** Random nonce mirrored in the OAuth `state` query param. */
  n: string;
  /** PKCE code_verifier */
  cv: string;
  /** Safe post-login path */
  r: string;
  /** Epoch ms when issued */
  t: number;
};

export type GoogleIdClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/** Stable redirect URI registered in Google Cloud Console. */
export function googleOAuthRedirectUri(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  const base = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/auth/google/callback`;
}

function signPayload(raw: string): string {
  return createHmac("sha256", getAuthSecret()).update(raw).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sealOAuthStateCookie(payload: GoogleOAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signPayload(body)}`;
}

export function openOAuthStateCookie(
  cookieValue: string | undefined | null,
): GoogleOAuthStatePayload | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!safeEqual(signPayload(body), sig)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as GoogleOAuthStatePayload;
    if (
      typeof parsed?.n !== "string" ||
      typeof parsed?.cv !== "string" ||
      typeof parsed?.r !== "string" ||
      typeof parsed?.t !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.t > GOOGLE_OAUTH_STATE_TTL_SEC * 1000) return null;
    if (Date.now() < parsed.t - 60_000) return null;
    return {
      n: parsed.n,
      cv: parsed.cv,
      r: safeInternalPath(parsed.r, "/dashboard"),
      t: parsed.t,
    };
  } catch {
    return null;
  }
}

export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: GOOGLE_OAUTH_STATE_TTL_SEC,
  };
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function buildGoogleAuthorizationRequest(input: {
  nextPath?: string | null;
}): Promise<{
  authorizationUrl: string;
  stateCookie: string;
  redirectUri: string;
}> {
  const creds = await resolveGoogleOAuthCredentials();
  if (!creds) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Google sign-in is not available.",
      403,
    );
  }

  const nonce = generateToken(24);
  const codeVerifier = generateToken(48);
  const redirectPath = safeInternalPath(input.nextPath, "/dashboard");
  const payload: GoogleOAuthStatePayload = {
    n: nonce,
    cv: codeVerifier,
    r: redirectPath,
    t: Date.now(),
  };
  const redirectUri = googleOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    state: nonce,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  return {
    authorizationUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    stateCookie: sealOAuthStateCookie(payload),
    redirectUri,
  };
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ idToken: string }> {
  const creds = await resolveGoogleOAuthCredentials();
  if (!creds) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Google sign-in is not available.",
      403,
    );
  }

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
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Could not reach Google. Try again.",
      502,
    );
  }

  if (!response.ok) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Google sign-in failed. Try again.",
      401,
    );
  }

  const json = (await response.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string" || !json.id_token) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Google sign-in failed. Try again.",
      401,
    );
  }
  return { idToken: json.id_token };
}

export async function verifyGoogleIdToken(
  idToken: string,
  audience?: string,
): Promise<GoogleIdClaims> {
  const creds = audience
    ? { clientId: audience }
    : await resolveGoogleOAuthCredentials();
  if (!creds?.clientId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Google sign-in is not available.",
      403,
    );
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: creds.clientId,
    }));
  } catch {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Google sign-in failed. Try again.",
      401,
    );
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const picture =
    typeof payload.picture === "string" ? payload.picture.trim() : null;

  if (!sub || !email || !email.includes("@")) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Google did not provide a usable email address.",
      400,
    );
  }
  if (!emailVerified) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Verify your Google email address, then try again.",
      403,
    );
  }

  return { sub, email, emailVerified: true, name, picture };
}
