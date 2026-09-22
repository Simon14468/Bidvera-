import { completeGoogleOAuthLogin } from "@/application/google-oauth-service";
import { applySessionCookie } from "@/auth/session";
import { AppError, ErrorCode } from "@/lib/errors";
import { authRateLimiter } from "@/lib/rate-limit";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleAuthorizationCode,
  googleOAuthRedirectUri,
  openOAuthStateCookie,
  verifyGoogleIdToken,
} from "@/services/auth/google-oauth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function failRedirect(origin: string, message: string, code = ErrorCode.UNAUTHENTICATED) {
  const dest = new URL("/login", origin);
  dest.searchParams.set("oauth_error", code);
  dest.searchParams.set("oauth_message", message.slice(0, 180));
  const response = NextResponse.redirect(dest, { status: 302 });
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Google OAuth callback — validates state/PKCE, exchanges code, verifies ID token,
 * creates Bidvera session cookie, redirects into onboarding or `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    await authRateLimiter.check(`oauth-google-cb:${clientIp(request)}`);
  } catch {
    return failRedirect(origin, "Too many requests. Try again later.", ErrorCode.RATE_LIMITED);
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const denied =
      oauthError === "access_denied"
        ? "Google sign-in was cancelled."
        : "Google sign-in failed. Try again.";
    return failRedirect(origin, denied);
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  if (!code || !state) {
    return failRedirect(origin, "Invalid Google sign-in response.");
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawCookie = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
    ?.slice(GOOGLE_OAUTH_STATE_COOKIE.length + 1);

  const sealed = rawCookie ? decodeURIComponent(rawCookie) : null;
  const payload = openOAuthStateCookie(sealed);
  if (!payload || payload.n !== state) {
    return failRedirect(origin, "Google sign-in expired. Try again.");
  }

  try {
    const redirectUri = googleOAuthRedirectUri();
    const { idToken } = await exchangeGoogleAuthorizationCode({
      code,
      codeVerifier: payload.cv,
      redirectUri,
    });
    const claims = await verifyGoogleIdToken(idToken);
    const result = await completeGoogleOAuthLogin({
      claims,
      nextPath: payload.r,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const dest = new URL(result.redirectTo, origin);
    const response = NextResponse.redirect(dest, { status: 303 });
    applySessionCookie(response, result.sessionToken);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Google sign-in failed. Try again.";
    const code =
      error instanceof AppError ? error.code : ErrorCode.UNAUTHENTICATED;
    return failRedirect(origin, message, code);
  }
}
