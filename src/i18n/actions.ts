"use server";

import { defaultLocale, isLocale, localeCookieName, type Locale } from "@/i18n/config";
import { cookies } from "next/headers";

export async function setLocaleAction(locale: string) {
  const next: Locale = isLocale(locale) ? locale : defaultLocale;
  const jar = await cookies();
  jar.set(localeCookieName, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true as const, locale: next };
}
