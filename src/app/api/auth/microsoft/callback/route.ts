import { completeMicrosoftOAuthLogin } from "@/application/microsoft-oauth-service";
import { applySessionCookie } from "@/auth/session";
import { AppError, ErrorCode } from "@/lib/errors";
import { authRateLimiter } from "@/lib/rate-limit";
import {
  MICROSOFT_OAUTH_STATE_COOKIE,
  exchangeMicrosoftAuthorizationCode,
  microsoftOAuthRedirectUri,
  openOAuthStateCookie,
  verifyMicrosoftIdToken,
} from "@/services/auth/microsoft-oauth";
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
  response.cookies.set(MICROSOFT_OAUTH_STATE_COOKIE, "", {
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
 * Microsoft OAuth callback — validates state/PKCE, exchanges code, verifies ID token,
 * creates Bidvera session cookie, redirects into onboarding or `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    await authRateLimiter.check(`oauth-microsoft-cb:${clientIp(request)}`);
  } catch {
    return failRedirect(origin, "Too many requests. Try again later.", ErrorCode.RATE_LIMITED);
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const denied =
      oauthError === "access_denied"
        ? "Microsoft sign-in was cancelled."
        : "Microsoft sign-in failed. Try again.";
    return failRedirect(origin, denied);
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  if (!code || !state) {
    return failRedirect(origin, "Invalid Microsoft sign-in response.");
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawCookie = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${MICROSOFT_OAUTH_STATE_COOKIE}=`))
    ?.slice(MICROSOFT_OAUTH_STATE_COOKIE.length + 1);

  const sealed = rawCookie ? decodeURIComponent(rawCookie) : null;
  const payload = openOAuthStateCookie(sealed);
  if (!payload || payload.n !== state) {
    return failRedirect(origin, "Microsoft sign-in expired. Try again.");
  }

  try {
    const redirectUri = microsoftOAuthRedirectUri();
    const { idToken } = await exchangeMicrosoftAuthorizationCode({
      code,
      codeVerifier: payload.cv,
      redirectUri,
    });
    const claims = await verifyMicrosoftIdToken(idToken, undefined, payload.n);
    const result = await completeMicrosoftOAuthLogin({
      claims,
      nextPath: payload.r,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const dest = new URL(result.redirectTo, origin);
    const response = NextResponse.redirect(dest, { status: 303 });
    applySessionCookie(response, result.sessionToken);
    response.cookies.set(MICROSOFT_OAUTH_STATE_COOKIE, "", {
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
        : "Microsoft sign-in failed. Try again.";
    const code =
      error instanceof AppError ? error.code : ErrorCode.UNAUTHENTICATED;
    return failRedirect(origin, message, code);
  }
}
