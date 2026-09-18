/**
 * Search discovery preparation — no invented credentials.
 * Set env vars in deployment when ready; metadata helpers read them safely.
 */
export const searchDiscoveryEnv = {
  googleSiteVerification: "GOOGLE_SITE_VERIFICATION",
  bingSiteVerification: "BING_SITE_VERIFICATION",
  indexNowKey: "INDEXNOW_KEY",
} as const;

export function getSearchVerificationMeta(): Record<string, string> {
  const out: Record<string, string> = {};
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  if (google) out["google-site-verification"] = google;
  if (bing) out["msvalidate.01"] = bing;
  return out;
}

/**
 * IndexNow: call only when INDEXNOW_KEY is configured.
 * Host the key file yourself at `https://{host}/{INDEXNOW_KEY}.txt` (e.g. under public/).
 * Returns skipped when not configured — never invents a key.
 */
export async function notifyIndexNow(urls: string[]): Promise<{
  ok: boolean;
  skipped?: boolean;
  status?: number;
}> {
  const key = process.env.INDEXNOW_KEY?.trim();
  const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!key || !host || urls.length === 0) {
    return { ok: true, skipped: true };
  }
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls.slice(0, 100),
      }),
    });
    return { ok: res.ok || res.status === 202, status: res.status };
  } catch {
    return { ok: false };
  }
}
