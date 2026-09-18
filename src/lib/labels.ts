import type { DecisionType, RiskLevel, RequirementStatus } from "@/domain/types";
import type { Locale } from "@/i18n/config";
import { localizeTenderDecisionLabel } from "@/domain/decision/labels";

/** @deprecated Prefer localizeTenderDecisionLabel — kept for call-site compatibility */
export const decisionLabels: Record<DecisionType, string> = {
  BID: "GO",
  REVIEW: "CONDITIONAL GO",
  NO_BID: "NO-BID",
};

export const decisionLabelsAr: Record<DecisionType, string> = {
  BID: "انطلاق",
  REVIEW: "انطلاق مشروط",
  NO_BID: "عدم التقديم",
};

export function getDecisionLabel(
  decision: DecisionType,
  locale: Locale = "en",
): string {
  return localizeTenderDecisionLabel(decision, locale);
}

export function getPendingDecisionLabel(locale: Locale = "en"): string {
  return locale === "ar" ? "قيد الانتظار" : "Pending";
}

export const riskLabels: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const requirementLabels: Record<RequirementStatus, string> = {
  MATCHED: "Matched",
  FAILED: "Failed",
  UNCERTAIN: "Uncertain",
  MISSING: "Missing",
};

export const readinessLabels: Record<
  "READY" | "MISSING" | "VERIFY" | "NOT_APPLICABLE" | "UNKNOWN",
  string
> = {
  READY: "Ready",
  MISSING: "Missing",
  VERIFY: "Verify",
  NOT_APPLICABLE: "Not applicable",
  UNKNOWN: "Unknown",
};

export function readinessBadgeClass(
  status: "READY" | "MISSING" | "VERIFY" | "NOT_APPLICABLE" | "UNKNOWN",
): string {
  switch (status) {
    case "READY":
      return "bg-success/10 text-success border-success/20";
    case "MISSING":
      return "bg-danger/10 text-danger border-danger/20";
    case "VERIFY":
      return "bg-warning/10 text-warning border-warning/25";
    case "NOT_APPLICABLE":
      return "bg-muted/40 text-muted border-border";
    case "UNKNOWN":
      return "bg-muted/40 text-muted border-border";
  }
}

export function decisionBadgeClass(decision: DecisionType): string {
  switch (decision) {
    case "BID":
      return "bg-success/10 text-success border-success/20";
    case "REVIEW":
      return "bg-warning/10 text-warning border-warning/25";
    case "NO_BID":
      return "bg-danger/10 text-danger border-danger/20";
  }
}

export function riskBadgeClass(risk: RiskLevel): string {
  switch (risk) {
    case "LOW":
      return "bg-success/10 text-success border-success/20";
    case "MEDIUM":
      return "bg-warning/10 text-warning border-warning/25";
    case "HIGH":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "CRITICAL":
      return "bg-danger/10 text-danger border-danger/20";
  }
}

export function requirementBadgeClass(status: RequirementStatus): string {
  switch (status) {
    case "MATCHED":
      return "bg-success/10 text-success border-success/20";
    case "FAILED":
      return "bg-danger/10 text-danger border-danger/20";
    case "UNCERTAIN":
      return "bg-warning/10 text-warning border-warning/25";
    case "MISSING":
      return "bg-muted/40 text-muted border-border";
  }
}

export const sourceBasisLabels: Record<
  "DIRECT_SOURCE" | "AI_INTERPRETATION" | "COMPANY_INFORMATION" | "UNKNOWN",
  string
> = {
  DIRECT_SOURCE: "Direct source",
  AI_INTERPRETATION: "AI interpretation",
  COMPANY_INFORMATION: "Company information",
  UNKNOWN: "Unknown",
};

export function sourceBasisBadgeClass(
  basis: "DIRECT_SOURCE" | "AI_INTERPRETATION" | "COMPANY_INFORMATION" | "UNKNOWN",
): string {
  switch (basis) {
    case "DIRECT_SOURCE":
      return "bg-success/10 text-success border-success/20";
    case "AI_INTERPRETATION":
      return "bg-warning/10 text-warning border-warning/25";
    case "COMPANY_INFORMATION":
      return "bg-primary/10 text-primary border-primary/20";
    case "UNKNOWN":
      return "bg-muted/40 text-muted border-border";
  }
}
