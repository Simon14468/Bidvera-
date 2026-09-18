import { resolveSuperAdminPath } from "@/config/super-admin";

export function saHref(path = ""): string {
  const resolved = resolveSuperAdminPath();
  if (!resolved.ok) {
    // Fail closed — never invent a privileged URL when config is missing.
    return "/";
  }
  const base = `/${resolved.path}`;
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SA_NAV = [
  { href: "", label: "Overview" },
  { href: "/companies", label: "Companies" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/payments", label: "Payments" },
  { href: "/plans", label: "Plans" },
  { href: "/features", label: "Features" },
  { href: "/ai-models", label: "AI Models" },
  { href: "/ai-costs", label: "AI Costs" },
  { href: "/settings", label: "Settings" },
  { href: "/backups", label: "Backups" },
  { href: "/load-test", label: "Load test" },
  { href: "/production-readiness", label: "Production readiness" },
  { href: "/audit", label: "Audit" },
] as const;
