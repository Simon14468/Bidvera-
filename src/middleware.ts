import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSuperAdminPath } from "@/config/super-admin";
import {
  defaultLocale,
  isLocale,
  localeCookieName,
  type Locale,
} from "@/i18n/config";

const PUBLIC = [
  "/",
  "/product",
  "/pricing",
  "/faq",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/confirm-email-change",
  "/api/health",
  "/api/ready",
  "/api/billing/webhook",
];

const PUBLIC_PREFIXES = [
  "/solutions",
  "/use-cases",
  "/compare",
  "/resources",
  "/guides",
  "/glossary",
] as const;

function isPublicPath(pathname: string) {
  if (PUBLIC.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname.startsWith("/share/report/")) return true;
  if (pathname.startsWith("/share/client-request/")) return true;
  // One-time SA enter claim (ticket-authenticated; no company session yet).
  if (pathname === "/api/sa-enter-claim") return true;
  return false;
}

function resolveLocale(request: NextRequest): Locale {
  const langParam = request.nextUrl.searchParams.get("lang");
  if (isLocale(langParam)) return langParam;

  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const accept = request.headers.get("accept-language") ?? "";
  const preferred = accept
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const tag of preferred) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
    if (tag.startsWith("zh")) return "zh";
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const saResolved = resolveSuperAdminPath();
  // Fail closed: if Super Admin is unconfigured, never treat any path as privileged.
  // Do not throw — that would take down the entire application.
  const saPath = saResolved.ok ? `/${saResolved.path}` : null;
  const isSuperAdminRoute =
    !!saPath && (pathname === saPath || pathname.startsWith(`${saPath}/`));

  // Super Admin uses its own session cookie — never company session.
  // Do NOT bounce /login → home based on cookie presence alone: a stale
  // cookie would loop with panel layouts that validate the session in DB.
  if (isSuperAdminRoute && saPath) {
    const adminToken = request.cookies.get("bidvera_sa_session")?.value;
    const isLogin = pathname === `${saPath}/login`;
    if (!isLogin && !adminToken) {
      const url = request.nextUrl.clone();
      url.pathname = `${saPath}/login`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const isOnboarding =
    pathname.startsWith("/onboarding") ||
    pathname === "/verify-email" ||
    pathname === "/confirm-email-change";

  const isPublic =
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    isOnboarding;

  const token = request.cookies.get("bidvera_session")?.value;
  const isApp =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/tenders") ||
    pathname.startsWith("/company") ||
    pathname.startsWith("/alerts") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/upgrade");

  const locale = resolveLocale(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bidvera-locale", locale);

  let response: NextResponse;

  if (
    (isApp || isOnboarding) &&
    !token &&
    pathname !== "/verify-email" &&
    pathname !== "/confirm-email-change"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    response = NextResponse.redirect(url);
  } else if (
    !isPublic &&
    !isApp &&
    pathname.startsWith("/api/") &&
    !token &&
    !pathname.startsWith("/api/billing/webhook") &&
    !pathname.startsWith("/api/health") &&
    !pathname.startsWith("/api/internal/") &&
    !pathname.startsWith("/api/share/client-request/")
  ) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  } else {
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const langParam = request.nextUrl.searchParams.get("lang");
  if (isLocale(langParam) || !request.cookies.get(localeCookieName)) {
    response.cookies.set(localeCookieName, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  response.headers.set("x-bidvera-locale", locale);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
