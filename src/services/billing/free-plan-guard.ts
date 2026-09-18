/** Keep Free Workspace from becoming a paid checkout product. */

export function isFreeWorkspaceSlug(slug: string | null | undefined): boolean {
  return slug === "free";
}

export function applyFreeWorkspaceCheckoutGuard<
  T extends {
    slug?: string;
    isFree?: boolean;
    stripeEnabled?: boolean;
    paypalEnabled?: boolean;
    trialEligible?: boolean;
    monthlyPriceCents?: number;
    annualPriceCents?: number | null;
  },
>(input: T): T {
  const isFree = Boolean(input.isFree) || isFreeWorkspaceSlug(input.slug);
  if (!isFree) return input;
  return {
    ...input,
    isFree: true,
    stripeEnabled: false,
    paypalEnabled: false,
    trialEligible: false,
    monthlyPriceCents: 0,
    annualPriceCents: null,
  };
}

export function parseOptionalQuotaLimit(raw: string | null | undefined): number | null {
  const value = raw?.trim() ?? "";
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}
