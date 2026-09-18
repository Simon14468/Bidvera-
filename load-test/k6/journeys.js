/**
 * Bidvera realistic journey load test (k6).
 *
 * Auth: pre-seeded session cookies (login is rate-limited to 30/IP/hour —
 * blasting login for 1000 VUs would measure the rate limiter, not app capacity).
 * A small login probe scenario validates the login page is reachable.
 *
 * NEVER set BASE_URL to production.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const MAX_VUS = Number(__ENV.MAX_VUS || 1000);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 180);
const ERROR_RATE_MAX = Number(__ENV.ERROR_RATE_THRESHOLD || 0.01);
const P95_MS = Number(__ENV.P95_MS || 2000);
const P99_MS = Number(__ENV.P99_MS || 5000);
const USERS_FILE = __ENV.USERS_FILE || "/fixtures/users.json";
const THINK_MIN = Number(__ENV.THINK_MIN || 0.4);
const THINK_MAX = Number(__ENV.THINK_MAX || 1.8);

const errors = new Rate("bidvera_errors");
const status4xx = new Counter("bidvera_http_4xx");
const status5xx = new Counter("bidvera_http_5xx");
const timeouts = new Counter("bidvera_timeouts");
const pageLatency = new Trend("bidvera_page_latency", true);
const apiLatency = new Trend("bidvera_api_latency", true);

function assertNotProduction() {
  const lower = BASE_URL.toLowerCase();
  const blocked = ["bidvera.com", "vercel.app", "neon.tech", "railway.app", "render.com"];
  for (const b of blocked) {
    if (lower.includes(b)) {
      throw new Error(`Refusing to run k6 against blocked host in BASE_URL=${BASE_URL}`);
    }
  }
}
assertNotProduction();

const users = new SharedArray("users", function () {
  const raw = JSON.parse(open(USERS_FILE));
  if (!raw.users || !raw.users.length) {
    throw new Error(`No users in ${USERS_FILE}. Run load-test seed first.`);
  }
  return raw.users;
});

function stagesFor(maxVus) {
  const steps = [50, 100, 250, 500, 750, 1000].filter((n) => n <= maxVus);
  if (!steps.includes(maxVus)) steps.push(maxVus);
  const out = [];
  for (const target of steps) {
    out.push({ duration: "1m", target });
  }
  out.push({ duration: `${HOLD_SECONDS}s`, target: maxVus });
  out.push({ duration: "1m", target: 0 });
  return out;
}

export const options = {
  scenarios: {
    journeys: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: stagesFor(MAX_VUS),
      gracefulRampDown: "30s",
      exec: "journey",
    },
    login_probe: {
      executor: "constant-vus",
      vus: Math.min(5, MAX_VUS),
      duration: "2m",
      startTime: "10s",
      exec: "loginProbe",
    },
  },
  thresholds: {
    bidvera_errors: [`rate<${ERROR_RATE_MAX}`],
    http_req_failed: [`rate<${ERROR_RATE_MAX}`],
    bidvera_page_latency: [`p(95)<${P95_MS}`, `p(99)<${P99_MS}`],
    bidvera_api_latency: [`p(95)<${P95_MS}`, `p(99)<${P99_MS}`],
    bidvera_http_5xx: ["count<50"],
  },
};

function think() {
  sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
}

function cookieHeader(token) {
  return { Cookie: `bidvera_session=${token}` };
}

function record(res, kind) {
  const failed = res.status >= 400 || res.status === 0;
  errors.add(failed);
  if (res.status >= 400 && res.status < 500) status4xx.add(1);
  if (res.status >= 500) status5xx.add(1);
  if (res.status === 0 || res.error_code === 1050) timeouts.add(1);
  if (kind === "page") pageLatency.add(res.timings.duration);
  else apiLatency.add(res.timings.duration);
  return !failed;
}

function getUser() {
  const idx = (__VU - 1) % users.length;
  return users[idx];
}

export function journey() {
  const user = getUser();
  const headers = {
    ...cookieHeader(user.sessionToken),
    Accept: "text/html,application/json",
  };

  group("login_session_present", () => {
    // Session already established by seed — exercise authenticated entry.
    const res = http.get(`${BASE_URL}/dashboard`, { headers, redirects: 0 });
    check(res, {
      "dashboard ok or redirect": (r) => r.status === 200 || r.status === 307 || r.status === 308,
      "not forced to login": (r) => {
        const loc = r.headers.Location || "";
        return !loc.includes("/login");
      },
    });
    record(res, "page");
  });
  think();

  group("dashboard", () => {
    const res = http.get(`${BASE_URL}/dashboard`, { headers });
    check(res, { "dashboard 200": (r) => r.status === 200 });
    record(res, "page");
  });
  think();

  group("company_profile", () => {
    const res = http.get(`${BASE_URL}/company`, { headers });
    check(res, { "company 200": (r) => r.status === 200 });
    record(res, "page");
  });
  think();

  group("document_compliance", () => {
    const page = http.get(`${BASE_URL}/document-compliance`, { headers });
    check(page, { "dcm page 200": (r) => r.status === 200 });
    record(page, "page");
    const api = http.get(`${BASE_URL}/api/document-compliance/documents?view=dashboard`, {
      headers: { ...headers, Accept: "application/json" },
    });
    check(api, { "dcm api ok": (r) => r.status === 200 || r.status === 403 });
    record(api, "api");
  });
  think();

  group("client_requests", () => {
    const page = http.get(`${BASE_URL}/client-requests`, { headers });
    check(page, { "client-requests page 200": (r) => r.status === 200 });
    record(page, "page");
    const api = http.get(`${BASE_URL}/api/client-requests?view=dashboard`, {
      headers: { ...headers, Accept: "application/json" },
    });
    check(api, { "client-requests api ok": (r) => r.status === 200 || r.status === 403 });
    record(api, "api");
  });
  think();

  group("supplier_qualification", () => {
    const page = http.get(`${BASE_URL}/supplier-qualification`, { headers });
    check(page, { "sq page 200": (r) => r.status === 200 });
    record(page, "page");
    const api = http.get(`${BASE_URL}/api/supplier-qualification/profile?view=dashboard`, {
      headers: { ...headers, Accept: "application/json" },
    });
    check(api, { "sq api ok": (r) => r.status === 200 || r.status === 403 });
    record(api, "api");
  });
  think();

  group("questionnaire_assistant", () => {
    const page = http.get(`${BASE_URL}/questionnaire-assistant`, { headers });
    check(page, { "qa page 200": (r) => r.status === 200 });
    record(page, "page");
  });
  think();

  group("evidence_and_settings", () => {
    const evidence = http.get(`${BASE_URL}/supplier-qualification/evidence`, { headers });
    check(evidence, { "evidence 200": (r) => r.status === 200 });
    record(evidence, "page");
    const settings = http.get(`${BASE_URL}/settings`, { headers });
    check(settings, { "settings 200": (r) => r.status === 200 });
    record(settings, "page");
  });
  think();

  group("matching_read_safe", () => {
    // Commercial Matching stays OFF — exercise gated read UI only (expect 200 or soft gate).
    const matched = http.get(`${BASE_URL}/matched-opportunities`, { headers });
    check(matched, {
      "matched page reachable": (r) => r.status === 200 || r.status === 403 || r.status === 402,
    });
    record(matched, "page");
  });
  think();

  group("tenders_decision", () => {
    const list = http.get(`${BASE_URL}/tenders`, { headers });
    check(list, { "tenders 200": (r) => r.status === 200 });
    record(list, "page");
  });
  think();

  group("logout", () => {
    // Clear session cookie locally (server-action logout is build-id coupled).
    const headersOut = { Accept: "text/html" };
    const res = http.get(`${BASE_URL}/dashboard`, { headers: headersOut, redirects: 0 });
    check(res, {
      "unauth redirects to login": (r) =>
        r.status === 307 || r.status === 308 || r.status === 302 || r.status === 401,
    });
    // Do not count intentional unauth redirect as an application error.
  });
}

export function loginProbe() {
  const res = http.get(`${BASE_URL}/login`);
  check(res, { "login page 200": (r) => r.status === 200 });
  record(res, "page");
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { "health 200": (r) => r.status === 200 });
  record(health, "api");
  sleep(1);
}

export function handleSummary(data) {
  const httpMetrics = data.metrics.http_reqs || {};
  const failed = data.metrics.http_req_failed || {};
  const dur = data.metrics.http_req_duration || {};
  const page = data.metrics.bidvera_page_latency || {};
  const api = data.metrics.bidvera_api_latency || {};
  const e4 = data.metrics.bidvera_http_4xx || {};
  const e5 = data.metrics.bidvera_http_5xx || {};
  const to = data.metrics.bidvera_timeouts || {};

  // k6 v2 summary-export is flat (no `.values`); handleSummary data.metrics still uses `.values`.
  function metricVals(m) {
    if (!m) return {};
    return m.values && typeof m.values === "object" ? m.values : m;
  }
  const httpV = metricVals(httpMetrics);
  const failedV = metricVals(failed);
  const durV = metricVals(dur);
  const pageV = metricVals(page);
  const apiV = metricVals(api);
  const requests = httpV.count || 0;
  const errorRate = typeof failedV.rate === "number" ? failedV.rate : 0;
  const failedCount = Math.round(errorRate * requests);
  const p95 = pageV["p(95)"] || durV["p(95)"] || 0;
  const p99 = pageV["p(99)"] || durV["p(99)"] || pageV["p(95)"] || durV["p(95)"] || 0;
  const p50 = pageV["p(50)"] || pageV.med || durV["p(50)"] || durV.med || 0;
  const durationMs = (data.state && data.state.testRunDurationMs) || 0;
  const rpsAvg = durationMs > 0 ? requests / (durationMs / 1000) : 0;
  const rpsPeak = rpsAvg; // k6 summary does not expose instantaneous peak; document as avg≈observed

  const bottlenecks = [];
  if (errorRate > ERROR_RATE_MAX) bottlenecks.push("Error rate exceeded threshold");
  if (p95 > P95_MS) bottlenecks.push(`Page/API p95 ${Math.round(p95)}ms > ${P95_MS}ms`);
  if (p99 > P99_MS) bottlenecks.push(`Page/API p99 ${Math.round(p99)}ms > ${P99_MS}ms`);
  const e4V = metricVals(e4);
  const e5V = metricVals(e5);
  const toV = metricVals(to);
  if ((e5V.count || 0) > 0) bottlenecks.push("HTTP 5xx responses observed");
  if ((toV.count || 0) > 0) bottlenecks.push("Request timeouts observed");
  if (!bottlenecks.length) bottlenecks.push("No automatic bottleneck detected from thresholds");

  const recommended = [
    "App: 4–8 vCPU / 8–16 GB RAM behind a process manager (or multiple Next.js instances)",
    "PostgreSQL: connection pool sized for VU concurrency (e.g. PgBouncer, max_connections ≥ 200)",
    "Separate worker process; keep Matching/TED OFF during load tests",
    "Durable rate-limit backend (DB) for multi-instance staging",
  ];

  const vusMaxMetric = data.metrics.vus_max || data.metrics.vus || {};
  const vusV = metricVals(vusMaxMetric);
  const reached = Math.round(vusV.max || vusV.value || 0);
  let verdict = "PASS";
  if (reached < MAX_VUS) {
    verdict = "FAIL";
    bottlenecks.unshift(
      `Concurrent users reached ${reached} < target ${MAX_VUS}`,
    );
  } else if (errorRate > ERROR_RATE_MAX || (e5V.count || 0) > 50) {
    verdict = "FAIL";
  } else if (p95 > P95_MS || p99 > P99_MS) {
    verdict = "WARNING";
  }
  if (requests < 100) {
    verdict = "FAIL";
    bottlenecks.unshift("Too few requests completed — environment may not have stayed up");
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: "docker-load-test",
    baseUrl: BASE_URL.replace(/\/\/.*@/, "//"), // strip any accidental creds
    concurrentUsersTarget: MAX_VUS,
    concurrentUsersReached: reached,
    holdSeconds: HOLD_SECONDS,
    durationMs,
    http: {
      requests,
      failed: failedCount,
      errorRate,
      rpsPeak,
      rpsAvg,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      status4xx: e4V.count || 0,
      status5xx: e5V.count || 0,
      timeouts: toV.count || 0,
    },
    thresholds: {
      errorRateMax: ERROR_RATE_MAX,
      p95MsMax: P95_MS,
      p99MsMax: P99_MS,
    },
    bottlenecks,
    recommendedResources: recommended,
    notes: [
      "Authenticated journeys used pre-seeded sessions (login is rate-limited 30/IP/hour).",
      "AI/PDF/heavy analysis endpoints were not stressed; report them separately if enabled.",
      "Matching/TED workers remain OFF in this profile.",
      `API p95=${Math.round(apiV["p(95)"] || 0)}ms (separate from page trend).`,
    ],
    verdict,
  };

  // Re-evaluate with shared rules if users reached target
  if (reached < MAX_VUS) report.verdict = "FAIL";

  const out = {};
  const reportOut = __ENV.REPORT_OUT || "/results/k6-summary.json";
  const appReport = __ENV.APP_REPORT_OUT || "/app-data/load-test/latest-report.json";
  out[reportOut] = JSON.stringify(report, null, 2);
  out[appReport] = JSON.stringify(report, null, 2);
  out.stdout = textSummary(data, { indent: " ", enableColors: true });
  return out;
}
