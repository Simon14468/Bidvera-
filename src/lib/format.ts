import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  isPast,
} from "date-fns";
import type { Locale } from "@/i18n/config";

function toDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

function intlLocale(locale: Locale): string {
  switch (locale) {
    case "zh":
      return "zh-CN";
    case "ar":
      return "ar";
    default:
      return locale;
  }
}

/** Keep Western digits; localize month/weekday text via locale. */
function dateFormatOptions(
  locale: Locale,
  withTime: boolean,
): Intl.DateTimeFormatOptions {
  const base: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
  };
  if (withTime) {
    return {
      ...base,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
  }
  return base;
}

export function formatDate(
  date: Date | string | null | undefined,
  locale: Locale = "en",
): string {
  if (!date) return "—";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const formatted = new Intl.DateTimeFormat(
    intlLocale(locale),
    dateFormatOptions(locale, false),
  ).format(d);
  // Avoid narrow no-break spaces from some Intl implementations
  return formatted.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
}

export function formatDateTime(
  date: Date | string | null | undefined,
  locale: Locale = "en",
): string {
  if (!date) return "—";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const formatted = new Intl.DateTimeFormat(
    intlLocale(locale),
    dateFormatOptions(locale, true),
  ).format(d);
  return formatted.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
}

export function formatRelative(
  date: Date | string | null | undefined,
  locale: Locale = "en",
): string {
  if (!date) return "—";
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const past = d.getTime() < now.getTime();
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  });

  const minutes = Math.abs(differenceInMinutes(d, now));
  if (minutes < 60) {
    const value = past ? -minutes : minutes;
    return rtf.format(value, "minute");
  }
  const hours = Math.abs(differenceInHours(d, now));
  if (hours < 24) {
    return rtf.format(past ? -hours : hours, "hour");
  }
  const days = Math.abs(differenceInCalendarDays(d, now));
  if (days < 7) {
    return rtf.format(past ? -days : days, "day");
  }
  const weeks = Math.abs(differenceInWeeks(d, now));
  if (weeks < 5) {
    return rtf.format(past ? -weeks : weeks, "week");
  }
  const months = Math.abs(differenceInMonths(d, now));
  if (months < 12) {
    return rtf.format(past ? -months : months, "month");
  }
  const years = Math.abs(differenceInYears(d, now));
  return rtf.format(past ? -years : years, "year");
}

const deadlineCopy: Record<
  Locale,
  {
    none: string;
    past: string;
    today: string;
    tomorrow: string;
    daysLeft: (n: number) => string;
  }
> = {
  en: {
    none: "No deadline",
    past: "Past deadline",
    today: "Due today",
    tomorrow: "Due tomorrow",
    daysLeft: (n) => `${n} days left`,
  },
  es: {
    none: "Sin plazo",
    past: "Plazo vencido",
    today: "Vence hoy",
    tomorrow: "Vence mañana",
    daysLeft: (n) => `${n} días restantes`,
  },
  zh: {
    none: "无截止日期",
    past: "已过截止日期",
    today: "今日到期",
    tomorrow: "明日到期",
    daysLeft: (n) => `剩余 ${n} 天`,
  },
  ar: {
    none: "لا موعد نهائي",
    past: "موعد منتهٍ",
    today: "مستحق اليوم",
    tomorrow: "مستحق غدًا",
    daysLeft: (n) => `${n} أيام متبقية`,
  },
  fr: {
    none: "Aucune échéance",
    past: "Échéance dépassée",
    today: "Échéance aujourd’hui",
    tomorrow: "Échéance demain",
    daysLeft: (n) => `${n} jours restants`,
  },
};

export function deadlineLabel(
  date: Date | string | null | undefined,
  locale: Locale = "en",
): string {
  const copy = deadlineCopy[locale] ?? deadlineCopy.en;
  if (!date) return copy.none;
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return copy.none;
  if (isPast(d)) return copy.past;
  const days = differenceInCalendarDays(d, new Date());
  if (days === 0) return copy.today;
  if (days === 1) return copy.tomorrow;
  if (days <= 7) return copy.daysLeft(days);
  return formatDate(d, locale);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
