/**
 * Stripe providerCustomerId → company resolution must be unambiguous.
 * Never use findFirst when multiple tenants could share/collide on the same customer id.
 */

export function resolveUniqueCompanyIdFromCustomerMatches(
  matches: Array<{ companyId: string }>,
): string | null {
  const unique = [
    ...new Set(matches.map((m) => m.companyId).filter(Boolean)),
  ];
  if (unique.length !== 1) return null;
  return unique[0]!;
}
