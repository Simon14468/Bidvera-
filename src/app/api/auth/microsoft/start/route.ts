import {
  buildMicrosoftAuthorizationRequest,
  oauthStateCookieOptions,
  MICROSOFT_OAUTH_STATE_COOKIE,
} from "@/services/auth/microsoft-oauth";
import { authRateLimiter } from "@/lib/rate-limit";
import { AppError, ErrorCode } from "@/lib/errors";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Starts Microsoft OAuth — sets CSRF/PKCE cookie and redirects to Entra.
 * Query: `next` (optional safe internal path).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const loginFallback = new URL("/login", url.origin);

  try {
    await authRateLimiter.check(`oauth-microsoft-start:${clientIp(request)}`);
    const { authorizationUrl, stateCookie } =
      await buildMicrosoftAuthorizationRequest({ nextPath: next });

    const response = NextResponse.redirect(authorizationUrl, { status: 302 });
    response.cookies.set(
      MICROSOFT_OAUTH_STATE_COOKIE,
      stateCookie,
      oauthStateCookieOptions(),
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Microsoft sign-in is not available.";
    const code =
      error instanceof AppError ? error.code : ErrorCode.INTERNAL;
    loginFallback.searchParams.set("oauth_error", code);
    loginFallback.searchParams.set("oauth_message", message.slice(0, 180));
    return NextResponse.redirect(loginFallback, { status: 302 });
  }
}
