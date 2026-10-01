"use client";

import { signOutAndRedirect } from "@/app/actions";
import { BRAND_MARK_SRC, BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileSearch,
  Inbox,
  LayoutDashboard,
  Link as LinkIcon,
  Lock,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  History,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const SIDEBAR_COLLAPSED_KEY = "bidvera.sidebar.collapsed";
const SIDEBAR_COLLAPSED_EVENT = "bidvera-sidebar-collapsed";

function subscribeSidebarCollapsed(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  };
}

function getSidebarCollapsedSnapshot() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSidebarCollapsedSnapshot() {
  return false;
}

function setSidebarCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
}

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
        href: "/matched-opportunities",
        icon: LinkIcon,
        key: "matchedOpportunities",
        entitlement: "matchingEngine",
        hideWhenDisabled: true,
      },
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

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "relative flex border-b border-transparent",
        collapsed
          ? "flex-col items-center gap-2 px-2 py-3"
          : "items-start justify-between gap-2 px-5 py-4",
      )}
    >
      {collapsed ? (
        <Link
          href="/dashboard"
          className="inline-flex size-9 items-center justify-center rounded-lg outline-offset-4"
          aria-label="Bidvera AI"
        >
          <Image
            src={BRAND_MARK_SRC}
            alt="Bidvera AI"
            width={28}
            height={28}
            unoptimized
            className="size-7 object-contain"
            priority
          />
        </Link>
      ) : (
        <div className="min-w-0">
          <BrandLogo href="/dashboard" height={34} inverseOnDark />
        </div>
      )}
      <div className={cn("flex shrink-0 items-center", collapsed && "mt-0.5")}>
        <ThemeToggle className={collapsed ? undefined : "mt-0.5"} />
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
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot,
  );
  const { nav, shell } = copy;

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsedPreference(!collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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

  const navEl = (compact: boolean) => (
    <nav
      className={cn("flex flex-1 flex-col gap-4 p-3", compact && "px-2")}
      aria-label="Application"
    >
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
              const label = nav[item.key];
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    compact
                      ? "justify-center px-0 py-2.5"
                      : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-primary-muted text-primary"
                      : enabled
                        ? "text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                        : "text-muted/80 hover:bg-foreground/[0.04] hover:text-muted",
                  )}
                  title={
                    compact
                      ? enabled
                        ? label
                        : `${label} — ${shell.upgrade}`
                      : enabled
                        ? undefined
                        : shell.upgrade
                  }
                  aria-label={compact ? label : undefined}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!compact ? (
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  ) : null}
                  {!compact && !enabled ? (
                    <Lock className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                  {compact && !enabled ? (
                    <Lock
                      className="absolute end-1 top-1 size-2.5 opacity-70"
                      aria-hidden
                    />
                  ) : null}
                  {showBadge ? (
                    compact ? (
                      <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-primary" />
                    ) : (
                      <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {unreadAlerts > 99 ? "99+" : unreadAlerts}
                      </span>
                    )
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const footer = (closeMenu?: boolean, compact = false) => (
    <div
      className={cn(
        "mt-auto space-y-2 border-t border-transparent",
        compact ? "p-2" : "p-4",
      )}
    >
      {tenderAnalysisEnabled ? (
        <Link
          href="/tenders/upload"
          onClick={() => closeMenu && setOpen(false)}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-medium text-white hover:bg-primary-hover",
            compact ? "w-full px-0" : "w-full",
          )}
          title={compact ? shell.analyzeTender : undefined}
          aria-label={compact ? shell.analyzeTender : undefined}
        >
          {compact ? (
            <FileSearch className="size-4" aria-hidden />
          ) : (
            shell.analyzeTender
          )}
        </Link>
      ) : showUpgrade ? (
        <Link
          href="/upgrade"
          onClick={() => closeMenu && setOpen(false)}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl border border-border text-sm font-medium text-foreground hover:bg-background",
            compact ? "w-full px-0" : "w-full",
          )}
          title={compact ? shell.upgrade : undefined}
          aria-label={compact ? shell.upgrade : undefined}
        >
          {compact ? (
            <Sparkles className="size-4" aria-hidden />
          ) : (
            shell.upgrade
          )}
        </Link>
      ) : null}
      <form action={signOutAndRedirect}>
        <button
          type="submit"
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-background",
            compact && "px-0",
          )}
          title={compact ? shell.signOut : undefined}
          aria-label={compact ? shell.signOut : undefined}
        >
          <LogOut className="size-4" aria-hidden />
          {!compact ? shell.signOut : null}
        </button>
      </form>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3 lg:hidden">
        <BrandLogo href="/dashboard" height={32} className="min-w-0" inverseOnDark />
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-11 shrink-0 px-0"
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
            className="relative z-10 flex h-dvh max-h-dvh w-[min(18rem,88vw)] flex-col border-r border-border bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <BrandLogo href="/dashboard" height={34} inverseOnDark />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ThemeToggle className="mt-0.5" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-11 shrink-0 px-0"
                  aria-label={shell.closeMenu}
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>
            <div className="scrollbar-pro min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {navEl(false)}
            </div>
            {footer(true, false)}
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          "relative sticky top-0 hidden h-dvh shrink-0 flex-col overflow-visible bg-background transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? shell.expandSidebar : shell.collapseSidebar}
          aria-expanded={!collapsed}
          className={cn(
            "absolute end-0 top-1/2 z-20 flex size-7 -translate-y-1/2 translate-x-1/2 items-center justify-center",
            "rounded-full border border-transparent bg-background/90 text-muted shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm",
            "transition-[color,background-color,box-shadow,transform] duration-150",
            "hover:scale-105 hover:text-foreground hover:shadow-md hover:ring-foreground/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "active:scale-95 rtl:-translate-x-1/2",
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
          ) : (
            <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          )}
        </button>
        <SidebarBrand collapsed={collapsed} />
        <div className="scrollbar-pro flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:auto]">
          {navEl(collapsed)}
        </div>
        {footer(false, collapsed)}
      </aside>
    </>
  );
}
