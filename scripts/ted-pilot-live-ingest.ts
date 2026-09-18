/**
 * First controlled live TED ingest — gated by dry-run quality verdict.
 *
 * - Does NOT persist matching.ted.settings enabled / workerScheduleAllowed
 * - Does NOT enable Matching Engine, Sponsorship, or AI
 * - Does NOT create recommendations
 * - Writes only validated ACTIVE opportunities via upsertOpportunityBatch
 *
 * Usage: npx tsx scripts/ted-pilot-live-ingest.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { validateOpportunityIngest } from "../src/domain/matching-engine/opportunity-validation";
import { prisma } from "../src/lib/db";
import { isMatchingEngineGloballyEnabled } from "../src/modules/matching-engine/access";
import { getMatchingAiRuntimeConfig } from "../src/modules/matching-engine/internal/ai-config";
import { isMatchingSponsorshipGloballyEnabled } from "../src/modules/matching-engine/internal/sponsorship-settings";
import {
  applyTedControlledPilotScope,
  runTedOpportunityDryRun,
  runTedOpportunityIngest,
  TED_CONTROLLED_PILOT_LABEL,
  TED_SOURCE,
  type TedIngestRunResult,
} from "../src/modules/matching-engine/ted";
import { getTedPublicSettings } from "../src/modules/matching-engine/ted/config";

type RuntimeErrors = {
  database: string[];
  api: string[];
  other: string[];
};

type LiveVerdict = "LIVE_INGEST_VALIDATED" | "LIVE_INGEST_NOT_READY";

const PRIVATE_LEAK_RE =
  /knowledge|draftText|storageKey|evidenceFile|password|secret|apiKey|token/i;

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

async function loadTedRows(externalRefs?: string[]) {
  return prisma.matchingOpportunity.findMany({
    where: {
      source: TED_SOURCE,
      ...(externalRefs?.length
        ? { externalRef: { in: externalRefs } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

function analyzeStoredRows(
  rows: Awaited<ReturnType<typeof loadTedRows>>,
  now = new Date(),
) {
  const statusCounts: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const cpv: Record<string, number> = {};
  const deadlineDistribution = {
    withDeadline: 0,
    withoutDeadline: 0,
    future: 0,
    past: 0,
  };
  const pubDates: Date[] = [];
  const deadlines: Date[] = [];
  let malformedActive = 0;
  let privateDataHits = 0;
  const duplicateKeyCounts: Record<string, number> = {};

  for (const row of rows) {
    bump(statusCounts, row.status);
    const key = `${row.source}::${row.externalRef ?? ""}`;
    bump(duplicateKeyCounts, key);

    for (const g of row.geographies ?? []) bump(countries, g);
    for (const s of row.services ?? []) bump(cpv, s);

    if (row.deadline) {
      deadlineDistribution.withDeadline += 1;
      deadlines.push(row.deadline);
      if (row.deadline.getTime() > now.getTime()) deadlineDistribution.future += 1;
      else deadlineDistribution.past += 1;
    } else {
      deadlineDistribution.withoutDeadline += 1;
    }

    const signals = row.signalsJson as Record<string, unknown> | null;
    const pubRaw =
      signals &&
      typeof signals === "object" &&
      signals.ted &&
      typeof signals.ted === "object" &&
      typeof (signals.ted as { publicationDate?: unknown }).publicationDate ===
        "string"
        ? (signals.ted as { publicationDate: string }).publicationDate
        : null;
    if (pubRaw) {
      const d = new Date(pubRaw.includes("T") ? pubRaw : pubRaw.replace(/([+-]\d{2}:?\d{2}|Z)$/i, ""));
      // Prefer ISO from signals when parseable; else skip
      const parsed = Number.isNaN(d.getTime())
        ? (() => {
            const m = pubRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            return m
              ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
              : null;
          })()
        : d;
      if (parsed && !Number.isNaN(parsed.getTime())) pubDates.push(parsed);
    }

    const blob = JSON.stringify({
      signalsJson: row.signalsJson,
      sponsorshipMeta: row.sponsorshipMeta,
    });
    if (PRIVATE_LEAK_RE.test(blob)) privateDataHits += 1;

    if (row.status === "ACTIVE") {
      const v = validateOpportunityIngest({
        title: row.title,
        summary: row.summary,
        category: row.category,
        industry: row.industry,
        services: row.services,
        industries: row.industries,
        geographies: row.geographies,
        certifications: row.certifications,
        status: row.status,
        source: row.source,
        externalRef: row.externalRef,
        sponsorshipMeta: row.sponsorshipMeta,
        signalsJson: row.signalsJson,
      });
      if (!v.ok) malformedActive += 1;
    }
  }

  const duplicatePairs = Object.entries(duplicateKeyCounts).filter(
    ([, n]) => n > 1,
  ).length;

  const sample = rows.slice(0, 10).map((r) => ({
    id: r.id,
    externalRef: r.externalRef,
    title: r.title.slice(0, 160),
    status: r.status,
    geographies: r.geographies,
    services: r.services.slice(0, 5),
    deadline: r.deadline?.toISOString() ?? null,
    contentHash: r.contentHash,
    source: r.source,
    sponsored: r.sponsored,
    hasTedAttribution:
      typeof r.signalsJson === "object" &&
      r.signalsJson !== null &&
      "ted" in (r.signalsJson as object),
  }));

  return {
    statusCounts,
    countries,
    cpv,
    deadlineDistribution,
    publicationDateOldest: pubDates.length
      ? new Date(Math.min(...pubDates.map((d) => d.getTime()))).toISOString()
      : null,
    publicationDateNewest: pubDates.length
      ? new Date(Math.max(...pubDates.map((d) => d.getTime()))).toISOString()
      : null,
    deadlineOldest: deadlines.length
      ? new Date(Math.min(...deadlines.map((d) => d.getTime()))).toISOString()
      : null,
    deadlineNearestFuture: (() => {
      const future = deadlines
        .filter((d) => d.getTime() > now.getTime())
        .sort((a, b) => a.getTime() - b.getTime());
      return future[0]?.toISOString() ?? null;
    })(),
    duplicatePairs,
    malformedActive,
    privateDataHits,
    sample,
    totalRows: rows.length,
  };
}

function evaluateVerdict(input: {
  dryRunVerdict: string;
  run1: TedIngestRunResult;
  run2: TedIngestRunResult;
  stored: ReturnType<typeof analyzeStoredRows>;
  runtimeErrors: RuntimeErrors;
  matchingEngineEnabled: boolean;
  sponsorshipGlobalOn: boolean;
  aiEnabled: boolean;
  tedSettingsEnabled: boolean;
  tedWorkerAllowed: boolean;
}): { verdict: LiveVerdict; failures: string[] } {
  const failures: string[] = [];
  if (input.dryRunVerdict !== "READY_FOR_LIVE_INGEST") {
    failures.push(`dry-run verdict ${input.dryRunVerdict}`);
  }
  if (!input.run1.ran || input.run1.upserted < 1) {
    failures.push("first ingest wrote zero opportunities");
  }
  if (input.run1.upsertErrors.length) {
    failures.push(`first ingest upsert errors: ${input.run1.upsertErrors.length}`);
  }
  if (input.run2.created > 0) {
    failures.push(
      `idempotency: second run created ${input.run2.created} new rows (expected 0)`,
    );
  }
  if (input.stored.duplicatePairs > 0) {
    failures.push(`duplicate (source, externalRef) pairs: ${input.stored.duplicatePairs}`);
  }
  if (input.stored.malformedActive > 0) {
    failures.push(`malformed ACTIVE rows: ${input.stored.malformedActive}`);
  }
  if (input.stored.privateDataHits > 0) {
    failures.push(`private Bidvera data patterns: ${input.stored.privateDataHits}`);
  }
  if (input.matchingEngineEnabled) {
    failures.push("Matching Engine became enabled (must stay off)");
  }
  if (input.sponsorshipGlobalOn) {
    failures.push("Sponsorship global became enabled");
  }
  if (input.aiEnabled) {
    failures.push("Matching AI became enabled");
  }
  if (input.tedSettingsEnabled || input.tedWorkerAllowed) {
    failures.push("TED settings/worker were persisted enabled");
  }
  if (
    input.runtimeErrors.database.length ||
    input.runtimeErrors.api.length ||
    input.runtimeErrors.other.length
  ) {
    failures.push("runtime errors recorded (see runtimeErrors)");
  }

  return {
    verdict: failures.length === 0 ? "LIVE_INGEST_VALIDATED" : "LIVE_INGEST_NOT_READY",
    failures,
  };
}

async function main() {
  const runtimeErrors: RuntimeErrors = { database: [], api: [], other: [] };
  const outDir = join(process.cwd(), "artifacts");
  mkdirSync(outDir, { recursive: true });

  // In-memory pilot settings for this one-shot only — never persist enabled/worker.
  const pilotBase = applyTedControlledPilotScope();
  const liveSettings = {
    ...pilotBase,
    enabled: true,
    workerScheduleAllowed: false,
  };

  console.log(`TED controlled live ingest: ${TED_CONTROLLED_PILOT_LABEL}`);
  console.log(
    `freshnessDays=${liveSettings.freshnessDays} requireDeadline=${liveSettings.requireDeadline}`,
  );
  console.log(
    `bounds max=${liveSettings.maxNoticesPerRun} page=${liveSettings.pageLimit} pages=${liveSettings.maxPagesPerRun}`,
  );
  console.log(
    "Safety: Matching Engine OFF | Sponsorship OFF | AI OFF | TED worker OFF | no recommendations",
  );

  // 1–3. Dry-run gate
  console.log("\n=== Dry-run gate ===");
  const dryRun = await runTedOpportunityDryRun({
    settings: pilotBase,
    previewLimit: 10,
  });
  writeFileSync(
    join(outDir, "ted-pilot-dry-run-report.json"),
    JSON.stringify(dryRun, null, 2),
    "utf8",
  );
  console.log(`qualityVerdict: ${dryRun.qualityVerdict}`);
  console.log(
    `fetched=${dryRun.fetched} accepted=${dryRun.acceptedCandidates} ACTIVE=${dryRun.activeCandidates}`,
  );

  if (dryRun.qualityVerdict !== "READY_FOR_LIVE_INGEST") {
    const abort = {
      mode: "aborted",
      reason: "dry-run qualityVerdict != READY_FOR_LIVE_INGEST",
      dryRunVerdict: dryRun.qualityVerdict,
      qualityFailures: dryRun.qualityEvaluation.failures,
      wroteToDatabase: false,
      verdict: "LIVE_INGEST_NOT_READY" as LiveVerdict,
    };
    writeFileSync(
      join(outDir, "ted-pilot-live-ingest-report.json"),
      JSON.stringify(abort, null, 2),
      "utf8",
    );
    console.error("ABORT: dry-run not READY_FOR_LIVE_INGEST");
    console.error(dryRun.qualityEvaluation.failures);
    process.exit(1);
  }

  // Snapshot before
  let beforeCount = 0;
  try {
    beforeCount = await prisma.matchingOpportunity.count({
      where: { source: TED_SOURCE },
    });
  } catch (e) {
    runtimeErrors.database.push(
      e instanceof Error ? e.message : "beforeCount failed",
    );
  }

  // 4–6. First live ingest
  console.log("\n=== Live ingest #1 ===");
  let run1: TedIngestRunResult;
  try {
    run1 = await runTedOpportunityIngest({
      settings: liveSettings,
      writeActiveOnly: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runtimeErrors.api.push(msg);
    run1 = {
      ran: false,
      fetched: 0,
      normalized: 0,
      filteredOut: 0,
      validationRejected: 0,
      draftSkipped: 0,
      accepted: 0,
      upserted: 0,
      created: 0,
      updated: 0,
      upsertErrors: [],
      malformed: 0,
      rejectionReasons: {},
      acceptedExternalRefs: [],
      skippedReason: msg,
    };
  }
  console.log(
    `fetched=${run1.fetched} accepted=${run1.accepted} created=${run1.created} updated=${run1.updated} upserted=${run1.upserted}`,
  );
  console.log(`rejected filter=${run1.filteredOut} validation=${run1.validationRejected} malformed=${run1.malformed} draftSkipped=${run1.draftSkipped}`);

  // Post-ingest analysis of this batch's refs (+ all TED if needed)
  let storedRows = await loadTedRows(run1.acceptedExternalRefs);
  if (!storedRows.length && run1.acceptedExternalRefs.length) {
    runtimeErrors.database.push("accepted refs not found after ingest #1");
  }
  let storedAnalysis = analyzeStoredRows(storedRows);

  // 7. Idempotency second run
  console.log("\n=== Live ingest #2 (idempotency) ===");
  let run2: TedIngestRunResult;
  try {
    run2 = await runTedOpportunityIngest({
      settings: liveSettings,
      writeActiveOnly: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runtimeErrors.api.push(`ingest#2: ${msg}`);
    run2 = {
      ran: false,
      fetched: 0,
      normalized: 0,
      filteredOut: 0,
      validationRejected: 0,
      draftSkipped: 0,
      accepted: 0,
      upserted: 0,
      created: 0,
      updated: 0,
      upsertErrors: [],
      malformed: 0,
      rejectionReasons: {},
      acceptedExternalRefs: [],
      skippedReason: msg,
    };
  }
  console.log(
    `fetched=${run2.fetched} accepted=${run2.accepted} created=${run2.created} updated=${run2.updated} upserted=${run2.upserted}`,
  );

  // Re-load stored for final sample
  const allRefs = [
    ...new Set([
      ...run1.acceptedExternalRefs,
      ...run2.acceptedExternalRefs,
    ]),
  ];
  storedRows = await loadTedRows(allRefs);
  storedAnalysis = analyzeStoredRows(storedRows);

  // Safety flags — read-only checks
  let matchingEngineEnabled = false;
  let sponsorshipGlobalOn = false;
  let aiEnabled = false;
  let tedSettingsEnabled = false;
  let tedWorkerAllowed = false;
  try {
    matchingEngineEnabled = await isMatchingEngineGloballyEnabled();
    sponsorshipGlobalOn = await isMatchingSponsorshipGloballyEnabled();
    const ai = await getMatchingAiRuntimeConfig();
    aiEnabled = Boolean(ai.enabled);
    const tedPersisted = await getTedPublicSettings();
    tedSettingsEnabled = tedPersisted.enabled;
    tedWorkerAllowed = tedPersisted.workerScheduleAllowed;
  } catch (e) {
    runtimeErrors.other.push(
      e instanceof Error ? e.message : "safety flag check failed",
    );
  }

  // Duplicate uniqueness check via DB group
  let uniqueViolationProbe = 0;
  try {
    const grouped = await prisma.$queryRaw<
      { source: string; externalRef: string; c: bigint }[]
    >`
      SELECT source, "externalRef", COUNT(*)::bigint AS c
      FROM "MatchingOpportunity"
      WHERE source = ${TED_SOURCE}
        AND "externalRef" IS NOT NULL
      GROUP BY source, "externalRef"
      HAVING COUNT(*) > 1
    `;
    uniqueViolationProbe = grouped.length;
  } catch (e) {
    // Fallback if raw SQL fails — use in-memory analysis
    runtimeErrors.database.push(
      e instanceof Error
        ? `duplicate probe: ${e.message}`
        : "duplicate probe failed",
    );
    uniqueViolationProbe = storedAnalysis.duplicatePairs;
  }

  const { verdict, failures } = evaluateVerdict({
    dryRunVerdict: dryRun.qualityVerdict,
    run1,
    run2,
    stored: {
      ...storedAnalysis,
      duplicatePairs: Math.max(
        storedAnalysis.duplicatePairs,
        uniqueViolationProbe,
      ),
    },
    runtimeErrors,
    matchingEngineEnabled,
    sponsorshipGlobalOn,
    aiEnabled,
    tedSettingsEnabled,
    tedWorkerAllowed,
  });

  const afterCount = await prisma.matchingOpportunity
    .count({ where: { source: TED_SOURCE } })
    .catch((e) => {
      runtimeErrors.database.push(
        e instanceof Error ? e.message : "afterCount failed",
      );
      return beforeCount;
    });

  const report = {
    mode: "controlled-live-ingest",
    label: TED_CONTROLLED_PILOT_LABEL,
    wroteToDatabase: true,
    recommendationsCreated: false,
    matchingEngineEnabled,
    sponsorshipGlobalOn,
    matchingAiEnabled: aiEnabled,
    tedSettingsPersistedEnabled: tedSettingsEnabled,
    tedWorkerScheduleAllowed: tedWorkerAllowed,
    configuration: {
      freshnessDays: liveSettings.freshnessDays,
      requireDeadline: liveSettings.requireDeadline,
      cpvFilters: liveSettings.cpvFilters,
      geographies: liveSettings.geographies,
      maxNoticesPerRun: liveSettings.maxNoticesPerRun,
      pageLimit: liveSettings.pageLimit,
      maxPagesPerRun: liveSettings.maxPagesPerRun,
      writeActiveOnly: true,
    },
    dryRun: {
      qualityVerdict: dryRun.qualityVerdict,
      fetched: dryRun.fetched,
      acceptedCandidates: dryRun.acceptedCandidates,
      activeCandidates: dryRun.activeCandidates,
      filteredOut: dryRun.filteredOut,
      query: dryRun.query,
    },
    ingest1: {
      fetched: run1.fetched,
      normalized: run1.normalized,
      accepted: run1.accepted,
      rejected:
        run1.filteredOut +
        run1.validationRejected +
        run1.malformed +
        run1.draftSkipped,
      filteredOut: run1.filteredOut,
      validationRejected: run1.validationRejected,
      malformed: run1.malformed,
      draftSkipped: run1.draftSkipped,
      created: run1.created,
      updated: run1.updated,
      upserted: run1.upserted,
      upsertErrors: run1.upsertErrors,
      rejectionReasons: run1.rejectionReasons,
    },
    ingest2Idempotency: {
      fetched: run2.fetched,
      accepted: run2.accepted,
      created: run2.created,
      updated: run2.updated,
      upserted: run2.upserted,
      upsertErrors: run2.upsertErrors,
      rejectionReasons: run2.rejectionReasons,
    },
    database: {
      tedRowsBefore: beforeCount,
      tedRowsAfter: afterCount,
      matchingOpportunityCreated: run1.created,
      matchingOpportunityUpdated: run1.updated,
      rowsInBatchSampled: storedAnalysis.totalRows,
      statusCounts: storedAnalysis.statusCounts,
      countries: storedAnalysis.countries,
      cpvDistribution: storedAnalysis.cpv,
      deadlineDistribution: storedAnalysis.deadlineDistribution,
      publicationDateOldest: storedAnalysis.publicationDateOldest,
      publicationDateNewest: storedAnalysis.publicationDateNewest,
      deadlineOldest: storedAnalysis.deadlineOldest,
      deadlineNearestFuture: storedAnalysis.deadlineNearestFuture,
      duplicateSourceExternalRefPairs: uniqueViolationProbe,
      privateDataHits: storedAnalysis.privateDataHits,
      malformedActive: storedAnalysis.malformedActive,
      sample10: storedAnalysis.sample,
    },
    runtimeErrors,
    dataQualityFailures: failures.filter(
      (f) =>
        !f.includes("runtime errors") &&
        !f.includes("Matching Engine") &&
        !f.includes("Sponsorship") &&
        !f.includes("Matching AI") &&
        !f.includes("TED settings"),
    ),
    safetyFailures: failures.filter(
      (f) =>
        f.includes("Matching Engine") ||
        f.includes("Sponsorship") ||
        f.includes("Matching AI") ||
        f.includes("TED settings") ||
        f.includes("runtime errors"),
    ),
    verdict,
    failures,
  };

  const outPath = join(outDir, "ted-pilot-live-ingest-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== Final report ===");
  console.log(`verdict: ${verdict}`);
  console.log(`TED rows before/after: ${beforeCount} → ${afterCount}`);
  console.log(
    `created=${run1.created} updated(run1)=${run1.updated} created(run2)=${run2.created} updated(run2)=${run2.updated}`,
  );
  console.log(
    `countries: ${JSON.stringify(storedAnalysis.countries)}`,
  );
  console.log(
    `malformed ACTIVE=${storedAnalysis.malformedActive} privateDataHits=${storedAnalysis.privateDataHits} dupPairs=${uniqueViolationProbe}`,
  );
  if (failures.length) console.log("failures:", failures);
  console.log(`Report: ${outPath}`);

  if (verdict !== "LIVE_INGEST_VALIDATED") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
