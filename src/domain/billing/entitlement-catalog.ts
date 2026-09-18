/**
 * Structured entitlement catalog for Bidvera plans.
 * Numeric limits live on Plan.*; boolean capabilities live on Feature / PlanFeature.
 * Marketing featureList is display-only and must never authorize access.
 */

export const ENTITLEMENT_FEATURE_KEYS = [
  "tender_analysis",
  "document_compliance",
  "supplier_qualification",
  "tender_calendar",
  "client_requests",
  "questionnaire_assistant",
  "matching_engine",
  "advanced_decision_engine",
  "decision_memory",
  "smart_alerts",
  "team_collaboration",
  "pdf_export",
  "decision_packs_export",
  "company_profile",
  "decision_simulator",
  "evidence_intelligence",
  "explainable_decision",
  "advanced_ai_trust",
  "tender_action_plan",
  "priority_processing",
  "analytics",
  "proposal_assistance",
  "tender_discovery",
  /** @deprecated alias — prefer smart_alerts */
  "alerts",
] as const;

export type EntitlementFeatureKey = (typeof ENTITLEMENT_FEATURE_KEYS)[number];

export type EntitlementDef = {
  key: EntitlementFeatureKey;
  name: string;
  description: string;
  /** Shown in Super Admin plan editor */
  adminLabel: string;
  /** Marketing bullet when enabled (English canonical) */
  marketingLabel: string;
  /** Core product gate — deny by default when plan mapped */
  enforced: boolean;
  /** Hide deprecated aliases from Admin checkbox list */
  hiddenInAdmin?: boolean;
  /**
   * When false, the capability is not sold or marketed (catalog key may remain
   * for internal/admin use or future shipping). Excluded from plan defaults,
   * plan-editor sellable checkboxes, entitlement grants via PlanFeature, and
   * pricing/upgrade bullets. Defaults to true when omitted.
   */
  commerciallyAvailable?: boolean;
  /**
   * Initial Feature.enabledGlobal on first upsert. Defaults to true.
   * Matching Engine stays OFF until Super Admin enables it.
   */
  defaultEnabledGlobal?: boolean;
};

/** Entitlement keys that must not appear on plans or pricing until shipped. */
export const UNSHIPPED_ENTITLEMENT_KEYS = [
  "decision_packs_export",
  "priority_processing",
  "analytics",
  "proposal_assistance",
  "tender_discovery",
  "matching_engine",
] as const satisfies readonly EntitlementFeatureKey[];

const UNSHIPPED_KEY_SET = new Set<string>(UNSHIPPED_ENTITLEMENT_KEYS);

/** Legacy / hardcoded marketing strings that must never be shown as sold features. */
const UNSHIPPED_MARKETING_LABEL_BLOCKLIST = new Set(
  [
    "priority processing",
    "exportable decision packs",
    "proposal assistance",
    "tender discovery",
    "analytics",
    "matching engine",
    "matched opportunities",
  ].map((s) => s.toLowerCase()),
);

export const ENTITLEMENT_CATALOG: EntitlementDef[] = [
  {
    key: "tender_analysis",
    name: "Tender Analysis",
    description:
      "Internal/admin-only module master switch for Tender Analysis (UDI→Certification). Not sold on user plans or pricing. Super Admin retain Features toggle and enter-company testing; disable globally to hide routes for entitled sessions.",
    adminLabel: "Tender Analysis (module)",
    marketingLabel: "Tender analysis workspace",
    enforced: true,
    /** Hidden from user-facing catalog, plans, pricing, and plan-editor sellable keys. */
    commerciallyAvailable: false,
  },
  {
    key: "document_compliance",
    name: "Document Compliance",
    description:
      "Module master switch for Document Compliance Manager. Disable globally to hide routes, navigation, and actions for all companies. Super Admin retain Features toggle and enter-company testing while OFF.",
    adminLabel: "Document Compliance (module)",
    marketingLabel: "Document compliance manager",
    enforced: true,
  },
  {
    key: "supplier_qualification",
    name: "Supplier Qualification",
    description:
      "Module master switch for Supplier Qualification Profile. Disable globally to hide routes, navigation, and actions for all companies. Super Admin retain Features toggle and enter-company testing while OFF.",
    adminLabel: "Supplier Qualification (module)",
    marketingLabel: "Supplier qualification profile",
    enforced: true,
  },
  {
    key: "tender_calendar",
    name: "Tender Calendar",
    description:
      "Module master switch for Tender Calendar & Notifications. Disable globally to hide routes, navigation, and actions for all companies. Super Admin retain Features toggle and enter-company testing while OFF.",
    adminLabel: "Tender Calendar (module)",
    marketingLabel: "Tender calendar & deadline reminders",
    enforced: true,
  },
  {
    key: "client_requests",
    name: "Client Requests",
    description:
      "Module master switch for Client Requests Portal. Centralize buyer document/information requests, link existing Bidvera evidence, track completion, and share a secure dossier. Super Admin retain Features toggle and enter-company testing while OFF.",
    adminLabel: "Client Requests (module)",
    marketingLabel: "Client requests & document dossiers",
    enforced: true,
  },
  {
    key: "questionnaire_assistant",
    name: "Questionnaire Assistant",
    description:
      "Module master switch for AI Questionnaire Assistant. Detects tender questionnaires, structures questions with provenance, and drafts evidence-backed answers with VERIFY when unsupported. Super Admin retain Features toggle and enter-company testing while OFF.",
    adminLabel: "Questionnaire Assistant (module)",
    marketingLabel: "AI questionnaire assistant",
    enforced: true,
  },
  {
    key: "matching_engine",
    name: "Matching Engine",
    description:
      "Module master switch for Bidvera Matching Engine (matched opportunities). Remains hidden until globally enabled, entitled, and enough eligible companies exist. Super Admin retain Features toggle and enter-company testing while OFF.",
    adminLabel: "Matching Engine (module)",
    marketingLabel: "Matched opportunities",
    enforced: true,
    commerciallyAvailable: false,
    defaultEnabledGlobal: false,
  },
  {
    key: "advanced_decision_engine",
    name: "Decision engine",
    description: "GO / CONDITIONAL GO / NO-BID decision engine outputs.",
    adminLabel: "Decision engine",
    marketingLabel: "Full decision workspace",
    enforced: true,
  },
  {
    key: "decision_memory",
    name: "Decision Memory",
    description: "Access Decision Memory history (reference-only for scoring).",
    adminLabel: "Decision Memory",
    marketingLabel: "Decision Memory",
    enforced: true,
  },
  {
    key: "smart_alerts",
    name: "Smart Alerts",
    description: "Post-analysis and workflow Smart Alerts.",
    adminLabel: "Smart Alerts",
    marketingLabel: "Deadline & Smart Alerts",
    enforced: true,
  },
  {
    key: "alerts",
    name: "Alerts (legacy)",
    description: "Legacy alias for Smart Alerts.",
    adminLabel: "Alerts (legacy)",
    marketingLabel: "Deadline alerts",
    enforced: true,
    hiddenInAdmin: true,
  },
  {
    key: "team_collaboration",
    name: "Team Decision Workflow",
    description: "Team tasks, evidence, verification closed loop.",
    adminLabel: "Team Decision Workflow",
    marketingLabel: "Team Decision Workflow",
    enforced: true,
  },
  {
    key: "pdf_export",
    name: "PDF export",
    description: "Download tender decision PDF reports.",
    adminLabel: "PDF export",
    marketingLabel: "PDF decision reports",
    enforced: true,
  },
  {
    key: "decision_packs_export",
    name: "Exportable decision packs",
    description: "Exportable decision pack downloads.",
    adminLabel: "Exportable decision packs",
    marketingLabel: "Exportable decision packs",
    enforced: true,
    commerciallyAvailable: false,
    hiddenInAdmin: true,
  },
  {
    key: "company_profile",
    name: "Company profile",
    description: "Company knowledge / profile workspace.",
    adminLabel: "Company profile",
    marketingLabel: "Company profile",
    enforced: true,
  },
  {
    key: "decision_simulator",
    name: "Decision Simulator",
    description: "Run what-if decision simulations on canonical tender state.",
    adminLabel: "Decision Simulator",
    marketingLabel: "Decision Simulator",
    enforced: true,
  },
  {
    key: "evidence_intelligence",
    name: "Evidence Intelligence",
    description: "Requirement → evidence → verification traceability views.",
    adminLabel: "Evidence Intelligence",
    marketingLabel: "Evidence Intelligence",
    enforced: true,
  },
  {
    key: "explainable_decision",
    name: "Explainable Decision",
    description: "Detailed decision explanation and traceability output.",
    adminLabel: "Explainable Decision",
    marketingLabel: "Explainable Decision",
    enforced: true,
  },
  {
    key: "advanced_ai_trust",
    name: "Advanced AI Trust & Security",
    description:
      "Advanced trust diagnostics and security insights. Fundamental platform security remains enabled for all plans.",
    adminLabel: "Advanced AI Trust",
    marketingLabel: "Advanced AI Trust & Security",
    enforced: true,
  },
  {
    key: "tender_action_plan",
    name: "Tender Action Plan",
    description: "Traceable next-step action plan from unresolved tender state.",
    adminLabel: "Tender Action Plan",
    marketingLabel: "Tender Action Plan",
    enforced: true,
  },
  {
    key: "priority_processing",
    name: "Priority processing",
    description: "Priority analysis queue hint (product scheduling).",
    adminLabel: "Priority processing",
    marketingLabel: "Priority processing",
    enforced: false,
    commerciallyAvailable: false,
    hiddenInAdmin: true,
  },
  {
    key: "analytics",
    name: "Analytics",
    description: "Workspace analytics surfaces.",
    adminLabel: "Analytics",
    marketingLabel: "Analytics",
    enforced: false,
    commerciallyAvailable: false,
    hiddenInAdmin: true,
  },
  {
    key: "proposal_assistance",
    name: "Proposal assistance",
    description: "Proposal assistance tools (when shipped).",
    adminLabel: "Proposal assistance",
    marketingLabel: "Proposal assistance",
    enforced: false,
    commerciallyAvailable: false,
    hiddenInAdmin: true,
  },
  {
    key: "tender_discovery",
    name: "Tender discovery",
    description: "Tender discovery surfaces (when shipped).",
    adminLabel: "Tender discovery",
    marketingLabel: "Tender discovery",
    enforced: false,
    commerciallyAvailable: false,
    hiddenInAdmin: true,
  },
];

export const ADMIN_ENTITLEMENT_KEYS = ENTITLEMENT_CATALOG.filter(
  (e) => !e.hiddenInAdmin && e.commerciallyAvailable !== false,
).map((e) => e.key);

/**
 * Canonical default entitlements per plan slug (single source of truth).
 * Used by seed scripts and documentation — runtime resolution uses PlanFeature rows.
 */
export const PLAN_ENTITLEMENT_DEFAULTS: Record<string, EntitlementFeatureKey[]> = {
  free: [
    "company_profile",
    "document_compliance",
  ],
  trial: [
    "advanced_decision_engine",
    "company_profile",
  ],
  starter: [
    "document_compliance",
    "supplier_qualification",
    "tender_calendar",
    "client_requests",
    "questionnaire_assistant",
    "advanced_decision_engine",
    "company_profile",
    "smart_alerts",
    "pdf_export",
    "evidence_intelligence",
    "explainable_decision",
  ],
  pro: [
    "document_compliance",
    "supplier_qualification",
    "tender_calendar",
    "client_requests",
    "questionnaire_assistant",
    "advanced_decision_engine",
    "company_profile",
    "smart_alerts",
    "pdf_export",
    "decision_memory",
    "team_collaboration",
    "decision_simulator",
    "evidence_intelligence",
    "explainable_decision",
    "advanced_ai_trust",
    "tender_action_plan",
  ],
  business: [
    "document_compliance",
    "supplier_qualification",
    "tender_calendar",
    "client_requests",
    "questionnaire_assistant",
    "advanced_decision_engine",
    "company_profile",
    "smart_alerts",
    "pdf_export",
    "decision_memory",
    "team_collaboration",
    "decision_simulator",
    "evidence_intelligence",
    "explainable_decision",
    "advanced_ai_trust",
    "tender_action_plan",
  ],
};

export function planDefaultFeatureKeys(slug: string): EntitlementFeatureKey[] {
  return PLAN_ENTITLEMENT_DEFAULTS[slug] ?? PLAN_ENTITLEMENT_DEFAULTS.trial!;
}

/** Build a deny-by-default feature map from enabled keys (mirrors runtime resolution). */
export function buildFeatureMapFromEnabledKeys(
  enabledKeys: readonly string[],
): Record<string, boolean> {
  const features = Object.fromEntries(
    ENTITLEMENT_FEATURE_KEYS.map((k) => [k, false]),
  ) as Record<string, boolean>;
  for (const key of enabledKeys) {
    const canonical = canonicalFeatureKey(key);
    features[canonical] = true;
    features[key] = true;
  }
  return features;
}

/** Pure helper for tests — checks a resolved feature map (no lifecycle). */
export function isFeatureEnabledInMap(
  features: Record<string, boolean>,
  featureKey: string,
): boolean {
  const key = canonicalFeatureKey(featureKey);
  if (features[key]) return true;
  if (featureKey === "alerts" && features.smart_alerts) return true;
  if (key === "smart_alerts" && features.alerts) return true;
  return false;
}

export function upgradeMessageForFeature(featureKey: string): string {
  const def = entitlementDef(canonicalFeatureKey(featureKey) as EntitlementFeatureKey);
  return `${def?.name ?? "This capability"} is not included in your plan. Upgrade to unlock it.`;
}

export function entitlementDef(
  key: string,
): EntitlementDef | undefined {
  return ENTITLEMENT_CATALOG.find((e) => e.key === key);
}

/** Normalize legacy alerts → smart_alerts for checks. */
export function canonicalFeatureKey(key: string): string {
  if (key === "alerts") return "smart_alerts";
  return key;
}

export function isCommerciallyAvailableFeature(key: string): boolean {
  const canonical = canonicalFeatureKey(key);
  if (UNSHIPPED_KEY_SET.has(canonical)) return false;
  const def = entitlementDef(canonical);
  if (!def) return false;
  return def.commerciallyAvailable !== false;
}

/** Strip unshipped marketing claims from any plan/pricing label list. */
export function filterCommerciallyHonestLabels(
  labels: readonly string[],
): string[] {
  return labels.filter((raw) => {
    const line = raw.trim().toLowerCase();
    if (!line) return false;
    if (UNSHIPPED_MARKETING_LABEL_BLOCKLIST.has(line)) return false;
    for (const def of ENTITLEMENT_CATALOG) {
      if (def.commerciallyAvailable === false) {
        if (
          line === def.marketingLabel.toLowerCase() ||
          line === def.name.toLowerCase() ||
          line === def.adminLabel.toLowerCase()
        ) {
          return false;
        }
      }
    }
    return true;
  });
}

export function buildEntitlementMarketingLabels(input: {
  analysesLimit: number;
  seatsLimit: number;
  enabledKeys: string[];
  displayOnlyExtras?: string[];
  /** Billing interval wording for analysis limit bullets */
  interval?: "month" | "year";
}): { labels: string[]; displayOnly: string[] } {
  const interval = input.interval ?? "month";
  const period = interval === "year" ? "year" : "month";
  const labels: string[] = [];
  if (input.analysesLimit > 0) {
    labels.push(`${input.analysesLimit} analyses / ${period}`);
  }
  labels.push(
    input.seatsLimit === 1
      ? "1 seat"
      : `Up to ${input.seatsLimit} seats`,
  );

  const enabled = new Set(
    input.enabledKeys
      .filter((k) => isCommerciallyAvailableFeature(k))
      .map(canonicalFeatureKey),
  );
  for (const def of ENTITLEMENT_CATALOG) {
    if (def.commerciallyAvailable === false) continue;
    if (def.hiddenInAdmin) continue;
    if (def.key === "tender_analysis") continue;
    if (def.key === "document_compliance") continue;
    if (def.key === "supplier_qualification") continue;
    if (def.key === "tender_calendar") continue;
    if (def.key === "client_requests") continue;
    if (def.key === "questionnaire_assistant") continue;
    if (def.key === "matching_engine") continue;
    if (def.key === "advanced_decision_engine" && enabled.has(def.key)) {
      labels.push(def.marketingLabel);
      continue;
    }
    if (enabled.has(canonicalFeatureKey(def.key))) {
      labels.push(def.marketingLabel);
    }
  }

  const displayOnly = filterCommerciallyHonestLabels(
    (input.displayOnlyExtras ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !labels.includes(s)),
  );

  return { labels, displayOnly };
}

/** English canonical bullets from Plan Editor entitlements + limits. */
export function planEditorCanonicalFeatures(input: {
  analysesLimit: number;
  analysesLimitYearly: number | null;
  seatsLimit: number;
  seatsLimitYearly: number | null;
  featureKeys: string[];
  featureList: string[];
  preferEntitlementLabels: boolean;
  interval: "month" | "year";
}): string[] {
  const analyses =
    input.interval === "year" && input.analysesLimitYearly != null
      ? input.analysesLimitYearly
      : input.analysesLimit;
  const seats =
    input.interval === "year" && input.seatsLimitYearly != null
      ? input.seatsLimitYearly
      : input.seatsLimit;

  if (!input.preferEntitlementLabels) {
    const fallback =
      input.featureList.length > 0
        ? filterCommerciallyHonestLabels(input.featureList)
        : buildEntitlementMarketingLabels({
            analysesLimit: analyses,
            seatsLimit: seats,
            enabledKeys: input.featureKeys,
            interval: input.interval,
          }).labels;
    return fallback;
  }

  const { labels, displayOnly } = buildEntitlementMarketingLabels({
    analysesLimit: analyses,
    seatsLimit: seats,
    enabledKeys: input.featureKeys,
    displayOnlyExtras: input.featureList,
    interval: input.interval,
  });
  return [...labels, ...displayOnly];
}
