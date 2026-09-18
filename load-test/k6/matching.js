/**
 * Matching/filter read concurrency (commercial Matching stays OFF).
 * Exercises gated matched-opportunities UI under concurrent tenants.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";

const BASE_URL = (__ENV.BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const MAX_VUS = Number(__ENV.MAX_VUS || 50);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 60);
const USERS_FILE = __ENV.USERS_FILE || "/fixtures/users.json";
const errors = new Rate("bidvera_errors");
const latency = new Trend("matching_page_latency", true);

if (/neon\.tech|bidvera\.com|vercel\.app/i.test(BASE_URL)) {
  throw new Error(`Refusing matching load against ${BASE_URL}`);
}

const users = new SharedArray("users", function () {
  const raw = JSON.parse(open(USERS_FILE));
  return raw.users;
});

export const options = {
  scenarios: {
    matching: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: MAX_VUS },
        { duration: `${HOLD_SECONDS}s`, target: MAX_VUS },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "20s",
    },
  },
  thresholds: {
    bidvera_errors: ["rate<0.05"],
    matching_page_latency: ["p(95)<5000"],
  },
};

export function matchingJourney() {
  const user = users[(__VU - 1) % users.length];
  const headers = {
    Cookie: `bidvera_session=${user.sessionToken}`,
    Accept: "text/html,application/json",
  };
  // Filter-like reads: matched list + company profile dimensions (safe gated reads).
  const pages = [
    "/matched-opportunities",
    "/company",
    "/supplier-qualification",
    "/document-compliance",
    "/client-requests",
    "/tenders",
    "/settings",
    "/dashboard",
  ];
  for (const path of pages) {
    const res = http.get(`${BASE_URL}${path}`, { headers });
    const ok = res.status === 200 || res.status === 402 || res.status === 403;
    check(res, { [`${path} reachable`]: () => ok });
    errors.add(!ok && res.status !== 0);
    latency.add(res.timings.duration);
    sleep(0.2 + Math.random() * 0.4);
  }
}

export default matchingJourney;

export function handleSummary(data) {
  const httpM = data.metrics.http_reqs || {};
  const failed = data.metrics.http_req_failed || {};
  const lat = data.metrics.matching_page_latency || {};
  const hv = (m) => (m.values && typeof m.values === "object" ? m.values : m);
  const httpV = hv(httpM);
  const failV = hv(failed);
  const latV = hv(lat);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    test: "matching-filter-concurrency",
    concurrentUsersTarget: MAX_VUS,
    concurrentUsersReached: hv(data.metrics.vus_max || data.metrics.vus || {}).max || 0,
    durationMs: (data.state && data.state.testRunDurationMs) || 0,
    http: {
      requests: httpV.count || 0,
      errorRate: typeof failV.rate === "number" ? failV.rate : failV.value || 0,
      rpsAvg:
        data.state && data.state.testRunDurationMs
          ? (httpV.count || 0) / (data.state.testRunDurationMs / 1000)
          : 0,
      p50Ms: latV["p(50)"] || latV.med || 0,
      p95Ms: latV["p(95)"] || 0,
      p99Ms: latV["p(99)"] || latV["p(95)"] || 0,
    },
    notes: [
      "Commercial Matching/TED/Sponsored remain OFF — this exercises gated read paths only.",
      "Eight filter-like page dimensions per iteration.",
    ],
  };
  const out = {};
  const reportOut = __ENV.REPORT_OUT || "load-test/results/matching-report.json";
  out[reportOut] = JSON.stringify(report, null, 2);
  out.stdout = textSummary(data, { indent: " ", enableColors: true });
  return out;
}
