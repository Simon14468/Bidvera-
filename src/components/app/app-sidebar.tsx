"use client";

import { signOutAndRedirect } from "@/app/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileSearch,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  History,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type EntitlementFlag =
  | "tenderAnalysis"
  | "documentCompliance"
  | "supplierQualification"
  | "tenderCalendar"
  | "clientRequests"
  | "questionnaireAssistant"
  | "matchingEngine"
  | "decisionMemory"
  | "teamWorkflow"
  | "smartAlerts"
  | "companyProfile";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  key: keyof Dictionary["app"]["nav"];
  /** When set, Lock → /upgrade unless the entitlement is available */
  entitlement?: EntitlementFlag;
  /** When true, omit the item entirely while the gate is closed (no Lock). */
  hideWhenDisabled?: boolean;
};

type NavSection = {
  labelKey: "sectionCapabilities" | "sectionWorkspace" | "sectionAccount";
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    labelKey: "sectionCapabilities",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
      {
        href: "/tenders",
        icon: FileSearch,
        key: "tenders",
        entitlement: "tenderAnalysis",
        /** Plan / commercial gate — omit when not entitled (no Lock tease). */
        hideWhenDisabled: true,
      },
      {
        href: "/document-compliance",
        icon: FileCheck2,
        key: "documentCompliance",
        entitlement: "documentCompliance",
        hideWhenDisabled: true,
      },
      {
        href: "/supplier-qualification",
        icon: ClipboardCheck,
        key: "supplierQualification",
        entitlement: "supplierQualification",
        hideWhenDisabled: true,
      },
      {
        href: "/tender-calendar",
        icon: CalendarDays,
        key: "tenderCalendar",
        entitlement: "tenderCalendar",
        hideWhenDisabled: true,
      },
      {
        href: "/client-requests",
        icon: Inbox,
        key: "clientRequests",
        entitlement: "clientRequests",
        hideWhenDisabled: true,
      },
      {
        href: "/questionnaire-assistant",
        icon: ClipboardList,
        key: "questionnaireAssistant",
        entitlement: "questionnaireAssistant",
        hideWhenDisabled: true,
      },
      {
        href: "/matched-opportunities",
        icon: Sparkles,
        key: "matchedOpportunities",
        entitlement: "matchingEngine",
        hideWhenDisabled: true,
      },
    ],
  },
  {
    labelKey: "sectionWorkspace",
    items: [
      {
        href: "/decision-memory",
        icon: History,
        key: "decisionMemory",
        entitlement: "decisionMemory",
        hideWhenDisabled: true,
      },
      {
        href: "/team-workflow",
        icon: Users,
        key: "teamWorkflow",
        entitlement: "teamWorkflow",
        hideWhenDisabled: true,
      },
    ],
  },
  {
    labelKey: "sectionAccount",
    items: [
      {
        href: "/company",
        icon: Building2,
        key: "company",
        entitlement: "companyProfile",
        hideWhenDisabled: true,
      },
      { href: "/billing", icon: CreditCard, key: "billing" },
      {
        href: "/alerts",
        icon: Bell,
        key: "alerts",
        entitlement: "smartAlerts",
        hideWhenDisabled: true,
      },
      { href: "/settings", icon: Settings, key: "settings" },
    ],
  },
];

function SidebarBrand() {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <BrandLogo href="/dashboard" height={34} inverseOnDark />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle className="mt-0.5" />
      </div>
    </div>
  );
}

export function AppSidebar({
  copy,
  unreadAlerts = 0,
  tenderAnalysisEnabled = false,
  documentComplianceEnabled = false,
  supplierQualificationEnabled = false,
  tenderCalendarEnabled = false,
  clientRequestsEnabled = false,
  questionnaireAssistantEnabled = false,
  matchingEngineEnabled = false,
  decisionMemoryEnabled = false,
  teamWorkflowEnabled = false,
  smartAlertsEnabled = false,
  companyProfileEnabled = false,
  showUpgrade = true,
}: {
  copy: Dictionary["app"];
  unreadAlerts?: number;
  tenderAnalysisEnabled?: boolean;
  documentComplianceEnabled?: boolean;
  supplierQualificationEnabled?: boolean;
  tenderCalendarEnabled?: boolean;
  clientRequestsEnabled?: boolean;
  questionnaireAssistantEnabled?: boolean;
  matchingEngineEnabled?: boolean;
  decisionMemoryEnabled?: boolean;
  teamWorkflowEnabled?: boolean;
  smartAlertsEnabled?: boolean;
  companyProfileEnabled?: boolean;
  /** When false, omit the Upgrade CTA (e.g. no upgrade path on current plan). */
  showUpgrade?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { nav, shell } = copy;

  const entitlementEnabled: Record<EntitlementFlag, boolean> = {
    tenderAnalysis: tenderAnalysisEnabled,
    documentCompliance: documentComplianceEnabled,
    supplierQualification: supplierQualificationEnabled,
    tenderCalendar: tenderCalendarEnabled,
    clientRequests: Boolean(clientRequestsEnabled),
    questionnaireAssistant: Boolean(questionnaireAssistantEnabled),
    matchingEngine: Boolean(matchingEngineEnabled),
    decisionMemory: decisionMemoryEnabled,
    teamWorkflow: teamWorkflowEnabled,
    smartAlerts: smartAlertsEnabled,
    companyProfile: companyProfileEnabled,
  };

  const navEl = (
    <nav className="flex flex-1 flex-col gap-4 p-3" aria-label="Application">
      {navSections.map((section) => {
        const visibleItems = section.items.filter((item) => {
          if (!item.entitlement) return true;
          const enabled = entitlementEnabled[item.entitlement];
          if (item.hideWhenDisabled && !enabled) return false;
          return true;
        });
        if (visibleItems.length === 0) return null;
        return (
          <div key={section.labelKey} className="space-y-1">
            <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {nav[section.labelKey]}
            </p>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const enabled = item.entitlement
                ? entitlementEnabled[item.entitlement]
                : true;
              const href = enabled ? item.href : "/upgrade";
              const active =
                enabled &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`));
              const showBadge =
                item.href === "/alerts" && enabled && unreadAlerts > 0;
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-muted text-primary"
                      : enabled
                        ? "text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                        : "text-muted/80 hover:bg-foreground/[0.04] hover:text-muted",
                  )}
                  title={enabled ? undefined : shell.upgrade}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{nav[item.key]}</span>
                  {!enabled ? (
                    <Lock className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                  {showBadge ? (
                    <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const footer = (closeMenu?: boolean) => (
    <div className="mt-auto space-y-2 border-t border-border p-4">
      {tenderAnalysisEnabled ? (
        <Link
          href="/tenders/upload"
          onClick={() => closeMenu && setOpen(false)}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white hover:bg-primary-hover"
        >
          {shell.analyzeTender}
        </Link>
      ) : showUpgrade ? (
        <Link
          href="/upgrade"
          onClick={() => closeMenu && setOpen(false)}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border text-sm font-medium text-foreground hover:bg-background"
        >
          {shell.upgrade}
        </Link>
      ) : null}
      <form action={signOutAndRedirect}>
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-background"
        >
          <LogOut className="size-4" aria-hidden />
          {shell.signOut}
        </button>
      </form>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3 lg:hidden">
        <BrandLogo href="/dashboard" height={32} className="min-w-0" inverseOnDark />
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={open ? shell.closeMenu : shell.openMenu}
            aria-expanded={open}
            aria-controls="app-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
            aria-label={shell.closeMenu}
            onClick={() => setOpen(false)}
          />
          <aside
            id="app-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={shell.openMenu}
            className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-background"
          >
            <SidebarBrand />
            <div className="scrollbar-pro min-h-0 flex-1 overflow-y-auto">{navEl}</div>
            {footer(true)}
          </aside>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <SidebarBrand />
        <div className="scrollbar-pro flex min-h-0 flex-1 flex-col overflow-y-auto">{navEl}</div>
        {footer()}
      </aside>
    </>
  );
}
