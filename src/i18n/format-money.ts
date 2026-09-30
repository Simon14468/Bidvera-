import type { Locale } from "@/i18n/config";

/**
 * Format plan price for public UI.
 * When `currencyLabel` is set (Plan Languages editor), admin controls the unit
 * text — e.g. "$" → `$13`, "دولار" → `13 دولار`. Never auto-locale "US$".
 */
export function formatPlanMoney(
  cents: number,
  currency: string,
  localeOrLabel: Locale | string | null | undefined = "en",
  currencyLabel?: string | null,
): string {
  const amount = Math.max(cents, 0) / 100;
  const whole =
    amount % 1 === 0 ? String(Math.round(amount)) : amount.toFixed(2);

  // Back-compat: callers may pass (cents, currency, locale) or
  // (cents, currency, locale, currencyLabel). If 3rd arg looks like a label
  // when 4th is undefined and it's not a known locale, treat as label.
  const knownLocales = new Set(["en", "es", "zh", "ar", "fr"]);
  let label = currencyLabel?.trim() || "";
  let locale: Locale = "en";
  if (typeof localeOrLabel === "string") {
    if (knownLocales.has(localeOrLabel)) {
      locale = localeOrLabel as Locale;
    } else if (!label && localeOrLabel.trim()) {
      label = localeOrLabel.trim();
    }
  }

  if (label) {
    // Symbol-like ($ € £ …) → prefix; word-like (دولار / 美元) → suffix.
    if (isCurrencySymbolLabel(label)) {
      return `${label}${whole}`;
    }
    return `${whole} ${label}`;
  }

  void locale; // English / unset: canonical Latin symbol for common codes.
  const code = (currency || "usd").toUpperCase();
  if (code === "USD") return `$${whole}`;
  if (code === "EUR") return `€${whole}`;
  if (code === "GBP") return `£${whole}`;
  return `${whole} ${code}`;
}

function isCurrencySymbolLabel(label: string): boolean {
  if (label.length <= 2 && !/[\u0600-\u06FF\u4e00-\u9fff]/.test(label)) {
    return true;
  }
  return /^[\p{Sc}$€£¥₹]+$/u.test(label);
}
