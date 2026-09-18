export const siteConfig = {
  name: "Bidvera",
  tagline: "Know What to Pursue. Know What You’re Ready For.",
  description:
    "Bidvera helps companies understand readiness, manage compliance and qualifications, organize evidence, discover relevant opportunities and make explainable decisions.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  trialAnalyses: 3,
} as const;

export const appNav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tenders", href: "/tenders" },
  { label: "Decision Memory", href: "/decision-memory" },
  { label: "Company Profile", href: "/company" },
  { label: "Billing", href: "/billing" },
  { label: "Alerts", href: "/alerts" },
  { label: "Settings", href: "/settings" },
] as const;

export const marketingNav = [
  { label: "Product", href: "/product" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/resources" },
  { label: "FAQ", href: "/faq" },
] as const;
