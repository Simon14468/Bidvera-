/**
 * Canonical analysis phase strings persisted on Tender.analysisPhase.
 * Legacy phase names remain in progress maps for in-flight analyses.
 */

export const ANALYSIS_PHASE = {
  READING_PDF: "READING_PDF",
  NATIVE_EXTRACT: "NATIVE_EXTRACT",
  OCR: "OCR",
  NORMALIZE: "NORMALIZE",
  CLASSIFYING: "CLASSIFYING",
  /** Legacy — mapped to same progress as UNDERSTANDING */
  ANALYZING_REQUIREMENTS: "ANALYZING_REQUIREMENTS",
  UNDERSTANDING: "UNDERSTANDING",
  /** Legacy — mapped to same progress as MATCHING */
  MATCHING_COMPANY: "MATCHING_COMPANY",
  MATCHING: "MATCHING",
  EVALUATING: "EVALUATING",
  /** Legacy — mapped to same progress as FINALIZING */
  BUILDING_REPORT: "BUILDING_REPORT",
  BUILDING_INTELLIGENCE: "BUILDING_INTELLIGENCE",
  FINALIZING: "FINALIZING",
  COMPLETE: "COMPLETE",
  COMPANY_KNOWLEDGE_ONLY: "COMPANY_KNOWLEDGE_ONLY",
  NOTICE_ONLY: "NOTICE_ONLY",
} as const;

export type AnalysisPhaseValue =
  (typeof ANALYSIS_PHASE)[keyof typeof ANALYSIS_PHASE];

/** User-visible progress — must reflect real pipeline stages, not fake advancement. */
export const PHASE_PROGRESS: Record<string, number> = {
  [ANALYSIS_PHASE.READING_PDF]: 12,
  [ANALYSIS_PHASE.NATIVE_EXTRACT]: 22,
  [ANALYSIS_PHASE.OCR]: 30,
  [ANALYSIS_PHASE.NORMALIZE]: 36,
  [ANALYSIS_PHASE.CLASSIFYING]: 42,
  [ANALYSIS_PHASE.ANALYZING_REQUIREMENTS]: 52,
  [ANALYSIS_PHASE.UNDERSTANDING]: 52,
  [ANALYSIS_PHASE.MATCHING_COMPANY]: 62,
  [ANALYSIS_PHASE.MATCHING]: 62,
  [ANALYSIS_PHASE.EVALUATING]: 72,
  [ANALYSIS_PHASE.BUILDING_INTELLIGENCE]: 82,
  [ANALYSIS_PHASE.BUILDING_REPORT]: 90,
  [ANALYSIS_PHASE.FINALIZING]: 94,
  [ANALYSIS_PHASE.COMPLETE]: 100,
  [ANALYSIS_PHASE.COMPANY_KNOWLEDGE_ONLY]: 100,
  [ANALYSIS_PHASE.NOTICE_ONLY]: 100,
};

export const PHASE_MESSAGE: Record<string, string> = {
  [ANALYSIS_PHASE.READING_PDF]: "Reading PDF…",
  [ANALYSIS_PHASE.NATIVE_EXTRACT]: "Extracting text…",
  [ANALYSIS_PHASE.OCR]: "Running OCR on scanned pages…",
  [ANALYSIS_PHASE.NORMALIZE]: "Normalizing extracted text…",
  [ANALYSIS_PHASE.CLASSIFYING]: "Classifying document…",
  [ANALYSIS_PHASE.ANALYZING_REQUIREMENTS]: "Understanding requirements…",
  [ANALYSIS_PHASE.UNDERSTANDING]: "Understanding requirements…",
  [ANALYSIS_PHASE.MATCHING_COMPANY]: "Matching company profile…",
  [ANALYSIS_PHASE.MATCHING]: "Matching company profile…",
  [ANALYSIS_PHASE.EVALUATING]: "Evaluating fit and risks…",
  [ANALYSIS_PHASE.BUILDING_INTELLIGENCE]: "Building intelligence report…",
  [ANALYSIS_PHASE.BUILDING_REPORT]: "Building report…",
  [ANALYSIS_PHASE.FINALIZING]: "Finalizing decision…",
  [ANALYSIS_PHASE.COMPLETE]: "Complete",
};

export function progressForPhase(
  analysisPhase: string | null | undefined,
  analysisStatus: string,
): number {
  const statusProgress: Record<string, number> = {
    UPLOADING: 8,
    PROCESSING: 18,
    EXTRACTING: 35,
    ANALYZING: 70,
    COMPLETED: 100,
    FAILED: 100,
  };
  return (
    (analysisPhase && PHASE_PROGRESS[analysisPhase]) ||
    statusProgress[analysisStatus] ||
    0
  );
}

export function messageForPhase(
  analysisPhase: string | null | undefined,
  analysisStatus: string,
  analysisError: string | null,
  decisionLabel: string | null | undefined,
): string {
  if (analysisStatus === "FAILED") {
    return analysisError ?? "Analysis failed";
  }
  if (analysisStatus === "COMPLETED") {
    return `Decision: ${decisionLabel ?? "ready"}`;
  }
  return (
    PHASE_MESSAGE[analysisPhase ?? ""] ?? `Status: ${analysisStatus}`
  );
}
