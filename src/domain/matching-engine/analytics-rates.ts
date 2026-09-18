/**
 * Analytics rate helpers (Feature 8E) — pure, no DB.
 */

export type MatchingAnalyticsBucket = {
  impressions: number;
  views: number;
  clicks: number;
  interest: number;
  dismissals: number;
};

export type MatchingAnalyticsRates = {
  /** views / impressions */
  viewRate: number | null;
  /** clicks / impressions (impression-based CTR) */
  clickRate: number | null;
  /** interest / impressions */
  interestRate: number | null;
  /** dismissals / impressions */
  dismissalRate: number | null;
  /** (views + clicks + interest) / impressions */
  engagementRate: number | null;
  /** clicks / views when views > 0 */
  clickThroughViewRate: number | null;
};

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 10000) / 10000;
}

export function computeMatchingRates(
  bucket: MatchingAnalyticsBucket,
): MatchingAnalyticsRates {
  const engaged = bucket.views + bucket.clicks + bucket.interest;
  return {
    viewRate: rate(bucket.views, bucket.impressions),
    clickRate: rate(bucket.clicks, bucket.impressions),
    interestRate: rate(bucket.interest, bucket.impressions),
    dismissalRate: rate(bucket.dismissals, bucket.impressions),
    engagementRate: rate(engaged, bucket.impressions),
    clickThroughViewRate: rate(bucket.clicks, bucket.views),
  };
}

/** UTC midnight for daily rollup keys. */
export function utcDayStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
