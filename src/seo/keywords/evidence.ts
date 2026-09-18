/**
 * Demand-evidence ledger for Bidvera keyword intelligence.
 * Volumes are NEVER invented — use UNKNOWN unless measured in Search Console / Ads Planner / Trends API.
 */
export const keywordEvidenceNotes = {
  volumes: "UNKNOWN — no Search Console, Ads Keyword Planner, or Trends API credentials available in this environment.",
  googleTrendsApi: "NOT_CONNECTED",
  searchConsole: "NOT_CONNECTED",
  adsKeywordPlanner: "NOT_CONNECTED",
  webCategoryPresence: [
    {
      topic: "supplier qualification / compliance document tracking",
      evidence: "Multiple active vendor category pages (QualSmart, Process Street, AsterDocs, Supplios, eLeaP) confirm commercial demand language exists.",
      date: "2026-09-15",
    },
    {
      topic: "FR conformité documents fournisseurs / vigilance",
      evidence: "Native FR vendor pages (Aprovall, Kontractis, Fournissio, Clustdoc, Weproc) use terminology such as conformité fournisseur, attestations, dates d’expiration.",
      date: "2026-09-15",
    },
    {
      topic: "ES gestión / calificación de proveedores y caducidad documental",
      evidence: "Native ES vendor pages (Nulogy, Smart Supplier, Walflow, Innova Suppliers, Egixia) confirm category language.",
      date: "2026-09-15",
    },
    {
      topic: "AR تأهيل الموردين / بوابة الموردين / وثائق الامتثال",
      evidence: "Native AR supplier-portal / procurement product pages (Penny, VendorsPortal, EvaluationsHub) confirm terminology.",
      date: "2026-09-15",
    },
    {
      topic: "ZH 供应商资质管理 / 资质到期提醒",
      evidence: "Native ZH SRM/content pages (简道云, 轻流, 供应商管理系统 vendors) confirm 资质到期预警 terminology.",
      date: "2026-09-15",
    },
  ],
  intentionallyNotClaimed: [
    "Matching Engine / public tender marketplace discovery as generally available",
    "Named competitor “vs” pages without verified product-overlap research packages",
    "Numeric search volumes, CPC, or Trends interest scores",
  ],
} as const;
