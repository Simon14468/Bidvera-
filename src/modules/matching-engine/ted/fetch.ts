/**
 * Bounded TED Search fetch — shared by ingest + dry-run.
 * No scraping; Search API JSON only; hard page + notice caps.
 */

import { tedSearchNotices, type TedClientOptions } from "./client";
import { buildTedExpertQuery, getTedApiKey, type TedPublicSettings } from "./config";
import { TED_SEARCH_FIELDS } from "./constants";
import type { TedNoticeRaw } from "./types";

/** Absolute ceiling — never paginate without bound. */
export const TED_ABSOLUTE_MAX_PAGES = 20;

export function resolveTedPageBudget(settings: TedPublicSettings): {
  pageLimit: number;
  maxNotices: number;
  maxPages: number;
} {
  const pageLimit = Math.min(
    Math.max(1, settings.pageLimit),
    settings.maxNoticesPerRun,
  );
  const maxNotices = Math.max(1, settings.maxNoticesPerRun);
  const needed = Math.ceil(maxNotices / pageLimit);
  const configured = Math.max(1, settings.maxPagesPerRun ?? needed);
  const maxPages = Math.min(TED_ABSOLUTE_MAX_PAGES, configured, needed);
  return { pageLimit, maxNotices, maxPages };
}

export async function fetchTedNoticesBounded(
  settings: TedPublicSettings,
  options?: {
    client?: TedClientOptions;
    notices?: TedNoticeRaw[];
  },
): Promise<{ notices: TedNoticeRaw[]; pagesFetched: number; query: string }> {
  if (options?.notices) {
    return {
      notices: options.notices.slice(0, settings.maxNoticesPerRun),
      pagesFetched: 0,
      query: "(injected)",
    };
  }

  const query = buildTedExpertQuery(settings, new Date());
  const { pageLimit, maxNotices, maxPages } = resolveTedPageBudget(settings);
  const apiKey = options?.client?.apiKey ?? (await getTedApiKey());
  const notices: TedNoticeRaw[] = [];
  let pagesFetched = 0;

  for (let page = 1; page <= maxPages && notices.length < maxNotices; page++) {
    const remaining = maxNotices - notices.length;
    const limit = Math.min(pageLimit, remaining);
    const response = await tedSearchNotices(
      {
        query,
        fields: [...TED_SEARCH_FIELDS],
        limit,
        page,
        scope: settings.scope,
        paginationMode: "PAGE_NUMBER",
        onlyLatestVersions: settings.onlyLatestVersions,
      },
      {
        ...options?.client,
        apiKey,
        timeoutMs: settings.timeoutMs,
        maxRetries: settings.maxRetries,
      },
    );
    pagesFetched += 1;
    const batch = Array.isArray(response.notices) ? response.notices : [];
    if (!batch.length) break;
    notices.push(...batch);
    if (batch.length < limit) break;
  }

  return {
    notices: notices.slice(0, maxNotices),
    pagesFetched,
    query,
  };
}
