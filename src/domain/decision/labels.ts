/**
 * Canonical product decision labels.
 * Storage remains Prisma DecisionType (BID | REVIEW | NO_BID).
 * User-facing recommendation is always exactly one of these three.
 */

import type { DecisionType } from "@prisma/client";

export type TenderDecisionLabel = "GO" | "CONDITIONAL GO" | "NO-BID";

export function toTenderDecisionLabel(
  decision: DecisionType,
): TenderDecisionLabel {
  switch (decision) {
    case "BID":
      return "GO";
    case "REVIEW":
      return "CONDITIONAL GO";
    case "NO_BID":
      return "NO-BID";
  }
}

export function fromTenderDecisionLabel(
  label: TenderDecisionLabel,
): DecisionType {
  switch (label) {
    case "GO":
      return "BID";
    case "CONDITIONAL GO":
      return "REVIEW";
    case "NO-BID":
      return "NO_BID";
  }
}

/** Localized display — product language is GO / CONDITIONAL GO / NO-BID. */
export function localizeTenderDecisionLabel(
  decision: DecisionType,
  locale: string = "en",
): string {
  const label = toTenderDecisionLabel(decision);
  if (locale === "ar") {
    switch (label) {
      case "GO":
        return "انطلاق";
      case "CONDITIONAL GO":
        return "انطلاق مشروط";
      case "NO-BID":
        return "عدم التقديم";
    }
  }
  if (locale === "es") {
    switch (label) {
      case "GO":
        return "GO";
      case "CONDITIONAL GO":
        return "GO CONDICIONAL";
      case "NO-BID":
        return "NO OFERTAR";
    }
  }
  if (locale === "fr") {
    switch (label) {
      case "GO":
        return "GO";
      case "CONDITIONAL GO":
        return "GO CONDITIONNEL";
      case "NO-BID":
        return "NE PAS SOUMETTRE";
    }
  }
  if (locale === "zh") {
    switch (label) {
      case "GO":
        return "推进";
      case "CONDITIONAL GO":
        return "有条件推进";
      case "NO-BID":
        return "不投标";
    }
  }
  return label;
}
