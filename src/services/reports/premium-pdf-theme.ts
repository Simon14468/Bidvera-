/**
 * Bidvera brand tokens and layout grid for enterprise PDF reports.
 * Presentation only — mirrors app light theme.
 */

export const PDF_BRAND = {
  primary: "#4CAF6D",
  primaryDark: "#3F9A5C",
  primaryMuted: "#E8F6EC",
  ink: "#1A1D1F",
  inkSoft: "#374151",
  muted: "#6B7280",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  soft: "#F9FAFB",
  white: "#FFFFFF",
  success: "#16A34A",
  successSoft: "#ECFDF5",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  tagline: "Verify Before You Bid.",
  productName: "Bidvera",
} as const;

export const PDF_LAYOUT = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 52,
  marginTop: 72,
  marginBottom: 64,
  contentWidth: 595.28 - 52 * 2,
  coverHeroHeight: 312,
  headerHeight: 56,
  footerHeight: 40,
  sectionGap: 20,
  rowGap: 6,
  cardRadius: 8,
  pillRadius: 12,
  get contentBottom() {
    return this.pageHeight - this.marginBottom;
  },
  get footerY() {
    return this.pageHeight - 32;
  },
} as const;

export type PdfStatusTone = "green" | "yellow" | "red" | "neutral";

export function toneForDecision(
  decision: string | null | undefined,
): PdfStatusTone {
  if (decision === "BID") return "green";
  if (decision === "REVIEW") return "yellow";
  if (decision === "NO_BID") return "red";
  return "neutral";
}

export function toneForReadinessStatus(status: string): PdfStatusTone {
  if (status === "READY") return "green";
  if (status === "VERIFY" || status === "UNKNOWN") return "yellow";
  if (status === "MISSING") return "red";
  return "neutral";
}

export function toneForSeverity(severity: string): PdfStatusTone {
  const s = severity.toUpperCase();
  if (s === "HIGH" || s === "CRITICAL") return "red";
  if (s === "MEDIUM") return "yellow";
  return "neutral";
}

export function colorForTone(tone: PdfStatusTone): string {
  switch (tone) {
    case "green":
      return PDF_BRAND.success;
    case "yellow":
      return PDF_BRAND.warning;
    case "red":
      return PDF_BRAND.danger;
    default:
      return PDF_BRAND.muted;
  }
}

export function softFillForTone(tone: PdfStatusTone): string {
  switch (tone) {
    case "green":
      return PDF_BRAND.successSoft;
    case "yellow":
      return PDF_BRAND.warningSoft;
    case "red":
      return PDF_BRAND.dangerSoft;
    default:
      return PDF_BRAND.soft;
  }
}
