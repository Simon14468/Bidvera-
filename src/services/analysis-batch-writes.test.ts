import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYSIS_WRITE_CHUNK_SIZE,
  buildEvidenceFoundBatchRows,
  buildSeedSideEffectRows,
  chunkArray,
} from "@/services/analysis-batch-writes";

describe("analysis-batch-writes chunking", () => {
  it("chunks 282 items into bounded batches", () => {
    const items = Array.from({ length: 282 }, (_, i) => i);
    const chunks = chunkArray(items, ANALYSIS_WRITE_CHUNK_SIZE);
    assert.equal(chunks.length, Math.ceil(282 / ANALYSIS_WRITE_CHUNK_SIZE));
    assert.equal(
      chunks.reduce((n, c) => n + c.length, 0),
      282,
    );
    assert.ok(chunks.every((c) => c.length <= ANALYSIS_WRITE_CHUNK_SIZE));
  });
});

describe("buildSeedSideEffectRows — 282-task logical parity", () => {
  it("emits one CREATED event per task and verify audits for :verify: keys only", () => {
    const companyId = "co_a";
    const tenderId = "t_a";
    const candidates = Array.from({ length: 282 }, (_, i) => {
      const isVerify = i < 143;
      const isRisk = i === 281;
      return {
        dedupeKey: isRisk
          ? `${companyId}:${tenderId}:RISK_MITIGATION:r1`
          : isVerify
            ? `${companyId}:${tenderId}:EVIDENCE_REQUEST:verify:req_${i}`
            : `${companyId}:${tenderId}:EVIDENCE_REQUEST:req_${i}`,
        kind: isRisk ? "RISK_MITIGATION" : "EVIDENCE_REQUEST",
        title: `Task ${i}`,
        requirementId: isRisk ? null : `req_${i}`,
      };
    });

    const tasksByDedupeKey = new Map(
      candidates.map((c, i) => [
        c.dedupeKey,
        {
          id: `task_${i}`,
          kind: c.kind,
          title: c.title,
          requirementId: c.requirementId,
        },
      ]),
    );

    const { events, verificationAudits, auditLogs } = buildSeedSideEffectRows({
      companyId,
      tenderId,
      actorUserId: null,
      candidatesInOrder: candidates,
      tasksByDedupeKey,
    });

    assert.equal(events.length, 282);
    assert.equal(verificationAudits.length, 143);
    assert.equal(auditLogs.length, 143);
    assert.ok(events.every((e) => e.eventType === "CREATED"));
    assert.ok(
      verificationAudits.every((a) => a.action === "VERIFICATION_REQUESTED"),
    );
    assert.equal(
      new Set(events.map((e) => e.taskId)).size,
      282,
      "events reference distinct tasks",
    );
    assert.ok(
      verificationAudits.every((a) => a.companyId === companyId && a.tenderId === tenderId),
    );
  });

  it("skips side effects when task was not inserted (idempotent race)", () => {
    const { events, verificationAudits } = buildSeedSideEffectRows({
      companyId: "co",
      tenderId: "t",
      actorUserId: null,
      candidatesInOrder: [
        {
          dedupeKey: "co:t:EVIDENCE_REQUEST:verify:r1",
          kind: "EVIDENCE_REQUEST",
          title: "x",
          requirementId: "r1",
        },
      ],
      tasksByDedupeKey: new Map(),
    });
    assert.equal(events.length, 0);
    assert.equal(verificationAudits.length, 0);
  });
});

describe("buildEvidenceFoundBatchRows — 143 audits", () => {
  it("preserves one audit + one AuditLog row per evidence item", () => {
    const items = Array.from({ length: 143 }, (_, i) => ({
      requirementId: `req_${i}`,
      evidenceId: `ev_${i}`,
      sourcePage: i % 10,
      documentId: i % 2 === 0 ? `doc_${i}` : null,
    }));
    const { audits, auditLogs } = buildEvidenceFoundBatchRows({
      companyId: "co_a",
      tenderId: "t_a",
      items,
    });
    assert.equal(audits.length, 143);
    assert.equal(auditLogs.length, 143);
    assert.ok(audits.every((a) => a.action === "EVIDENCE_FOUND"));
    assert.ok(auditLogs.every((a) => a.action === "EVIDENCE_FOUND"));
    assert.equal(audits[0]!.snapshot.documentId, "doc_0");
    assert.equal(audits[1]!.snapshot.documentId, null);
  });
});

describe("batch write source contracts", () => {
  it("seed and evidence services use createMany batching", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();
    const seedSrc = await fs.readFile(
      path.join(root, "src/services/team-workflow/index.ts"),
      "utf8",
    );
    const evidenceSrc = await fs.readFile(
      path.join(root, "src/services/evidence-verification/index.ts"),
      "utf8",
    );
    assert.match(seedSrc, /teamWorkflowTask\.createMany/);
    assert.match(seedSrc, /teamWorkflowEvent\.createMany/);
    assert.match(seedSrc, /requirementVerificationAudit\.createMany/);
    assert.match(seedSrc, /taskSeedDurationMs/);
    assert.match(evidenceSrc, /requirementVerificationAudit\.createMany/);
    assert.match(evidenceSrc, /evidence\.audit_batch/);
    assert.doesNotMatch(
      seedSrc.slice(seedSrc.indexOf("export async function seedTeamTasksFromAnalysis")),
      /for \(const c of candidates\) \{\s*try \{\s*const task = await prisma\.teamWorkflowTask\.create/,
    );
  });
});
