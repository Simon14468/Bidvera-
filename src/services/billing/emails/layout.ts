/**
 * Email-safe Bidvera billing layout (tables + inline CSS).
 * Not image-based. Logo is hosted at NEXT_PUBLIC_APP_URL/brand-logo.png.
 */

import { escapeHtml } from "@/lib/html";
import { billingAbsoluteUrl, billingAppOrigin } from "@/services/billing/billing-app-url";

export const BILLING_EMAIL_BRAND = {
  green: "#4CAF6D",
  greenDark: "#3F9A5C",
  greenSoft: "#E8F6EC",
  ink: "#1A1D1F",
  inkSoft: "#374151",
  muted: "#6B7280",
  border: "#E5E7EB",
  canvas: "#F5F6F7",
  card: "#F9FAFB",
  white: "#FFFFFF",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  success: "#16A34A",
  successSoft: "#ECFDF5",
} as const;

export type BillingEmailEnv = Record<string, string | undefined>;

export type BillingEmailDetail = { label: string; value: string };

export type BillingEmailBannerTone = "success" | "warning" | "info" | "neutral";

export type BillingEmailContent = {
  preheader?: string;
  eyebrow?: string;
  headline: string;
  intro: string[];
  banner?: { tone: BillingEmailBannerTone; text: string };
  details?: BillingEmailDetail[];
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
};

function assertAbsoluteHref(href: string): string {
  const trimmed = href.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Billing email links must be absolute.");
  }
  return trimmed;
}

export function esc(value: string | null | undefined, fallback = "—"): string {
  const raw = value?.trim();
  return escapeHtml(raw && raw.length > 0 ? raw : fallback);
}

export function firstNameFrom(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
}

export function formatEmailDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

export function formatEmailAmount(
  cents: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const code = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${escapeHtml(code)}`;
  }
}

export function formatIntervalLabel(interval: string | null | undefined): string {
  if (interval === "YEAR") return "Yearly";
  if (interval === "MONTH") return "Monthly";
  return "—";
}

/** Brand + last 4 only. Rejects anything that looks like a full PAN. */
export function safePaymentMethodLabel(
  brand?: string | null,
  last4?: string | null,
): string | null {
  const digits = last4?.replace(/\D/g, "") ?? "";
  if (digits.length !== 4) return brand?.trim() ? brand.trim() : null;
  const label = brand?.trim() ? `${brand.trim()} ···· ${digits}` : `···· ${digits}`;
  return label;
}

/** Never render PANs, provider tokens, or secret-looking payment strings. */
export function sanitizePaymentMethodDisplay(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) return "—";
  if (/^(sk_|pk_|rk_|tok_|pi_|pm_|cus_|sub_|whsec_)/i.test(raw)) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12) return "—";
  if (/\b(?:\d[ -]*){12,19}\b/.test(raw)) return "—";
  return raw;
}

function bannerColors(tone: BillingEmailBannerTone): { bg: string; fg: string } {
  if (tone === "success") return { bg: BILLING_EMAIL_BRAND.successSoft, fg: BILLING_EMAIL_BRAND.success };
  if (tone === "warning") return { bg: BILLING_EMAIL_BRAND.warningSoft, fg: BILLING_EMAIL_BRAND.warning };
  if (tone === "info") return { bg: BILLING_EMAIL_BRAND.greenSoft, fg: BILLING_EMAIL_BRAND.greenDark };
  return { bg: BILLING_EMAIL_BRAND.card, fg: BILLING_EMAIL_BRAND.inkSoft };
}

function detailsTable(details: BillingEmailDetail[]): string {
  const rows = details
    .map(
      (row) => `<tr>
        <td style="padding:8px 0;font-size:13px;color:${BILLING_EMAIL_BRAND.muted};width:40%;">${esc(row.label)}</td>
        <td style="padding:8px 0;font-size:14px;color:${BILLING_EMAIL_BRAND.ink};font-weight:600;">${esc(row.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BILLING_EMAIL_BRAND.card};border:1px solid ${BILLING_EMAIL_BRAND.border};border-radius:12px;">
    <tr><td style="padding:16px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
    </td></tr>
  </table>`;
}

export function renderBillingEmailHtml(
  content: BillingEmailContent,
  env: BillingEmailEnv = process.env,
): string {
  const origin = billingAppOrigin(env);
  const logoSrc = billingAbsoluteUrl("/brand-logo.png", env);
  const homeUrl = assertAbsoluteHref(origin);
  const billingUrl = assertAbsoluteHref(billingAbsoluteUrl("/billing", env));
  const faqUrl = assertAbsoluteHref(billingAbsoluteUrl("/faq", env));
  const privacyUrl = assertAbsoluteHref(billingAbsoluteUrl("/privacy-policy", env));
  const ctaHref = assertAbsoluteHref(content.cta.href);
  const secondaryHref = content.secondary
    ? assertAbsoluteHref(content.secondary.href)
    : null;
  const year = String(new Date().getUTCFullYear());
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(content.preheader)}</div>`
    : "";
  const banner = content.banner
    ? (() => {
        const colors = bannerColors(content.banner.tone);
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${colors.bg};border-radius:10px;margin:0 0 20px 0;">
          <tr><td style="padding:12px 16px;font-size:14px;font-weight:600;color:${colors.fg};">${esc(content.banner.text)}</td></tr>
        </table>`;
      })()
    : "";
  const intro = content.intro
    .filter((p) => p.trim().length > 0)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:${BILLING_EMAIL_BRAND.inkSoft};">${esc(p)}</p>`,
    )
    .join("");
  const details = content.details?.length ? `${detailsTable(content.details)}<div style="height:24px;line-height:24px;">&nbsp;</div>` : "";
  const secondary = secondaryHref
    ? `<p style="margin:16px 0 0 0;font-size:14px;"><a href="${escapeHtml(secondaryHref)}" style="color:${BILLING_EMAIL_BRAND.greenDark};text-decoration:underline;">${esc(content.secondary?.label)}</a></p>`
    : "";
  const eyebrow = content.eyebrow
    ? `<p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BILLING_EMAIL_BRAND.muted};font-weight:600;">${esc(content.eyebrow)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Bidvera</title>
</head>
<body style="margin:0;padding:0;background:${BILLING_EMAIL_BRAND.canvas};">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BILLING_EMAIL_BRAND.canvas};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:${BILLING_EMAIL_BRAND.white};border:1px solid ${BILLING_EMAIL_BRAND.border};border-radius:16px;">
          <tr>
            <td style="padding:28px 32px 16px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <a href="${escapeHtml(homeUrl)}" style="text-decoration:none;">
                      <img src="${escapeHtml(logoSrc)}" alt="Bidvera" width="168" height="40" style="display:block;border:0;width:168px;height:auto;" />
                    </a>
                  </td>
                  <td align="right" style="font-size:13px;">
                    <a href="${escapeHtml(billingUrl)}" style="color:${BILLING_EMAIL_BRAND.muted};text-decoration:none;">Manage account</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px 32px;">
              ${eyebrow}
              <h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.3;color:${BILLING_EMAIL_BRAND.ink};font-weight:700;">${esc(content.headline)}</h1>
              ${banner}
              ${intro}
              ${details}
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td bgcolor="${BILLING_EMAIL_BRAND.green}" style="border-radius:10px;">
                    <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:${BILLING_EMAIL_BRAND.white};text-decoration:none;">${esc(content.cta.label)}</a>
                  </td>
                </tr>
              </table>
              ${secondary}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid ${BILLING_EMAIL_BRAND.border};background:${BILLING_EMAIL_BRAND.card};border-radius:0 0 16px 16px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:${BILLING_EMAIL_BRAND.ink};font-weight:600;">Bidvera</p>
              <p style="margin:0 0 10px 0;font-size:12px;color:${BILLING_EMAIL_BRAND.muted};">© ${escapeHtml(year)} Bidvera. All rights reserved.</p>
              <p style="margin:0;font-size:12px;line-height:1.7;">
                <a href="${escapeHtml(faqUrl)}" style="color:${BILLING_EMAIL_BRAND.muted};text-decoration:none;">Help Center</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(faqUrl)}" style="color:${BILLING_EMAIL_BRAND.muted};text-decoration:none;">Contact</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(privacyUrl)}" style="color:${BILLING_EMAIL_BRAND.muted};text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderBillingEmailText(content: BillingEmailContent): string {
  const lines = [
    content.headline,
    "",
    ...content.intro,
    "",
    ...(content.details ?? []).map((row) => `${row.label}: ${row.value || "—"}`),
    "",
    `${content.cta.label}: ${content.cta.href}`,
  ];
  if (content.secondary) {
    lines.push(`${content.secondary.label}: ${content.secondary.href}`);
  }
  return lines.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n");
}

export function renderBillingEmail(
  content: BillingEmailContent,
  env: BillingEmailEnv = process.env,
): { html: string; text: string } {
  return {
    html: renderBillingEmailHtml(content, env),
    text: renderBillingEmailText(content),
  };
}
