/** TED Search API v3 request/response types (published notices). */

export type TedPaginationMode = "PAGE_NUMBER" | "ITERATION";
export type TedSearchScope = "LATEST" | "ACTIVE" | "ALL";

export type TedSearchRequest = {
  query: string;
  fields: string[];
  limit?: number;
  page?: number;
  scope?: TedSearchScope;
  checkQuerySyntax?: boolean;
  paginationMode?: TedPaginationMode;
  iterationNextToken?: string | null;
  onlyLatestVersions?: boolean;
};

export type TedLinks = {
  html?: Record<string, string>;
  htmlDirect?: Record<string, string>;
  pdf?: Record<string, string>;
  xml?: Record<string, string>;
  pdfs?: Record<string, string>;
};

/** Raw notice object from Search API — field values are heterogeneous. */
export type TedNoticeRaw = Record<string, unknown> & {
  "publication-number"?: string;
  "notice-identifier"?: string;
  "notice-title"?: unknown;
  "description-lot"?: unknown;
  "notice-type"?: string;
  "form-type"?: string;
  "classification-cpv"?: unknown;
  "place-of-performance"?: unknown;
  "buyer-country"?: unknown;
  "deadline-receipt-tender-date-lot"?: unknown;
  "publication-date"?: string;
  "buyer-name"?: unknown;
  links?: TedLinks;
};

export type TedSearchResponse = {
  notices?: TedNoticeRaw[];
  totalNoticeCount?: number;
  iterationNextToken?: string | null;
  timedOut?: boolean;
};

export type TedHttpErrorKind =
  | "timeout"
  | "rate_limit"
  | "http_error"
  | "invalid_response"
  | "timed_out_search";

export class TedHttpError extends Error {
  readonly kind: TedHttpErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    kind: TedHttpErrorKind,
    message: string,
    options?: { status?: number; retryable?: boolean },
  ) {
    super(message);
    this.name = "TedHttpError";
    this.kind = kind;
    this.status = options?.status;
    this.retryable =
      options?.retryable ??
      (kind === "timeout" || kind === "rate_limit" || kind === "timed_out_search");
  }
}
