import { adminEnterCompanyAccount } from "@/application/admin/company-credentials";
import {
  mintSaEnterClaim,
  SA_ENTER_CLAIM_PATH,
} from "@/auth/sa-enter-claim";
import { applySessionCookie } from "@/auth/session";
import {
  requestIpHash,
  requireWritableSuperAdmin,
  resolveSuperAdminContext,
} from "@/auth/super-admin-session";
import { getSuperAdminPath } from "@/config/super-admin";
import { hashIdentifier } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export const dynamic = "force-dynamic";

function enterFailureHtml(message: string, status: number) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;background:#020617;color:#e2e8f0;padding:2rem">
        <h1 style="font-size:1.25rem">Enter company account failed</h1>
        <p>${message.replace(/</g, "&lt;")}</p>
        <p style="color:#94a3b8;font-size:0.875rem">Close this tab and try again from Super Admin → Companies.</p>
      </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function wantsClaimJson(request: Request): boolean {
  const mode = request.headers.get("x-bidvera-enter-mode")?.toLowerCase();
  if (mode === "claim") return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

/** GET must not mint sessions (CSRF-safe). New tabs POST via about:blank form. */
export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

/**
 * Super Admin → enter company workspace.
 * - Form / about:blank POST: 303 → /dashboard with session cookie.
 * - Optional JSON claim mode for programmatic clients.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ saKey: string; companyId: string }> },
) {
  const { companyId, saKey } = await context.params;
  const origin = new URL(request.url).origin;

  try {
    const existing = await resolveSuperAdminContext();
    if (!existing) {
      if (wantsClaimJson(request)) {
        return NextResponse.json(
          { ok: false, error: "Super Admin session required." },
          { status: 401 },
        );
      }
      return NextResponse.redirect(
        `${origin}/${saKey || getSuperAdminPath()}/login`,
        { status: 303 },
      );
    }

    const ctx = await requireWritableSuperAdmin();
    const hdrs = await headers();
    const { sessionToken } = await adminEnterCompanyAccount({
      ctx,
      companyId,
      ipHash: await requestIpHash(),
      userAgentHash: hashIdentifier(hdrs.get("user-agent")),
    });

    if (wantsClaimJson(request)) {
      const ticket = await mintSaEnterClaim(sessionToken);
      const claimUrl = `${origin}${SA_ENTER_CLAIM_PATH}?t=${encodeURIComponent(ticket)}`;
      return NextResponse.json(
        { ok: true, claimUrl },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Cookie must be on this Response — cookies() alone is unreliable across redirects.
    const response = NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
    applySessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message =
      error instanceof AppError ? error.message : "Unable to enter company account.";
    const status = error instanceof AppError ? error.status : 500;
    if (wantsClaimJson(request)) {
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    return enterFailureHtml(message, status);
  }
}
