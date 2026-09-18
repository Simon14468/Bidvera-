/**
 * Semantic normalization for company capabilities.
 * Preserves original_value; stores normalized_value separately.
 * Never merges unrelated concepts.
 */

export type CapabilityGroup = {
  normalized: string;
  aliases: string[];
};

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    normalized: "Web Application Development",
    aliases: [
      "web application development",
      "web development",
      "web apps",
      "web app",
      "web-based",
      "web based",
      "web portal",
      "web platforms",
      "web platform",
      "business portals",
      "citizen-facing web",
      "developpement web",
      "développement web",
      "applications web",
      "application web",
      "portail web",
    ],
  },
  {
    normalized: "Mobile Application Development",
    aliases: [
      "mobile application development",
      "mobile apps",
      "mobile app",
      "mobile application",
      "react native",
      "cross-platform",
      "applications mobiles",
      "application mobile",
    ],
  },
  {
    normalized: "Cloud Solutions",
    aliases: [
      "cloud solutions",
      "cloud deployment",
      "cloud-enabled",
      "cloud enabled",
      "managed application environments",
      "containerized workloads",
      "solutions cloud",
      "deploiement cloud",
      "déploiement cloud",
    ],
  },
  {
    normalized: "API Integration",
    aliases: [
      "api / system integration",
      "api/system integration",
      "api integration",
      "system integration",
      "rest api",
      "rest apis",
      "third-party integrations",
      "service orchestration",
      "integration api",
      "intégration api",
      "integration systeme",
      "intégration système",
    ],
  },
  {
    normalized: "UI/UX Design",
    aliases: ["ui/ux design", "ui/ux", "user journeys", "wireframes", "design systems", "usability"],
  },
  {
    normalized: "Database Development",
    aliases: [
      "database development",
      "relational schema",
      "postgresql",
      "mysql",
      "data platforms",
      "database-backed",
      "bases de donnees",
      "bases de données",
    ],
  },
  {
    normalized: "Technical Support",
    aliases: [
      "technical support",
      "application support",
      "incident triage",
      "user-facing technical troubleshooting",
      "support technique",
      "support applicatif",
    ],
  },
  {
    normalized: "Application Maintenance",
    aliases: [
      "application maintenance",
      "bug fixes",
      "dependency updates",
      "release management",
      "maintenance",
      "maintenance applicative",
      "maintenance des logiciels",
      "tma",
    ],
  },
];

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCapability(original: string): string {
  const key = normalizeKey(original);
  for (const group of CAPABILITY_GROUPS) {
    if (normalizeKey(group.normalized) === key) return group.normalized;
    for (const alias of group.aliases) {
      if (key === normalizeKey(alias) || key.includes(normalizeKey(alias))) {
        return group.normalized;
      }
    }
  }
  // Title-case fallback — do not force into an unrelated group
  return original
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bUi\/Ux\b/i, "UI/UX");
}

/** True when tender text semantically relates to a normalized company capability. */
export function capabilityMatchesText(normalizedCapability: string, tenderText: string): boolean {
  const corpus = normalizeKey(tenderText);
  const group = CAPABILITY_GROUPS.find((g) => g.normalized === normalizedCapability);
  if (!group) {
    return corpus.includes(normalizeKey(normalizedCapability));
  }
  if (corpus.includes(normalizeKey(group.normalized))) return true;
  return group.aliases.some((a) => {
    const na = normalizeKey(a);
    return na.length >= 4 && corpus.includes(na);
  });
}

export function collectNormalizedCapabilities(
  originals: string[],
): { originalValue: string; normalizedValue: string }[] {
  const seen = new Set<string>();
  const out: { originalValue: string; normalizedValue: string }[] = [];
  for (const original of originals) {
    const normalizedValue = normalizeCapability(original);
    const dedupe = normalizeKey(normalizedValue);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ originalValue: original, normalizedValue });
  }
  return out;
}
