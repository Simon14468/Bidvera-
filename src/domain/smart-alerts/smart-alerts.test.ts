import assert from "node:assert/strict";
import test from "node:test";
import {
  alertTypePrefKey,
  buildPostAnalysisAlertCandidates,
  buildWorkflowAlertCandidate,
  priorSnapshotFromStored,
  SCORE_CHANGE_THRESHOLD,
  significantScoreChange,
  type CurrentAnalysisSnapshot,
  type PriorAnalysisSnapshot,
} from "@/domain/smart-alerts";
import {
  DEFAULT_NOTIFICATION_PREFS,
  prefersAlertType,
  notificationPrefsSchema,
} from "@/services/notifications/prefs";

function currentBase(
  overrides: Partial<CurrentAnalysisSnapshot> = {},
): CurrentAnalysisSnapshot {
  return {
    companyId: "co1",
    tenderId: "t1",
    title: "CPS Road Works",
    decision: "BID",
    fitScore: 72,
    bidScore: 68,
    scoringAvailable: true,
    hasHighOrCriticalRisk: false,
    missingDocumentCount: 0,
    compliance: {
      totalRequirements: 10,
      ready: 7,
      missing: 2,
      verify: 1,
    },
    decisionMemoryMatchIds: [],
    decisionMemoryTopTitle: null,
    decisionMemoryTopLabel: null,
    ...overrides,
  };
}

test("buildPostAnalysisAlertCandidates emits decision from real data only", () => {
  const candidates = buildPostAnalysisAlertCandidates(currentBase(), null);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.type, "DECISION_GENERATED");
  assert.match(candidates[0]!.message, /CPS Road Works/);
  assert.match(candidates[0]!.message, /GO/);
  assert.match(candidates[0]!.message, /68/);
  assert.equal(candidates[0]!.dedupeKey, "co1:t1:decision:BID:72:68");
});

test("buildPostAnalysisAlertCandidates never invents missing-doc or risk alerts", () => {
  const candidates = buildPostAnalysisAlertCandidates(currentBase(), null);
  assert.ok(!candidates.some((c) => c.type === "MISSING_DOCUMENT"));
  assert.ok(!candidates.some((c) => c.type === "HIGH_RISK"));
  assert.ok(!candidates.some((c) => c.type === "SCORE_CHANGED"));
  assert.ok(!candidates.some((c) => c.type === "DECISION_MEMORY"));
});

test("high-risk and missing-doc candidates only when facts present", () => {
  const candidates = buildPostAnalysisAlertCandidates(
    currentBase({
      hasHighOrCriticalRisk: true,
      missingDocumentCount: 3,
    }),
    null,
  );
  const types = candidates.map((c) => c.type);
  assert.ok(types.includes("HIGH_RISK"));
  assert.ok(types.includes("MISSING_DOCUMENT"));
  assert.match(
    candidates.find((c) => c.type === "MISSING_DOCUMENT")!.message,
    /3 document/,
  );
  assert.equal(
    candidates.find((c) => c.type === "HIGH_RISK")!.dedupeKey,
    "co1:t1:high-risk",
  );
});

test("score change requires prior + threshold; never invents delta", () => {
  const prior: PriorAnalysisSnapshot = {
    decision: "BID",
    fitScore: 70,
    bidScore: 60,
    compliance: {
      totalRequirements: 10,
      ready: 7,
      missing: 2,
      verify: 1,
    },
  };
  const small = significantScoreChange(prior, currentBase({ bidScore: 63 }));
  assert.equal(small, null);

  const big = significantScoreChange(
    prior,
    currentBase({ bidScore: 60 + SCORE_CHANGE_THRESHOLD }),
  );
  assert.ok(big);
  assert.match(big!.message, /60 → 65/);

  const decisionFlip = significantScoreChange(
    { ...prior, decision: "REVIEW" },
    currentBase({ bidScore: 60 }),
  );
  assert.ok(decisionFlip);
  assert.match(decisionFlip!.message, /CONDITIONAL GO → GO|REVIEW → BID/);
});

test("requirement status change only when counts actually differ", () => {
  const prior: PriorAnalysisSnapshot = {
    decision: "BID",
    fitScore: 72,
    bidScore: 68,
    compliance: {
      totalRequirements: 10,
      ready: 5,
      missing: 4,
      verify: 1,
    },
  };
  const candidates = buildPostAnalysisAlertCandidates(currentBase(), prior);
  const req = candidates.find((c) => c.type === "REQUIREMENT_STATUS");
  assert.ok(req);
  assert.match(req!.message, /7 ready/);
  assert.match(req!.message, /was 5\/4\/1/);

  const same = buildPostAnalysisAlertCandidates(
    currentBase(),
    {
      ...prior,
      compliance: {
        totalRequirements: 10,
        ready: 7,
        missing: 2,
        verify: 1,
      },
    },
  );
  assert.ok(!same.some((c) => c.type === "REQUIREMENT_STATUS"));
});

test("decision memory candidate uses real match ids only", () => {
  const candidates = buildPostAnalysisAlertCandidates(
    currentBase({
      decisionMemoryMatchIds: ["mem_abc", "mem_def"],
      decisionMemoryTopTitle: "Prior Highway Bid",
      decisionMemoryTopLabel: "GO",
    }),
    null,
  );
  const mem = candidates.find((c) => c.type === "DECISION_MEMORY");
  assert.ok(mem);
  assert.equal(mem!.href, "/decision-memory/mem_abc");
  assert.equal(mem!.dedupeKey, "co1:t1:memory:mem_abc");
  assert.match(mem!.message, /Prior Highway Bid/);
  assert.match(mem!.message, /does not change current scores/);
});

test("priorSnapshotFromStored never invents scores from empty breakdown", () => {
  const empty = priorSnapshotFromStored({});
  assert.equal(empty.decision, null);
  assert.equal(empty.bidScore, null);
  assert.equal(empty.compliance, null);

  const fromStored = priorSnapshotFromStored({
    decision: "NO_BID",
    fitScore: 40,
    bidScoreBreakdown: { score: 35, scoringAvailable: true },
    intelligenceBreakdown: {
      complianceSummary: {
        totalRequirements: 4,
        ready: 1,
        missing: 2,
        verify: 1,
      },
    },
  });
  assert.equal(fromStored.decision, "NO_BID");
  assert.equal(fromStored.bidScore, 35);
  assert.equal(fromStored.compliance?.missing, 2);

  const unavailable = priorSnapshotFromStored({
    bidScoreBreakdown: { score: 99, scoringAvailable: false },
  });
  assert.equal(unavailable.bidScore, null);
});

test("workflow candidate is traceable to gate reason", () => {
  const c = buildWorkflowAlertCandidate({
    companyId: "co1",
    tenderId: "t1",
    title: "Notice",
    reason: "ONLY_AVIS",
    message: "CPS package incomplete — upload full ITT.",
  });
  assert.equal(c.type, "WORKFLOW_EVENT");
  assert.equal(c.dedupeKey, "co1:t1:workflow:ONLY_AVIS");
  assert.match(c.message, /CPS package incomplete/);
});

test("duplicate candidates share stable dedupe keys across identical facts", () => {
  const a = buildPostAnalysisAlertCandidates(currentBase(), null);
  const b = buildPostAnalysisAlertCandidates(currentBase(), null);
  assert.deepEqual(
    a.map((c) => c.dedupeKey),
    b.map((c) => c.dedupeKey),
  );
});

test("prefersAlertType respects Smart Alert toggles", () => {
  assert.equal(
    prefersAlertType(DEFAULT_NOTIFICATION_PREFS, "SCORE_CHANGED"),
    true,
  );
  assert.equal(
    prefersAlertType(
      { ...DEFAULT_NOTIFICATION_PREFS, scoreChangeAlerts: false },
      "SCORE_CHANGED",
    ),
    false,
  );
  assert.equal(
    prefersAlertType(
      { ...DEFAULT_NOTIFICATION_PREFS, decisionMemoryAlerts: false },
      "DECISION_MEMORY",
    ),
    false,
  );
  assert.equal(
    prefersAlertType(
      { ...DEFAULT_NOTIFICATION_PREFS, workflowAlerts: false },
      "WORKFLOW_EVENT",
    ),
    false,
  );
  assert.equal(alertTypePrefKey("DEADLINE_APPROACHING"), "deadline");
});

test("notification prefs schema accepts Smart Alert fields", () => {
  const parsed = notificationPrefsSchema.parse({
    ...DEFAULT_NOTIFICATION_PREFS,
    scoreChangeAlerts: false,
  });
  assert.equal(parsed.scoreChangeAlerts, false);
  assert.equal(parsed.decisionMemoryAlerts, true);
});

/**
 * In-memory flow: event → create → deliver → read → dedupe → retry.
 * Mirrors ModularNotificationService semantics without DB.
 */
test("smart alert flow: create → deliver → read → dedupe → retry", () => {
  type Row = {
    id: string;
    dedupeKey: string;
    status: "SCHEDULED" | "SENT" | "READ" | "CANCELLED";
    title: string;
    message: string;
    emailSentAt: Date | null;
    attemptCount: number;
    lastError: string | null;
    scheduledFor: Date;
  };

  const store = new Map<string, Row>();
  const emails: Array<{ subject: string; text: string }> = [];
  let seq = 0;

  function createFromCandidate(
    c: ReturnType<typeof buildPostAnalysisAlertCandidates>[number],
    prefs: { emailEnabled: boolean; typeEnabled: boolean },
  ) {
    if (!prefs.typeEnabled) return;
    const existing = store.get(c.dedupeKey);
    if (existing && (existing.status === "SENT" || existing.status === "READ")) {
      return; // duplicate prevention
    }
    if (existing && existing.status === "SCHEDULED") {
      existing.title = c.title;
      existing.message = c.message;
      return;
    }
    const id = `a${++seq}`;
    store.set(c.dedupeKey, {
      id,
      dedupeKey: c.dedupeKey,
      status: "SCHEDULED",
      title: c.title,
      message: c.message,
      emailSentAt: null,
      attemptCount: 0,
      lastError: null,
      scheduledFor: new Date(),
    });
  }

  function deliver(dedupeKey: string, fail = false) {
    const row = store.get(dedupeKey);
    if (!row || row.status !== "SCHEDULED") return false;
    if (fail) {
      row.attemptCount += 1;
      row.lastError = "smtp_timeout";
      row.scheduledFor = new Date(Date.now() + 2000 * 2 ** (row.attemptCount - 1));
      return false;
    }
    // Canonical email body = same title/message as dashboard
    emails.push({
      subject: `[Bidvera] ${row.title}`,
      text: `${row.title}\n\n${row.message}`,
    });
    row.status = "SENT";
    row.emailSentAt = new Date();
    row.attemptCount += 1;
    row.lastError = null;
    return true;
  }

  function markRead(dedupeKey: string) {
    const row = store.get(dedupeKey);
    if (!row || row.status !== "SENT") return;
    row.status = "READ";
  }

  const candidates = buildPostAnalysisAlertCandidates(
    currentBase({ hasHighOrCriticalRisk: true, missingDocumentCount: 1 }),
    null,
  );
  assert.ok(candidates.length >= 3);

  for (const c of candidates) {
    createFromCandidate(c, { emailEnabled: true, typeEnabled: true });
  }
  assert.equal(store.size, candidates.length);

  const decisionKey = candidates.find((c) => c.type === "DECISION_GENERATED")!.dedupeKey;

  // Failure + retry
  assert.equal(deliver(decisionKey, true), false);
  assert.equal(store.get(decisionKey)!.status, "SCHEDULED");
  assert.equal(store.get(decisionKey)!.attemptCount, 1);
  assert.ok(store.get(decisionKey)!.lastError);

  assert.equal(deliver(decisionKey, false), true);
  assert.equal(store.get(decisionKey)!.status, "SENT");
  assert.ok(store.get(decisionKey)!.emailSentAt);
  assert.equal(emails.length, 1);
  assert.equal(emails[0]!.subject, `[Bidvera] ${store.get(decisionKey)!.title}`);
  assert.match(emails[0]!.text, /CPS Road Works/);

  // Dashboard read/unread
  markRead(decisionKey);
  assert.equal(store.get(decisionKey)!.status, "READ");

  // Duplicate prevention: same event again must not recreate
  const before = store.size;
  for (const c of candidates) {
    createFromCandidate(c, { emailEnabled: true, typeEnabled: true });
  }
  assert.equal(store.size, before);
  assert.equal(emails.length, 1);

  // Pref off → no create for that type
  const scoreCandidates = buildPostAnalysisAlertCandidates(
    currentBase({ bidScore: 80 }),
    {
      decision: "BID",
      fitScore: 72,
      bidScore: 60,
      compliance: currentBase().compliance,
    },
  );
  const score = scoreCandidates.find((c) => c.type === "SCORE_CHANGED");
  assert.ok(score);
  createFromCandidate(score!, { emailEnabled: true, typeEnabled: false });
  assert.equal(store.has(score!.dedupeKey), false);
});
