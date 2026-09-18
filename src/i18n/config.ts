export const locales = ["en", "es", "zh", "ar", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeCookieName = "bidvera_locale";

export const localeLabels: Record<
  Locale,
  { native: string; english: string; short: string }
> = {
  en: { native: "English", english: "English", short: "EN" },
  es: { native: "Español", english: "Spanish", short: "ES" },
  zh: { native: "中文", english: "Chinese", short: "中文" },
  ar: { native: "العربية", english: "Arabic", short: "ع" },
  fr: { native: "Français", english: "French", short: "FR" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
