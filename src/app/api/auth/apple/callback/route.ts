import { completeAppleOAuthLogin } from "@/application/apple-oauth-service";
import { applySessionCookie } from "@/auth/session";
import { AppError, ErrorCode } from "@/lib/errors";
import { authRateLimiter } from "@/lib/rate-limit";
import {
  APPLE_OAUTH_STATE_COOKIE,
  appleOAuthRedirectUri,
  exchangeAppleAuthorizationCode,
  openOAuthStateCookie,
  parseAppleUserName,
  verifyAppleIdToken,
} from "@/services/auth/apple-oauth";
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
  response.cookies.set(APPLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function readStateCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawCookie = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${APPLE_OAUTH_STATE_COOKIE}=`))
    ?.slice(APPLE_OAUTH_STATE_COOKIE.length + 1);
  return rawCookie ? decodeURIComponent(rawCookie) : null;
}

function resolveAppleState(state: string, cookieValue: string | null) {
  const fromState = openOAuthStateCookie(state);
  const fromCookie = openOAuthStateCookie(cookieValue);
  if (fromState && fromCookie && fromState.n !== fromCookie.n) return null;
  if (fromState) return fromState;
  if (fromCookie && fromCookie.n === state) return fromCookie;
  return null;
}

async function handleAppleCallback(
  request: Request,
  params: { code: string; state: string; error: string; user: string },
) {
  const origin = new URL(request.url).origin;

  try {
    await authRateLimiter.check(`oauth-apple-cb:${clientIp(request)}`);
  } catch {
    return failRedirect(origin, "Too many requests. Try again later.", ErrorCode.RATE_LIMITED);
  }

  if (params.error) {
    const denied =
      params.error === "access_denied" || params.error === "user_cancelled_authorize"
        ? "Apple sign-in was cancelled."
        : "Apple sign-in failed. Try again.";
    return failRedirect(origin, denied);
  }

  const code = params.code.trim();
  const state = params.state.trim();
  if (!code || !state) {
    return failRedirect(origin, "Invalid Apple sign-in response.");
  }

  const payload = resolveAppleState(state, readStateCookie(request));
  if (!payload) {
    return failRedirect(origin, "Apple sign-in expired. Try again.");
  }

  try {
    const redirectUri = appleOAuthRedirectUri();
    const { idToken } = await exchangeAppleAuthorizationCode({
      code,
      redirectUri,
    });
    const claims = await verifyAppleIdToken(idToken, undefined, payload.n);
    const firstName = parseAppleUserName(params.user);
    if (firstName) claims.name = firstName;

    const result = await completeAppleOAuthLogin({
      claims,
      nextPath: payload.r,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const dest = new URL(result.redirectTo, origin);
    const response = NextResponse.redirect(dest, { status: 303 });
    applySessionCookie(response, result.sessionToken);
    response.cookies.set(APPLE_OAUTH_STATE_COOKIE, "", {
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
        : "Apple sign-in failed. Try again.";
    const code =
      error instanceof AppError ? error.code : ErrorCode.UNAUTHENTICATED;
    return failRedirect(origin, message, code);
  }
}

/**
 * Apple may return a GET (tests / query) or POST (`response_mode=form_post`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleAppleCallback(request, {
    code: url.searchParams.get("code") ?? "",
    state: url.searchParams.get("state") ?? "",
    error: url.searchParams.get("error") ?? "",
    user: url.searchParams.get("user") ?? "",
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  return handleAppleCallback(request, {
    code: String(form.get("code") ?? ""),
    state: String(form.get("state") ?? ""),
    error: String(form.get("error") ?? ""),
    user: String(form.get("user") ?? ""),
  });
}
