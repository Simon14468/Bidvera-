import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  defaultLocale,
  isLocale,
  localeCookieName,
  type Locale,
} from "./config";

/** Request-scoped — layout + page share one cookie/header read. */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = await headers();
  const fromHeader = h.get("x-bidvera-locale");
  if (isLocale(fromHeader)) return fromHeader;

  const jar = await cookies();
  const fromCookie = jar.get(localeCookieName)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return defaultLocale;
});
