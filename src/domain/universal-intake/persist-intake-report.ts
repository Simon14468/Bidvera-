/**
 * Persist / load canonical IntakeReport alongside tender uploads.
 * Uses local storage root (same tree as documents) — no invented content.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { IntakeReport } from "./intake-report";

function reportPath(companyId: string, tenderId: string): string {
  const root = process.env.STORAGE_ROOT ?? path.join(process.cwd(), ".data", "uploads");
  return path.join(root, companyId, tenderId, "intake-report.json");
}

export async function persistIntakeReport(input: {
  companyId: string;
  tenderId: string;
  report: IntakeReport;
}): Promise<string> {
  const full = reportPath(input.companyId, input.tenderId);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(input.report), "utf8");
  return `${input.companyId}/${input.tenderId}/intake-report.json`;
}

export async function loadIntakeReport(
  companyId: string,
  tenderId: string,
): Promise<IntakeReport | null> {
  try {
    const raw = await fs.readFile(reportPath(companyId, tenderId), "utf8");
    const parsed = JSON.parse(raw) as IntakeReport;
    if (parsed?.reportVersion !== "intake-report/v1") return null;
    return parsed;
  } catch {
    return null;
  }
}
