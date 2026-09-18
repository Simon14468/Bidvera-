-- Add 3-day billing period for Sponsored Matching pricing.
ALTER TYPE "MatchingSponsorshipPricingBillingPeriod" ADD VALUE IF NOT EXISTS 'THREE_DAYS';
