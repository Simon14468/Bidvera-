import { applySessionCookie } from "@/auth/session";
import { consumeSaEnterClaim } from "@/auth/sa-enter-claim";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Consumes a one-time SA enter claim and sets the company session cookie.
 * Safe as GET: minting requires authenticated Super Admin POST; ticket is
 * HMAC-signed, single-use, expires in ~90s, and never embeds the session bearer.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const ticket = new URL(request.url).searchParams.get("t")?.trim() ?? "";
  const sessionToken = ticket ? await consumeSaEnterClaim(ticket) : null;

  if (!sessionToken) {
    return new NextResponse(
      `<!doctype html><html><body style="font-family:system-ui;background:#020617;color:#e2e8f0;padding:2rem">
        <h1 style="font-size:1.25rem">Enter link expired</h1>
        <p>This enter ticket is invalid, already used, or expired. Close this tab and use Enter account again from Super Admin.</p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const response = NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
  applySessionCookie(response, sessionToken);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
