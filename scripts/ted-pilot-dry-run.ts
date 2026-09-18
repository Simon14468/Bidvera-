/**
 * Controlled TED pilot dry-run — live Search API, NO database writes.
 * Usage: npx tsx scripts/ted-pilot-dry-run.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  applyTedControlledPilotScope,
  runTedOpportunityDryRun,
  TED_CONTROLLED_PILOT_LABEL,
} from "../src/modules/matching-engine/ted";

async function main() {
  const settings = applyTedControlledPilotScope();

  console.log(`TED pilot dry-run: ${TED_CONTROLLED_PILOT_LABEL}`);
  console.log(`freshnessDays: ${settings.freshnessDays}`);
  console.log(`requireDeadline: ${settings.requireDeadline}`);
  console.log(`cpvFilters: ${settings.cpvFilters.join(", ")}`);
  console.log(`geographies: ${settings.geographies.join(", ")}`);
  console.log(
    `bounds: max=${settings.maxNoticesPerRun} page=${settings.pageLimit} pages=${settings.maxPagesPerRun}`,
  );
  console.log("Matching Engine: untouched | DB writes: none");

  const report = await runTedOpportunityDryRun({
    settings,
    previewLimit: 10,
  });

  const outDir = join(process.cwd(), "artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "ted-pilot-dry-run-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== Summary ===");
  console.log(`query: ${report.query}`);
  console.log(`fetched: ${report.fetched}`);
  console.log(`ACTIVE candidates: ${report.activeCandidates}`);
  console.log(`acceptedCandidates: ${report.acceptedCandidates}`);
  console.log(`filteredOut: ${report.filteredOut}`);
  console.log(`malformed: ${report.malformed}`);
  console.log(`qualityVerdict: ${report.qualityVerdict}`);
  console.log(`deadlineCoveragePct: ${report.quality.deadlineCoveragePct.toFixed(1)}%`);
  console.log(
    `freshnessCompliancePct: ${
      report.quality.freshnessCompliancePct == null
        ? "n/a"
        : `${report.quality.freshnessCompliancePct.toFixed(1)}%`
    }`,
  );
  console.log(`freshnessCutoffYmd: ${report.quality.freshnessCutoffYmd}`);
  console.log(
    `pub range: ${report.quality.publicationDateMin} .. ${report.quality.publicationDateMax}`,
  );
  console.log("countriesWithHits:", report.quality.countriesWithHits.join(", ") || "(none)");
  console.log(
    "zeroResultCountries:",
    report.quality.zeroResultCountries.join(", ") || "(none)",
  );
  console.log("quality failures:", report.qualityEvaluation.failures);
  console.log("\nTop CPV:");
  for (const [k, v] of Object.entries(report.cpvDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nRejection reasons:");
  for (const [k, v] of Object.entries(report.rejectionReasons).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nPreview: ${report.preview.length}`);
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
