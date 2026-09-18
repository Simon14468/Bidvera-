/**
 * Explicit public entry point for Tender Analysis runtime operations.
 * Thin wrappers — zero behavior change to the existing pipeline.
 */

import {
  getTenderAnalysisStatus as getTenderAnalysisStatusImpl,
  uploadAndQueueTenderPackage as uploadAndQueueTenderPackageImpl,
} from "@/application/tender-service";
import { processTenderAnalysis as processTenderAnalysisImpl } from "@/services/tender-processing";

export async function processTenderAnalysis(tenderId: string): Promise<void> {
  return processTenderAnalysisImpl(tenderId);
}

export async function uploadAndQueueTenderPackage(
  ...args: Parameters<typeof uploadAndQueueTenderPackageImpl>
): ReturnType<typeof uploadAndQueueTenderPackageImpl> {
  return uploadAndQueueTenderPackageImpl(...args);
}

export async function getTenderAnalysisStatus(
  ...args: Parameters<typeof getTenderAnalysisStatusImpl>
): ReturnType<typeof getTenderAnalysisStatusImpl> {
  return getTenderAnalysisStatusImpl(...args);
}
