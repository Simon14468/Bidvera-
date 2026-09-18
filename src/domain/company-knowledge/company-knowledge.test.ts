/**
 * Regression: company intelligence extraction from Atlas-style profile PDF text.
 * Values must come from the document — never hardcoded into application logic.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CAPABILITY_GROUPS,
  classifyDocument,
  COMPANY_ONLY_MESSAGE,
  extractCompanyKnowledgeHeuristic,
  matchRequirementToKnowledge,
  missingDocumentsFromKnowledge,
  normalizeCapability,
  risksFromRelevantLimitations,
} from "./index";

async function loadAtlasText(): Promise<string | null> {
  try {
    const path =
      ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtfy2tdc0032rkokbucq0ecq/1788102529143-Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf";
    const buf = readFileSync(path);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const text =
      typeof result === "string"
        ? result
        : ((result as { text?: string }).text ?? "");
    return text;
  } catch {
    return null;
  }
}

describe("company knowledge — classification", () => {
  it("classifies company profile text as COMPANY_PROFILE, never TENDER", () => {
    const sample = `
      Atlas Digital Solutions SARL — Company Profile
      Main Services
      Known Limitations
      Tender Preferences
      Certifications & Compliance
    `;
    const result = classifyDocument({
      text: sample,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    assert.equal(result.kind, "COMPANY_PROFILE");
  });

  it("classifies RFP language as TENDER", () => {
    const result = classifyDocument({
      text: "Invitation to Tender. Tenderers shall provide mandatory requirements by the submission deadline.",
      fileName: "city-rfp.pdf",
    });
    assert.equal(result.kind, "TENDER");
  });
});

describe("company knowledge — normalization", () => {
  it("normalizes web/mobile/api synonyms without merging unrelated concepts", () => {
    assert.equal(normalizeCapability("Web development"), "Web Application Development");
    assert.equal(normalizeCapability("Mobile apps"), "Mobile Application Development");
    assert.equal(normalizeCapability("API integration"), "API Integration");
    assert.notEqual(normalizeCapability("Web development"), normalizeCapability("Healthcare consulting"));
  });

  it("exposes expected capability groups used in matching", () => {
    const names = CAPABILITY_GROUPS.map((g) => g.normalized);
    for (const n of [
      "Web Application Development",
      "Mobile Application Development",
      "Cloud Solutions",
      "API Integration",
      "UI/UX Design",
      "Database Development",
      "Technical Support",
      "Application Maintenance",
    ]) {
      assert.ok(names.includes(n), `missing group ${n}`);
    }
  });
});

describe("company knowledge — Atlas PDF extraction", async () => {
  const text = await loadAtlasText();
  const skip = !text || text.length < 1000;

  it("extracts services, projects, compliance, limitations, historical outcomes from document", async (t) => {
    if (skip) {
      t.skip("Atlas test PDF not present in .data/uploads");
      return;
    }
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: text!,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });

    assert.equal(knowledge.documentKind, "COMPANY_PROFILE");
    assert.ok(knowledge.services.length >= 6, `services=${knowledge.services.length}`);
    const normalized = knowledge.services.map((s) => s.normalizedValue);
    assert.ok(normalized.some((s) => /Web Application/i.test(s)));
    assert.ok(normalized.some((s) => /Mobile Application/i.test(s)));
    assert.ok(normalized.some((s) => /API Integration/i.test(s)));
    assert.ok(normalized.some((s) => /Cloud/i.test(s)));
    assert.ok(normalized.some((s) => /UI\/UX/i.test(s)));
    assert.ok(normalized.some((s) => /Database/i.test(s)));

    assert.ok(knowledge.projects.length >= 4, `projects=${knowledge.projects.length}`);
    assert.ok(knowledge.projects.every((p) => p.provenance.sourceDocument));

    const iso9001 = knowledge.certifications.find((c) => /ISO\s*9001/i.test(c.name));
    const iso27001 = knowledge.certifications.find((c) => /ISO\s*27001/i.test(c.name));
    assert.equal(iso9001?.status, "AVAILABLE");
    assert.equal(iso27001?.status, "NOT_HELD");

    assert.ok(knowledge.limitations.some((l) => /ISO\s*27001/i.test(l.value)));
    assert.ok(knowledge.limitations.some((l) => /24\s*\/\s*7/i.test(l.value)));
    assert.ok(knowledge.limitations.some((l) => /healthcare/i.test(l.value)));

    const won = knowledge.historicalOutcomes.filter((h) => h.outcome === "WON").length;
    const lost = knowledge.historicalOutcomes.filter((h) => h.outcome === "LOST").length;
    const noBid = knowledge.historicalOutcomes.filter((h) => h.outcome === "DID_NOT_BID").length;
    assert.ok(won >= 3, `won=${won}`);
    assert.ok(lost >= 2, `lost=${lost}`);
    assert.ok(noBid >= 1, `did_not_bid=${noBid}`);
    assert.ok(knowledge.historicalOutcomes.every((h) => h.lifecycle === "CANDIDATE"));

    // Provenance: never fabricate numeric pages when unknown markers absent is OK,
    // but source document must always be set
    for (const s of knowledge.services) {
      assert.equal(s.provenance.sourceDocument, "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf");
      assert.ok(s.originalValue);
      assert.ok(s.normalizedValue);
    }
  });

  it("matches web tender requirement positively against extracted capabilities", async (t) => {
    if (skip) {
      t.skip("Atlas test PDF not present in .data/uploads");
      return;
    }
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: text!,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    const match = matchRequirementToKnowledge({
      requirement: "Experience developing web-based information systems.",
      category: "technical",
      mandatory: true,
      knowledge,
    });
    assert.equal(match.status, "MATCHED");
    assert.ok(match.evidence);
  });

  it("marks ISO 27001 as explicit gap when company states not held", async (t) => {
    if (skip) {
      t.skip("Atlas test PDF not present in .data/uploads");
      return;
    }
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: text!,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    const match = matchRequirementToKnowledge({
      requirement: "ISO 27001 certification is mandatory.",
      category: "certification",
      mandatory: true,
      knowledge,
    });
    assert.equal(match.status, "FAILED");
    const missing = missingDocumentsFromKnowledge({
      knowledge,
      tenderText: "ISO 27001 certification is mandatory.",
    });
    assert.ok(missing.some((m) => /ISO\s*27001/i.test(m.documentName)));
  });

  it("matches public-sector, geography, capacity, and explicit 24/7 negative evidence", async (t) => {
    if (skip) {
      t.skip("Atlas test PDF not present in .data/uploads");
      return;
    }
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: text!,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });

    const publicSector = matchRequirementToKnowledge({
      requirement: "Public-sector digital project experience is required.",
      category: "experience",
      mandatory: true,
      knowledge,
    });
    assert.equal(publicSector.status, "MATCHED");
    assert.ok(publicSector.evidence && /civic|municipal|public/i.test(publicSector.evidence));

    const geo = matchRequirementToKnowledge({
      requirement: "Morocco-based delivery capability is required.",
      category: "geography",
      mandatory: true,
      knowledge,
    });
    assert.equal(geo.status, "MATCHED");

    const geoFr = matchRequirementToKnowledge({
      requirement: "Le titulaire est tenu d'élire domicile au Maroc.",
      category: "MANDATORY_ELIGIBILITY",
      mandatory: true,
      knowledge,
    });
    assert.equal(geoFr.status, "MATCHED");

    const capacity = matchRequirementToKnowledge({
      requirement:
        "Financial and operational capacity to deliver an 8-month project is required.",
      category: "financial",
      mandatory: true,
      knowledge,
    });
    assert.equal(capacity.status, "MATCHED");

    const support = matchRequirementToKnowledge({
      requirement: "24/7 technical support is required.",
      category: "support",
      mandatory: true,
      knowledge,
    });
    assert.equal(support.status, "FAILED");

    const hci = matchRequirementToKnowledge({
      requirement:
        "Fourniture et installation de la solution hyperconvergée / virtualisation.",
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      knowledge,
    });
    assert.equal(hci.status, "UNCERTAIN");
    assert.ok(!hci.evidence);

    const unknown = matchRequirementToKnowledge({
      requirement: "Supplier must hold a rare industry-specific OEM partner badge XYZ-999.",
      category: "MANDATORY_ADMINISTRATIVE",
      mandatory: true,
      knowledge,
    });
    assert.equal(unknown.status, "UNCERTAIN");
  });

  it("surfaces 24/7 limitation as risk only when tender requires 24/7", async (t) => {
    if (skip) {
      t.skip("Atlas test PDF not present in .data/uploads");
      return;
    }
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: text!,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    const with247 = risksFromRelevantLimitations({
      knowledge,
      tenderText: "Vendor must provide 24/7 support desk.",
      estimatedValue: 500_000,
    });
    assert.ok(with247.some((r) => /24\s*\/\s*7/i.test(r.description)));

    const unrelated = risksFromRelevantLimitations({
      knowledge,
      tenderText: "Build a small informational brochure website.",
      estimatedValue: 80_000,
    });
    assert.ok(!unrelated.some((r) => /24\s*\/\s*7/i.test(r.description)));
  });
});

describe("company knowledge — company-only message", () => {
  it("exports the required company-only analysis message", () => {
    assert.match(COMPANY_ONLY_MESSAGE, /Company information successfully extracted/i);
    assert.match(COMPANY_ONLY_MESSAGE, /Tender requirements are not available/i);
    assert.match(COMPANY_ONLY_MESSAGE, /Upload a Tender\/RFP/i);
  });
});
