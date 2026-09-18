/**
 * Feature 7A — Questionnaire Assistant focused tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  detectMandatoryStatus,
  extractQuestionsFromDocuments,
  generateDraftAnswers,
  inferQuestionType,
} from "@/domain/questionnaire-assistant";
import {
  QUESTIONNAIRE_ASSISTANT_FEATURE_KEY,
  QUESTIONNAIRE_ASSISTANT_MODULE_ID,
} from "@/modules/questionnaire-assistant";
import {
  ENTITLEMENT_FEATURE_KEYS,
  PLAN_ENTITLEMENT_DEFAULTS,
} from "@/domain/billing/entitlement-catalog";
import type { CompanyKnowledge } from "@/domain/company-knowledge/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function emptyKnowledge(overrides: Partial<CompanyKnowledge> = {}): CompanyKnowledge {
  return {
    documentKind: "COMPANY_PROFILE",
    classificationConfidence: 1,
    classificationSignals: [],
    identity: {
      companyName: "Atlas Facilities",
      legalStructure: null,
      industry: "Facilities",
      sector: null,
      location: "Casablanca",
      country: "Morocco",
      companySize: null,
      employees: 120,
      foundedYear: null,
      experienceYears: 10,
    },
    services: [],
    capabilities: [],
    technologies: [],
    projects: [],
    certifications: [
      {
        name: "ISO 9001",
        status: "AVAILABLE",
        detail: "ISO 9001:2015 certified",
        provenance: {
          sourceDocument: "certificates.pdf",
          page: 1,
          section: "Certifications",
          originalValue: "ISO 9001:2015",
          normalizedValue: "iso 9001",
          confidence: "VERIFIED",
          excerpt: "ISO 9001:2015 certified",
        },
      },
    ],
    policies: [],
    insurance: [],
    geographicCoverage: [],
    contractCapacity: {
      preferredMin: null,
      preferredMax: null,
      preferredMaxNumeric: null,
      notes: null,
      provenance: null,
    },
    operationalCapacity: {
      totalEmployees: 120,
      developers: null,
      projectManagers: null,
      qa: null,
      typicalConcurrentProjects: null,
      typicalDuration: null,
      typicalDurationMonthsMin: null,
      typicalDurationMonthsMax: null,
      notes: [],
      provenance: null,
    },
    strengths: [],
    limitations: [],
    tenderPreferences: [],
    historicalOutcomes: [],
    extraFacts: [],
    sourceDocuments: ["certificates.pdf"],
    extractedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("questionnaire-assistant identity", () => {
  it("registers module feature key on paid plans", () => {
    assert.equal(QUESTIONNAIRE_ASSISTANT_MODULE_ID, "questionnaire-assistant");
    assert.equal(QUESTIONNAIRE_ASSISTANT_FEATURE_KEY, "questionnaire_assistant");
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("questionnaire_assistant"));
    assert.ok(PLAN_ENTITLEMENT_DEFAULTS.starter!.includes("questionnaire_assistant"));
    assert.ok(!PLAN_ENTITLEMENT_DEFAULTS.trial!.includes("questionnaire_assistant"));
  });

  it("does not import Tender Analysis internals or mutate decision evidence", () => {
    const service = readSrc("src/modules/questionnaire-assistant/internal/service.ts");
    assert.doesNotMatch(service, /tender-processing|processTenderAnalysis|semantic-tender-intelligence\/internal/);
    assert.doesNotMatch(service, /prisma\.tenderDecision\.update|CONFIRMED_FIT/);
    const draft = readSrc("src/domain/questionnaire-assistant/draft.ts");
    assert.match(draft, /VERIFY/);
    assert.match(draft, /matchRequirementToKnowledge/);
    assert.doesNotMatch(draft, /openai|anthropic|gpt-/i);
  });
  it("wires sidebar Lock and tender-scoped UI routes", () => {
    const sidebar = readSrc("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /questionnaireAssistant/);
    assert.match(sidebar, /\/questionnaire-assistant/);
    const hub = readSrc("src/app/(app)/questionnaire-assistant/page.tsx");
    assert.match(hub, /requireQuestionnaireAssistantModule/);
    const workbench = readSrc(
      "src/app/(app)/questionnaire-assistant/questionnaire-workbench.tsx",
    );
    assert.match(workbench, /AI draft answer/);
    assert.match(workbench, /not verified/);
    assert.match(workbench, /Needs verification|VERIFY/);
    assert.match(workbench, /Approve/);
    assert.match(workbench, /Reject/);
    assert.match(workbench, /Edit/);
    assert.match(
      workbench,
      /\/api\/questionnaire-assistant\/tenders\//,
    );
    const badges = readSrc(
      "src/modules/questionnaire-assistant/ui/badges.tsx",
    );
    assert.match(badges, /AI draft — not verified/);
    assert.match(badges, /Needs verification/);
  });
});

describe("mandatory vs optional", () => {
  it("marks explicit required/asterisk as MANDATORY", () => {
    assert.equal(detectMandatoryStatus("Company registration number *"), "MANDATORY");
    assert.equal(detectMandatoryStatus("Insurance certificate [required]"), "MANDATORY");
    assert.equal(detectMandatoryStatus("This field is mandatory"), "MANDATORY");
  });

  it("marks explicit optional signals as OPTIONAL", () => {
    assert.equal(detectMandatoryStatus("Additional awards [optional]"), "OPTIONAL");
    assert.equal(detectMandatoryStatus("Provide details if applicable"), "OPTIONAL");
  });

  it("does not infer mandatory from weak wording alone", () => {
    assert.equal(detectMandatoryStatus("Please describe your services"), "UNKNOWN");
    assert.equal(detectMandatoryStatus("You should list key staff"), "UNKNOWN");
  });
});

describe("multi-file provenance", () => {
  it("preserves source document names across files", () => {
    const result = extractQuestionsFromDocuments([
      {
        id: "doc-a",
        fileName: "technical-questionnaire.pdf",
        mimeType: "application/pdf",
        pageCount: 2,
        extractionMeta: null,
        extractedText: [
          "Section 1: Company details",
          "1. What is your company legal name?",
          "2. Do you hold ISO 9001? Yes / No *",
        ].join("\n"),
      },
      {
        id: "doc-b",
        fileName: "financial-questionnaire.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pageCount: null,
        extractionMeta: null,
        extractedText: [
          "Sheet: Finance",
          "1. What was your turnover last year?",
          "2. Provide audited accounts?",
        ].join("\n"),
      },
    ]);
    assert.ok(result.questions.length >= 3);
    const names = new Set(result.questions.map((q) => q.provenance.sourceDocumentName));
    assert.ok(names.has("technical-questionnaire.pdf"));
    assert.ok(names.has("financial-questionnaire.xlsx"));
    assert.ok(result.questions.every((q) => q.originalText.length > 0));
    assert.ok(result.questions.every((q) => q.provenance.sourceDocumentId));
  });
});

describe("draft answers — no hallucination / VERIFY", () => {
  it("returns VERIFY when knowledge is missing", () => {
    const drafts = generateDraftAnswers({
      questions: [
        {
          questionKey: "q1",
          prompt: "How many offshore oil platforms have you operated?",
          questionType: "NUMERIC",
          mandatoryStatus: "MANDATORY",
        },
      ],
      knowledge: null,
      profile: { companyName: "Atlas Facilities" },
    });
    assert.equal(drafts[0]!.status, "VERIFY");
    assert.equal(drafts[0]!.draftText, null);
  });

  it("drafts ISO from knowledge with evidence refs; does not invent unrelated facts", () => {
    const drafts = generateDraftAnswers({
      questions: [
        {
          questionKey: "iso",
          prompt: "Do you hold ISO 9001 certification?",
          questionType: "YES_NO",
          mandatoryStatus: "MANDATORY",
        },
        {
          questionKey: "oil",
          prompt: "Confirm offshore drilling capacity in the North Sea.",
          questionType: "TEXT",
          mandatoryStatus: "MANDATORY",
        },
      ],
      knowledge: emptyKnowledge(),
      profile: { companyName: "Atlas Facilities", country: "Morocco" },
    });
    const iso = drafts.find((d) => d.questionKey === "iso")!;
    assert.equal(iso.status, "DRAFT_READY");
    assert.match(iso.draftText ?? "", /ISO 9001/i);
    assert.ok((iso.evidenceRefs?.length ?? 0) > 0);

    const oil = drafts.find((d) => d.questionKey === "oil")!;
    assert.equal(oil.status, "VERIFY");
    assert.ok(
      oil.draftText == null ||
        !/north sea|offshore drilling/i.test(oil.draftText),
    );
  });

  it("marks UNKNOWN / ATTACHMENT questions as VERIFY", () => {
    assert.equal(inferQuestionType("Attach your insurance certificate", []), "ATTACHMENT");
    const drafts = generateDraftAnswers({
      questions: [
        {
          questionKey: "att",
          prompt: "Attach your insurance certificate",
          questionType: "ATTACHMENT",
          mandatoryStatus: "MANDATORY",
        },
        {
          questionKey: "unk",
          prompt: "Misc row",
          questionType: "UNKNOWN",
          mandatoryStatus: "UNKNOWN",
        },
      ],
      knowledge: emptyKnowledge(),
    });
    assert.equal(drafts[0]!.status, "VERIFY");
    assert.equal(drafts[1]!.status, "VERIFY");
  });
});

describe("API / review conventions", () => {
  it("API routes assert entitlement and session companyId", () => {
    const route = readSrc(
      "src/app/api/questionnaire-assistant/tenders/[tenderId]/route.ts",
    );
    assert.match(route, /requireCompanyIdApi/);
    assert.match(route, /assertQuestionnaireAssistantAvailable/);
  });

  it("review service supports approve/edit/reject statuses", () => {
    const service = readSrc(
      "src/modules/questionnaire-assistant/internal/service.ts",
    );
    assert.match(service, /approve/);
    assert.match(service, /reject/);
    assert.match(service, /edit/);
    assert.match(service, /APPROVED/);
    assert.match(service, /REJECTED/);
    assert.match(service, /EDITED/);
    assert.match(service, /companyId/);
  });

  it("extraction is idempotent via contentHash unique constraint", () => {
    const schema = readSrc("prisma/schema.prisma");
    assert.match(schema, /model QuestionnairePack/);
    assert.match(schema, /contentHash/);
    assert.match(schema, /@@unique\(\[companyId, tenderId, contentHash\]\)/);
  });
});
