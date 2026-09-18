/**
 * Tender Analysis module isolation — boundary and identity invariants.
 * Does not alter pipeline behavior; proves the public façade and ownership map.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  TENDER_ANALYSIS_FEATURE_KEY,
  TENDER_ANALYSIS_MODULE_ID,
  TENDER_ANALYSIS_MODULE_NAME,
  TENDER_ANALYSIS_OWNED_PACKAGES,
  TENDER_ANALYSIS_PIPELINE,
  TENDER_ANALYSIS_OWNERSHIP,
} from "@/modules/tender-analysis";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("tender-analysis module identity", () => {
  it("exposes a stable module id and feature key", () => {
    assert.equal(TENDER_ANALYSIS_MODULE_ID, "tender-analysis");
    assert.equal(TENDER_ANALYSIS_FEATURE_KEY, "tender_analysis");
    assert.equal(TENDER_ANALYSIS_MODULE_NAME, "Tender Analysis");
    assert.equal(TENDER_ANALYSIS_OWNERSHIP.moduleId, TENDER_ANALYSIS_MODULE_ID);
  });

  it("preserves the full analysis pipeline order", () => {
    assert.deepEqual([...TENDER_ANALYSIS_PIPELINE], [
      "UDI",
      "UTI",
      "STI",
      "Admission",
      "Canonical",
      "Evidence",
      "Risk",
      "Decision",
      "Guardian",
      "Snapshot",
      "Certification",
    ]);
  });

  it("declares owned packages covering the pipeline layers", () => {
    const owned = new Set(TENDER_ANALYSIS_OWNED_PACKAGES);
    for (const pkg of [
      "src/domain/document-intelligence",
      "src/domain/universal-tender-intelligence",
      "src/domain/semantic-tender-intelligence",
      "src/domain/tender-requirements",
      "src/domain/evidence-intelligence",
      "src/domain/risk",
      "src/domain/decision",
      "src/domain/decision-validation",
      "src/domain/tender-intelligence",
      "src/domain/tender-certification",
      "src/services/tender-processing",
      "src/app/(app)/tenders",
    ]) {
      assert.ok(owned.has(pkg as never), `missing ownership for ${pkg}`);
    }
  });
});

describe("tender-analysis public entry wiring", () => {
  it("production actions and worker import the module entry, not processing internals", () => {
    const actions = readSrc("src/app/actions.ts");
    const worker = readSrc("src/worker/index.ts");
    assert.match(actions, /from ["']@\/modules\/tender-analysis["']/);
    assert.match(worker, /from ["']@\/modules\/tender-analysis["']/);
    assert.doesNotMatch(actions, /from ["']@\/services\/tender-processing["']/);
    assert.doesNotMatch(worker, /from ["']@\/services\/tender-processing["']/);
  });

  it("usage gate resolves Tender Analysis via the module availability check", () => {
    const usage = readSrc("src/services/usage/index.ts");
    assert.match(usage, /isTenderAnalysisAvailable/);
    assert.match(usage, /@\/modules\/tender-analysis/);
  });

  it("app layout and tender routes gate on the module", () => {
    const layout = readSrc("src/app/(app)/layout.tsx");
    const tenders = readSrc("src/app/(app)/tenders/page.tsx");
    const upload = readSrc("src/app/(app)/tenders/upload/page.tsx");
    assert.match(layout, /isTenderAnalysisAvailable/);
    assert.match(tenders, /requireTenderAnalysisModule/);
    assert.match(upload, /requireTenderAnalysisModule/);
  });

  it("eslint forbids importing module internals from outside the module", () => {
    const eslint = readSrc("eslint.config.mjs");
    assert.match(eslint, /tender-analysis\/internal/);
    assert.match(eslint, /module-private/);
  });
});
