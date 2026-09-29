import {
  COMPANY_COUNTRY_CODES,
  resolveCountryCode,
} from "@/config/countries";
import type { Locale } from "@/i18n/config";
import countries from "i18n-iso-countries";
import arLocale from "i18n-iso-countries/langs/ar.json";
import enLocale from "i18n-iso-countries/langs/en.json";
import esLocale from "i18n-iso-countries/langs/es.json";
import frLocale from "i18n-iso-countries/langs/fr.json";
import zhLocale from "i18n-iso-countries/langs/zh.json";
import { hasFlag } from "country-flag-icons";

countries.registerLocale(enLocale);
countries.registerLocale(esLocale);
countries.registerLocale(zhLocale);
countries.registerLocale(arLocale);
countries.registerLocale(frLocale);

const ISO_LANG: Record<Locale, string> = {
  en: "en",
  es: "es",
  zh: "zh",
  ar: "ar",
  fr: "fr",
};

export type CountryUiCopy = {
  placeholder: string;
  searchPlaceholder: string;
  empty: string;
  required: string;
};

export type CountryOption = {
  value: string;
  label: string;
  alpha3: string;
  /** True when an SVG flag asset exists for this ISO code. */
  hasFlagAsset: boolean;
  /** Extra searchable text: alpha-2, alpha-3, English name */
  searchText: string;
};

const uiByLocale: Record<Locale, CountryUiCopy> = {
  en: {
    placeholder: "Select country / business location",
    searchPlaceholder: "Search country…",
    empty: "No countries found.",
    required: "Select a country / business location.",
  },
  es: {
    placeholder: "Seleccione país / ubicación de negocio",
    searchPlaceholder: "Buscar país…",
    empty: "No se encontraron países.",
    required: "Seleccione un país / ubicación de negocio.",
  },
  zh: {
    placeholder: "选择国家 / 业务所在地",
    searchPlaceholder: "搜索国家…",
    empty: "未找到相关国家。",
    required: "请选择国家 / 业务所在地。",
  },
  ar: {
    placeholder: "اختر البلد / موقع العمل",
    searchPlaceholder: "ابحث عن بلد…",
    empty: "لم يتم العثور على بلدان.",
    required: "يرجى اختيار البلد / موقع العمل.",
  },
  fr: {
    placeholder: "Sélectionnez le pays / localisation d’activité",
    searchPlaceholder: "Rechercher un pays…",
    empty: "Aucun pays trouvé.",
    required: "Sélectionnez un pays / localisation d’activité.",
  },
};

export function getCountryUiCopy(locale: Locale): CountryUiCopy {
  return uiByLocale[locale] ?? uiByLocale.en;
}

function englishName(code: string): string {
  return countries.getName(code, "en") ?? code;
}

export function getCountryDisplayName(code: string, locale: Locale): string {
  const lang = ISO_LANG[locale] ?? "en";
  return countries.getName(code, lang) ?? englishName(code) ?? code;
}

/** Localized country options sorted A→Z by the displayed name (locale-aware). */
export function getCountryOptions(locale: Locale): CountryOption[] {
  const options: CountryOption[] = COMPANY_COUNTRY_CODES.map((code) => {
    const alpha3 = countries.alpha2ToAlpha3(code) ?? "";
    const label = getCountryDisplayName(code, locale);
    const en = englishName(code);
    return {
      value: code,
      label,
      alpha3,
      hasFlagAsset: hasFlag(code),
      searchText: [code, alpha3, en, label].filter(Boolean).join(" "),
    };
  });

  return options.sort((a, b) =>
    a.label.localeCompare(b.label, locale, { sensitivity: "base" }),
  );
}

export function formatCountryLabel(
  stored: string | null | undefined,
  locale: Locale,
): string {
  if (!stored?.trim()) return "";
  const code = resolveCountryCode(stored);
  if (code) return getCountryDisplayName(code, locale);
  return stored.trim();
}
