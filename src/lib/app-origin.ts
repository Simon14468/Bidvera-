import { headers } from "next/headers";

/** Current app origin from the active request, or env fallback. */
export async function resolveRequestAppOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.includes("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    /* Outside a request — unit tests, scripts */
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function hostFromAppOrigin(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
