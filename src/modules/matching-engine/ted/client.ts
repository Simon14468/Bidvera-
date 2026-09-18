/**
 * Official TED Search API v3 HTTP client.
 * Anonymous for published notices — no API key required.
 * Optional API key header only when vault provides one (future / other TED APIs).
 */

import {
  TED_SEARCH_FIELDS,
  TED_SEARCH_MAX_FIELD_CELLS,
  TED_SEARCH_MAX_LIMIT,
  TED_SEARCH_URL,
} from "./constants";
import {
  TedHttpError,
  type TedSearchRequest,
  type TedSearchResponse,
} from "./types";

export type TedFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type TedClientOptions = {
  fetchImpl?: TedFetch;
  baseUrl?: string;
  /** Optional — Search API does not require auth; never logged. */
  apiKey?: string | null;
  timeoutMs?: number;
  maxRetries?: number;
  /** Injected delay for tests. */
  sleep?: (ms: number) => Promise<void>;
};

function sleepDefault(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampLimit(limit: number | undefined): number {
  const n = limit ?? 50;
  return Math.min(Math.max(1, Math.floor(n)), TED_SEARCH_MAX_LIMIT);
}

export function assertFieldCellBudget(fields: string[], limit: number): void {
  // TED adds publication-number + links implicitly when missing — budget conservatively.
  const effectiveFields = new Set([...fields, "publication-number", "links"]);
  const cells = effectiveFields.size * limit;
  if (cells > TED_SEARCH_MAX_FIELD_CELLS) {
    throw new TedHttpError(
      "invalid_response",
      `TED field-cell budget exceeded (${cells} > ${TED_SEARCH_MAX_FIELD_CELLS}).`,
      { retryable: false },
    );
  }
}

export async function tedSearchNotices(
  request: Partial<TedSearchRequest> & { query: string },
  options?: TedClientOptions,
): Promise<TedSearchResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const sleep = options?.sleep ?? sleepDefault;
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const maxRetries = options?.maxRetries ?? 3;
  const baseUrl = options?.baseUrl ?? TED_SEARCH_URL;

  const fields = request.fields?.length
    ? [...request.fields]
    : [...TED_SEARCH_FIELDS];
  const limit = clampLimit(request.limit);
  assertFieldCellBudget(fields, limit);

  const body: TedSearchRequest = {
    query: request.query,
    fields,
    limit,
    scope: request.scope ?? "ACTIVE",
    checkQuerySyntax: request.checkQuerySyntax ?? false,
    paginationMode: request.paginationMode ?? "PAGE_NUMBER",
    onlyLatestVersions: request.onlyLatestVersions ?? true,
  };
  if (body.paginationMode === "PAGE_NUMBER") {
    body.page = Math.max(1, request.page ?? 1);
  } else if (request.iterationNextToken) {
    body.iterationNextToken = request.iterationNextToken;
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const key = options?.apiKey?.trim();
      if (key) {
        // Official pattern for authenticated TED endpoints — Search does not require it.
        headers["Authorization"] = `Bearer ${key}`;
      }

      const res = await fetchImpl(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429) {
        throw new TedHttpError("rate_limit", "TED rate limit (HTTP 429).", {
          status: 429,
          retryable: true,
        });
      }

      if (!res.ok) {
        throw new TedHttpError(
          "http_error",
          `TED Search HTTP ${res.status}.`,
          {
            status: res.status,
            retryable: res.status >= 500,
          },
        );
      }

      const json = (await res.json()) as TedSearchResponse;
      if (!json || typeof json !== "object") {
        throw new TedHttpError(
          "invalid_response",
          "TED Search returned non-object JSON.",
          { retryable: false },
        );
      }
      if (json.timedOut === true) {
        throw new TedHttpError(
          "timed_out_search",
          "TED Search reported timedOut=true.",
          { retryable: true },
        );
      }
      return json;
    } catch (error) {
      lastError = error;
      const isAbort =
        (error instanceof Error &&
          (error.name === "AbortError" || /aborted|timeout/i.test(error.message))) ||
        (typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: string }).name === "AbortError");
      const tedErr =
        error instanceof TedHttpError
          ? error
          : isAbort
            ? new TedHttpError("timeout", "TED Search request timed out.", {
                retryable: true,
              })
            : null;

      if (!tedErr || !tedErr.retryable || attempt > maxRetries) {
        throw tedErr ?? error;
      }

      const backoff = Math.min(8_000, 400 * 2 ** (attempt - 1));
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new TedHttpError("http_error", "TED Search failed.", { retryable: false });
}
