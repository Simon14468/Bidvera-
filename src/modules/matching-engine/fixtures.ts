/**
 * Matching Engine test-fixture detection for activation / corpus metrics.
 * Fixtures must never count toward production eligible-company threshold.
 *
 * Patterns (name OR slug):
 * - name: ME8C–ME8G exact or prefix (e.g. "ME8D expire")
 * - slug: me8c-… / me8d-… (suite prefixes) and me8-c-… form if present
 *
 * Does not delete or modify fixture rows — filter-only.
 */

export const MATCHING_TEST_FIXTURE_LETTERS = ["C", "D", "E", "F", "G"] as const;

/** Slug prefixes used by Matching Engine test suites (me8d-, me8c-, …). */
export const MATCHING_TEST_FIXTURE_SLUG_PREFIXES =
  MATCHING_TEST_FIXTURE_LETTERS.map((L) => `me8${L.toLowerCase()}-`);

export type MatchingFixtureIdentity = {
  name?: string | null;
  slug?: string | null;
};

/**
 * True when the company is a Matching Engine test tenant (ME8C–ME8G).
 * Central helper — use everywhere activation/eligible counts are computed.
 */
export function isMatchingTestFixtureCompany(
  input: MatchingFixtureIdentity,
): boolean {
  const name = (input.name ?? "").trim();
  const slug = (input.slug ?? "").trim().toLowerCase();

  // Exact ME8C–ME8G or name starting with that token (e.g. "ME8D expire").
  if (/^ME8[C-G](\b|\s|$)/i.test(name)) return true;

  // Suite slug prefixes: me8c-, me8d-, …
  if (MATCHING_TEST_FIXTURE_SLUG_PREFIXES.some((p) => slug.startsWith(p))) {
    return true;
  }

  // Alternate form from requirements: me8-c-, me8-d-, …
  if (/^me8-[c-g]-/i.test(slug)) return true;

  return false;
}

/**
 * Prisma filter: CompanyMatchingProfile rows whose company is NOT a ME8 fixture.
 * Used by eligible-company activation counts.
 */
export function matchingNonFixtureCompanyFilter(): {
  NOT: {
    OR: Array<
      | { name: { startsWith: string; mode: "insensitive" } }
      | { slug: { startsWith: string; mode: "insensitive" } }
    >;
  };
} {
  const nameNots = MATCHING_TEST_FIXTURE_LETTERS.map((L) => ({
    name: { startsWith: `ME8${L}`, mode: "insensitive" as const },
  }));
  const slugNots = [
    ...MATCHING_TEST_FIXTURE_SLUG_PREFIXES.map((p) => ({
      slug: { startsWith: p, mode: "insensitive" as const },
    })),
    ...MATCHING_TEST_FIXTURE_LETTERS.map((L) => ({
      slug: {
        startsWith: `me8-${L.toLowerCase()}-`,
        mode: "insensitive" as const,
      },
    })),
  ];
  return { NOT: { OR: [...nameNots, ...slugNots] } };
}
