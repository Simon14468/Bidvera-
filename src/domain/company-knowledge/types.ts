/**
 * Structured company knowledge extracted from uploaded documents.
 * Every important fact carries provenance — no source → no factual claim.
 */

export type DocumentKind =
  | "COMPANY_PROFILE"
  | "TENDER"
  | "SUPPORTING_EVIDENCE"
  | "HISTORICAL_OUTCOME"
  | "UNKNOWN";

export type ProvenanceStatus = "VERIFIED" | "INFERRED" | "UNKNOWN";

export type FactProvenance = {
  sourceDocument: string;
  page: number | "UNKNOWN";
  section: string | null;
  originalValue: string;
  normalizedValue: string | null;
  confidence: ProvenanceStatus;
  excerpt: string | null;
};

export type ProvenancedFact = {
  key: string;
  value: string;
  provenance: FactProvenance;
};

export type NormalizedCapability = {
  originalValue: string;
  normalizedValue: string;
  provenance: FactProvenance;
};

export type ProjectReference = {
  name: string;
  clientSector: string | null;
  description: string | null;
  approximateValue: string | null;
  duration: string | null;
  status: string | null;
  technologies: string[];
  provenance: FactProvenance;
};

export type ComplianceEvidenceItem = {
  name: string;
  /** AVAILABLE | NOT_HELD | VERIFY */
  status: "AVAILABLE" | "NOT_HELD" | "VERIFY";
  detail: string | null;
  provenance: FactProvenance;
};

export type HistoricalOutcomeRecord = {
  opportunity: string;
  sector: string | null;
  opportunityType: string | null;
  approximateValue: string | null;
  capabilities: string[];
  requirements: string | null;
  /** WON | LOST | DID_NOT_BID | UNKNOWN */
  outcome: "WON" | "LOST" | "DID_NOT_BID" | "UNKNOWN";
  reason: string | null;
  provenance: FactProvenance;
  /** Always starts as CANDIDATE until global validation thresholds are met */
  lifecycle: "CANDIDATE" | "VALIDATING" | "VERIFIED" | "ACTIVE";
};

export type CompanyKnowledge = {
  documentKind: DocumentKind;
  classificationConfidence: number;
  classificationSignals: string[];
  identity: {
    companyName: string | null;
    legalStructure: string | null;
    industry: string | null;
    sector: string | null;
    location: string | null;
    country: string | null;
    companySize: string | null;
    employees: number | null;
    foundedYear: number | null;
    experienceYears: number | null;
  };
  services: NormalizedCapability[];
  capabilities: NormalizedCapability[];
  technologies: ProvenancedFact[];
  projects: ProjectReference[];
  certifications: ComplianceEvidenceItem[];
  policies: ComplianceEvidenceItem[];
  insurance: ComplianceEvidenceItem[];
  geographicCoverage: ProvenancedFact[];
  contractCapacity: {
    preferredMin: string | null;
    preferredMax: string | null;
    /** Numeric MAD approx when parseable — never invent */
    preferredMaxNumeric: number | null;
    notes: string | null;
    provenance: FactProvenance | null;
  };
  /** Team / delivery capacity signals extracted from company evidence */
  operationalCapacity: {
    totalEmployees: number | null;
    developers: number | null;
    projectManagers: number | null;
    qa: number | null;
    typicalConcurrentProjects: string | null;
    typicalDuration: string | null;
    /** Parsed month range from typicalDuration when available */
    typicalDurationMonthsMin: number | null;
    typicalDurationMonthsMax: number | null;
    notes: string[];
    provenance: FactProvenance | null;
  };
  strengths: ProvenancedFact[];
  limitations: ProvenancedFact[];
  tenderPreferences: ProvenancedFact[];
  historicalOutcomes: HistoricalOutcomeRecord[];
  /** Free-form preserved facts that did not fit a typed field */
  extraFacts: ProvenancedFact[];
  sourceDocuments: string[];
  extractedAt: string;
};

export type RequirementMatchResult = {
  requirementId?: string;
  requirement: string;
  status: "MATCHED" | "UNCERTAIN" | "FAILED" | "MISSING";
  evidence: string | null;
  sourceDocument: string | null;
  page: number | "UNKNOWN" | null;
  section: string | null;
  rationale: string;
};

export type AnalysisTraceStep = {
  field: string;
  finalValue: unknown;
  rule: string;
  structuredInput: unknown;
  sourceDocument: string | null;
  page: number | "UNKNOWN" | null;
  section: string | null;
  originalExcerpt: string | null;
};

export type AnalysisTrace = {
  documentKind: DocumentKind;
  steps: AnalysisTraceStep[];
  invariantsChecked: string[];
  generatedAt: string;
};

export const COMPANY_ONLY_MESSAGE =
  "Company information successfully extracted. Tender requirements are not available. Upload a Tender/RFP to run Bidvera decision analysis.";

export const HISTORICAL_CANDIDATE_HEADLINE =
  "Historical signal available, but no verified pattern is established.";
