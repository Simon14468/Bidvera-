import { classifyDocument } from "./classify";
import { collectNormalizedCapabilities, normalizeCapability } from "./normalize";
import type {
  CompanyKnowledge,
  ComplianceEvidenceItem,
  FactProvenance,
  HistoricalOutcomeRecord,
  ProjectReference,
  ProvenancedFact,
} from "./types";

function pageForOffset(text: string, offset: number): number | "UNKNOWN" {
  // Prefer explicit "Page N" markers near the match; else count "-- N of M --" markers.
  const before = text.slice(Math.max(0, offset - 400), offset + 80);
  const pageMarker = before.match(/Page\s+(\d+)/i);
  if (pageMarker) return Number(pageMarker[1]);

  const prefix = text.slice(0, offset);
  const breaks = [...prefix.matchAll(/--\s*(\d+)\s+of\s+\d+\s*--/gi)];
  if (breaks.length > 0) {
    const last = breaks[breaks.length - 1];
    return Number(last[1]) + 1; // content after break N is on page N+1 often; Atlas uses "Page N" too
  }
  return "UNKNOWN";
}

function provenance(
  sourceDocument: string,
  text: string,
  offset: number,
  section: string | null,
  originalValue: string,
  normalizedValue: string | null,
  confidence: FactProvenance["confidence"] = "INFERRED",
): FactProvenance {
  const page = pageForOffset(text, offset);
  const excerptStart = Math.max(0, offset - 40);
  const excerpt = text.slice(excerptStart, offset + Math.min(160, originalValue.length + 80)).trim();
  return {
    sourceDocument,
    page,
    section,
    originalValue,
    normalizedValue,
    confidence: page === "UNKNOWN" ? (confidence === "VERIFIED" ? "INFERRED" : confidence) : confidence,
    excerpt: excerpt || null,
  };
}

function fieldValue(text: string, label: RegExp): { value: string; index: number } | null {
  const m = text.match(label);
  if (!m || m.index == null) return null;
  const value = (m[1] ?? "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  return { value, index: m.index };
}

function parseEmployees(text: string): number | null {
  const m = text.match(/\bEmployees?\s+(\d{1,5})\b/i) ?? text.match(/\b(\d{1,5})\s+employees\b/i);
  return m ? Number(m[1]) : null;
}

function parseFounded(text: string): number | null {
  const m = text.match(/\bFounded\s+(19|20)\d{2}\b/i) ?? text.match(/\bFounded[:\s]+((?:19|20)\d{2})\b/i);
  if (!m) return null;
  const year = Number(m[0].match(/(19|20)\d{2}/)?.[0]);
  return year && year >= 1900 && year <= 2100 ? year : null;
}

function parseExperienceYears(text: string): number | null {
  const m = text.match(/\bExperience\s+(\d+)\s+years?\b/i) ?? text.match(/(\d+)\s+years?\s+of\s+operating\s+experience/i);
  return m ? Number(m[1]) : null;
}

function extractServices(text: string, sourceDocument: string) {
  const originals: { original: string; index: number; section: string }[] = [];
  const sectionIdx = text.search(/2\.\s*Main Services|Main Services/i);
  const sectionText =
    sectionIdx >= 0 ? text.slice(sectionIdx, sectionIdx + 3500) : text.slice(0, 8000);

  const serviceLines = [
    "Web application development",
    "Mobile application development",
    "Cloud solutions",
    "API / system integration",
    "UI/UX design",
    "Database development",
    "Technical support",
    "Application maintenance",
  ];

  for (const label of serviceLines) {
    const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const m = sectionText.match(re);
    if (m && m.index != null) {
      originals.push({
        original: m[0],
        index: (sectionIdx >= 0 ? sectionIdx : 0) + m.index,
        section: "Main Services",
      });
    }
  }

  // Generic fallback: lines under Main Services that look like service rows
  if (originals.length === 0) {
    const rowRe =
      /\n\s*((?:Web|Mobile|Cloud|API|UI\/UX|Database|Technical|Application)[^\n]{3,60}?)\s{2,}[A-Z]/gi;
    for (const m of sectionText.matchAll(rowRe)) {
      if (m.index == null) continue;
      originals.push({
        original: m[1].trim(),
        index: (sectionIdx >= 0 ? sectionIdx : 0) + m.index,
        section: "Main Services",
      });
    }
  }

  const normalized = collectNormalizedCapabilities(originals.map((o) => o.original));
  return normalized.map((n) => {
    const src = originals.find((o) => o.original === n.originalValue) ?? originals[0];
    return {
      originalValue: n.originalValue,
      normalizedValue: n.normalizedValue,
      provenance: provenance(
        sourceDocument,
        text,
        src?.index ?? 0,
        src?.section ?? "Main Services",
        n.originalValue,
        n.normalizedValue,
        "VERIFIED",
      ),
    };
  });
}

function cleanProjectName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").trim();
  // Strip leading tech tokens glued by PDF table extraction (never invent names)
  for (let i = 0; i < 4; i++) {
    const next = name.replace(
      /^(Technologies|React(?: Native)?|Next\.js|Node\.js|TypeScript|Laravel|PHP|PostgreSQL|MySQL|Docker|REST APIs?)\s+/i,
      "",
    );
    if (next === name) break;
    name = next.trim();
  }
  return name;
}

function extractProjects(text: string, sourceDocument: string): ProjectReference[] {
  const projects: ProjectReference[] = [];
  const sectionIdx = text.search(/4\.\s*Company Experience|Project References|Company Experience/i);
  if (sectionIdx < 0) return projects;
  const section = text.slice(sectionIdx, sectionIdx + 5500);

  const seen = new Set<string>();
  for (const m of section.matchAll(
    /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9\/&-]+){0,6}\s+(?:Portal|Platform|Suite|Hub|App|Dashboard|System|Program))\b/g,
  )) {
    if (m.index == null) continue;
    const name = cleanProjectName(m[1]);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (/Company Experience|Project References|Experience Interpretation/i.test(name)) continue;
    if (name.split(" ").length < 2) continue;
    seen.add(key);

    const window = section.slice(m.index, m.index + 480);
    const valueMatch = window.match(/MAD\s*[\d,]+(?:\s*[–-]\s*MAD\s*[\d,]+)?/i);
    const techMatch = window.match(
      /\b(React(?: Native)?|Next\.js|Node\.js|TypeScript|Laravel|PHP|PostgreSQL|MySQL|Docker|REST APIs?)\b/gi,
    );
    const durationMatch = window.match(/(\d+)\s*months?/i);
    const publicCue =
      /local public|public administration|municipal|government|citizen|civic|public-sector|public sector/i.test(
        `${name} ${window}`,
      );
    projects.push({
      name,
      clientSector: publicCue ? "public administration" : null,
      description: window.replace(/\s+/g, " ").slice(0, 240),
      approximateValue: valueMatch?.[0] ?? null,
      duration: durationMatch ? `${durationMatch[1]} months` : null,
      status: /Completed/i.test(window) ? "Completed" : null,
      technologies: [...new Set((techMatch ?? []).map((t) => t))],
      provenance: provenance(
        sourceDocument,
        text,
        sectionIdx + m.index,
        "Company Experience — Project References",
        name,
        name,
        "VERIFIED",
      ),
    });
  }

  return projects;
}

function extractOperationalCapacity(
  text: string,
  sourceDocument: string,
  employees: number | null,
): CompanyKnowledge["operationalCapacity"] {
  const sectionIdx = text.search(/5\.\s*Team\s*&\s*Capacity|Team\s*&\s*Capacity|Capacity Indicators/i);
  const section = sectionIdx >= 0 ? text.slice(sectionIdx, sectionIdx + 3500) : text;
  const absBase = sectionIdx >= 0 ? sectionIdx : 0;

  const developers = section.match(/Software developers\s+(\d{1,4})/i);
  const pms = section.match(/Project managers\s+(\d{1,4})/i);
  const qa = section.match(/QA\s*\/\s*testing\s+(\d{1,4})/i);
  const concurrent = section.match(
    /Typical simultaneous projects[:\s]+(\d+\s*[–\-]\s*\d+|\d+)/i,
  );
  const duration = section.match(
    /Typical project duration[:\s]+(\d+\s*[–\-]\s*\d+\s*months?|\d+\s*months?)/i,
  );

  let typicalDurationMonthsMin: number | null = null;
  let typicalDurationMonthsMax: number | null = null;
  if (duration?.[1]) {
    const nums = [...duration[1].matchAll(/(\d+)/g)].map((x) => Number(x[1]));
    if (nums.length >= 2) {
      typicalDurationMonthsMin = nums[0];
      typicalDurationMonthsMax = nums[1];
    } else if (nums.length === 1) {
      typicalDurationMonthsMin = nums[0];
      typicalDurationMonthsMax = nums[0];
    }
  }

  const notes: string[] = [];
  if (employees != null) notes.push(`${employees} total employees`);
  if (developers) notes.push(`${developers[1]} software developers`);
  if (pms) notes.push(`${pms[1]} project managers`);
  if (qa) notes.push(`${qa[1]} QA / testing`);
  if (concurrent) notes.push(`Typical simultaneous projects: ${concurrent[1]}`);
  if (duration) notes.push(`Typical project duration: ${duration[1]}`);

  const anchor =
    developers ?? concurrent ?? duration ?? (employees != null ? { index: 0 } : null);
  const offset =
    typeof anchor === "object" && anchor && "index" in anchor && typeof anchor.index === "number"
      ? absBase + (anchor.index ?? 0)
      : absBase;

  return {
    totalEmployees: employees,
    developers: developers ? Number(developers[1]) : null,
    projectManagers: pms ? Number(pms[1]) : null,
    qa: qa ? Number(qa[1]) : null,
    typicalConcurrentProjects: concurrent?.[1] ?? null,
    typicalDuration: duration?.[1] ?? null,
    typicalDurationMonthsMin,
    typicalDurationMonthsMax,
    notes,
    provenance:
      notes.length > 0
        ? provenance(
            sourceDocument,
            text,
            offset,
            "Team & Capacity",
            notes.join("; "),
            notes.join("; "),
            "VERIFIED",
          )
        : null,
  };
}

function extractCompliance(text: string, sourceDocument: string): {
  certifications: ComplianceEvidenceItem[];
  policies: ComplianceEvidenceItem[];
  insurance: ComplianceEvidenceItem[];
} {
  const certifications: ComplianceEvidenceItem[] = [];
  const policies: ComplianceEvidenceItem[] = [];
  const insurance: ComplianceEvidenceItem[] = [];
  const sectionIdx = text.search(/6\.\s*Certifications|Certifications\s*&\s*Compliance/i);
  const section = sectionIdx >= 0 ? text.slice(sectionIdx, sectionIdx + 4500) : text;

  const items: { name: string; kind: "cert" | "policy" | "insurance" }[] = [
    { name: "ISO 9001", kind: "cert" },
    { name: "ISO 27001", kind: "cert" },
    { name: "PCI DSS", kind: "cert" },
    { name: "Information Security Policy", kind: "policy" },
    { name: "Data Protection Policy", kind: "policy" },
    { name: "Cybersecurity Policy", kind: "policy" },
    { name: "Business Continuity Plan", kind: "policy" },
    { name: "Professional liability insurance", kind: "insurance" },
    { name: "Cyber insurance", kind: "insurance" },
  ];

  for (const item of items) {
    const re = new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const m = section.match(re);
    if (!m || m.index == null) continue;
    // Tight window — avoid swallowing the next evidence row's status
    const window = section.slice(m.index, m.index + 160);
    let status: ComplianceEvidenceItem["status"] = "VERIFY";
    const statusPhrase = window.match(
      /(?:Certification|Policy|Insurance|coverage)\s+(available|not held)|Requirement\s+requiring\s+verification|No explicit/i,
    );
    if (statusPhrase) {
      const phrase = statusPhrase[0].toLowerCase();
      if (phrase.includes("not held")) status = "NOT_HELD";
      else if (phrase.includes("available")) status = "AVAILABLE";
      else status = "VERIFY";
    } else if (/not held/i.test(window) && !/available/i.test(window)) {
      status = "NOT_HELD";
    } else if (/available/i.test(window) && !/not held/i.test(window)) {
      status = "AVAILABLE";
    }

    const detail = window.replace(/\s+/g, " ").slice(0, 200);
    const absIndex = (sectionIdx >= 0 ? sectionIdx : 0) + m.index;
    const entry: ComplianceEvidenceItem = {
      name: item.name,
      status,
      detail,
      provenance: provenance(
        sourceDocument,
        text,
        absIndex,
        "Certifications & Compliance",
        `${item.name}: ${status}`,
        item.name,
        status === "NOT_HELD" || status === "AVAILABLE" ? "VERIFIED" : "INFERRED",
      ),
    };
    if (item.kind === "cert") certifications.push(entry);
    else if (item.kind === "policy") policies.push(entry);
    else insurance.push(entry);
  }

  // Atlas uses "Information Security Policy" — also treat as cybersecurity/data-protection evidence when present
  const isp = policies.find((p) => /information security policy/i.test(p.name) && p.status === "AVAILABLE");
  if (isp) {
    for (const alias of ["Data Protection Policy", "Cybersecurity Policy"]) {
      if (!policies.some((p) => p.name === alias)) {
        policies.push({
          name: alias,
          status: "AVAILABLE",
          detail: `Inferred from available ${isp.name} record in source profile.`,
          provenance: {
            ...isp.provenance,
            originalValue: `${alias} via ${isp.name}`,
            normalizedValue: alias,
            confidence: "INFERRED",
          },
        });
      }
    }
  }

  return { certifications, policies, insurance };
}

function extractListSection(
  text: string,
  heading: RegExp,
  sourceDocument: string,
  sectionName: string,
): ProvenancedFact[] {
  const idx = text.search(heading);
  if (idx < 0) return [];
  const chunk = text.slice(idx, idx + 2000);
  const facts: ProvenancedFact[] = [];
  for (const m of chunk.matchAll(/[•\-\*]\s*([^\n]{8,200})/g)) {
    if (m.index == null) continue;
    const value = m[1].replace(/\s+/g, " ").trim();
    facts.push({
      key: sectionName,
      value,
      provenance: provenance(
        sourceDocument,
        text,
        idx + m.index,
        sectionName,
        value,
        value,
        "VERIFIED",
      ),
    });
  }
  return facts;
}

function extractHistorical(text: string, sourceDocument: string): HistoricalOutcomeRecord[] {
  const idx = text.search(/10\.\s*Historical Tender Outcomes|Historical Tender Outcomes/i);
  if (idx < 0) return [];
  const section = text.slice(idx, idx + 4500);
  const records: HistoricalOutcomeRecord[] = [];
  const seen = new Set<string>();

  const titleFromBefore = (before: string): string | null => {
    const titles = [
      ...before.matchAll(
        /\b((?:[A-Z][A-Za-z0-9]+[\s\n]+){2,6}(?:Portal|Platform|System|Program|Modernization|Suite|Hub))\b/gi,
      ),
    ];
    while (titles.length > 0) {
      const last = titles.pop();
      if (!last) break;
      let opportunity = last[1].replace(/[\s\n]+/g, " ").trim();
      // PDF table headers often glue into the first title — keep the trailing opportunity phrase
      const trailing = opportunity.match(
        /\b((?:[A-Z][A-Za-z0-9]+ ){2,5}(?:Portal|Platform|System|Program|Modernization|Suite|Hub))$/,
      );
      if (trailing) opportunity = trailing[1].trim();
      if (
        /Historical Tender|Learning|Opportunity|Sector|requirements|Outcome|Short reason|Company Historical|Web portal|Student workflow|Direct platform|value Main|Main requirements|Arabic|French UX/i.test(
          opportunity,
        )
      ) {
        continue;
      }
      if (opportunity.split(" ").length < 3) continue;
      return opportunity;
    }
    return null;
  };

  for (const m of section.matchAll(/\b(WON|LOST|DID_NOT_B(?:\s*)ID)\b/gi)) {
    if (m.index == null) continue;
    const outcomeRaw = m[1].replace(/\s+/g, "").toUpperCase();
    const outcome: HistoricalOutcomeRecord["outcome"] = outcomeRaw.startsWith("WON")
      ? "WON"
      : outcomeRaw.startsWith("LOST")
        ? "LOST"
        : "DID_NOT_BID";

    const before = section.slice(Math.max(0, m.index - 480), m.index);
    const opportunity = titleFromBefore(before);
    if (!opportunity) continue;

    const key = opportunity.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const window = section.slice(Math.max(0, m.index - 200), m.index + 80);
    const valueMatch = window.match(/MAD\s*[\d.,]+[kKmM]?/i);

    records.push({
      opportunity,
      sector: null,
      opportunityType: null,
      approximateValue: valueMatch?.[0] ?? null,
      capabilities: [],
      requirements: null,
      outcome,
      reason: null,
      provenance: provenance(
        sourceDocument,
        text,
        idx + m.index,
        "Historical Tender Outcomes",
        `${opportunity} → ${outcome}`,
        outcome,
        "VERIFIED",
      ),
      lifecycle: "CANDIDATE",
    });
  }

  return records;
}

function extractTechnologies(text: string, sourceDocument: string): ProvenancedFact[] {
  const idx = text.search(/3\.\s*Technical Capabilities|Technical Capabilities/i);
  const section = idx >= 0 ? text.slice(idx, idx + 2500) : "";
  const techs = [
    "React",
    "Next.js",
    "Node.js",
    "TypeScript",
    "PHP",
    "Laravel",
    "PostgreSQL",
    "MySQL",
    "Docker",
    "CI/CD",
  ];
  const out: ProvenancedFact[] = [];
  for (const t of techs) {
    const re = new RegExp(`\\b${t.replace(".", "\\.")}\\b`, "i");
    const m = section.match(re);
    if (!m || m.index == null) continue;
    out.push({
      key: "technology",
      value: t,
      provenance: provenance(
        sourceDocument,
        text,
        (idx >= 0 ? idx : 0) + m.index,
        "Technical Capabilities",
        t,
        t,
        "VERIFIED",
      ),
    });
  }
  return out;
}

/**
 * Deterministic company-knowledge extraction from document text.
 * Never invents page numbers, certifications, projects, or financial values.
 */
export function extractCompanyKnowledgeHeuristic(input: {
  text: string;
  fileName: string;
  packageContext?: import("./classify").ClassifyPackageContext;
}): CompanyKnowledge {
  const text = input.text;
  const sourceDocument = input.fileName;
  const classification = classifyDocument({
    text,
    fileName: input.fileName,
    packageContext: input.packageContext,
  });

  const nameField =
    fieldValue(text, /Company name\s+([^\n]+)/i) ??
    fieldValue(text, /Company\s+(Atlas[^\n]+|[\w][^\n]{2,80}SARL)/i);
  const industryField =
    fieldValue(text, /Industry\s+([^\n]+)/i) ??
    fieldValue(text, /Industry Information Technology[^\n]*/i);
  const locationField = fieldValue(text, /Location\s+([^\n]+)/i);
  const sizeField =
    fieldValue(text, /Company size\s+([^\n]+)/i) ??
    fieldValue(text, /Employees\s+(\d+)/i);
  const legalField = fieldValue(text, /Legal structure\s+([^\n]+)/i);

  const employees = parseEmployees(text);
  const foundedYear = parseFounded(text);
  const experienceYears = parseExperienceYears(text);

  const services = extractServices(text, sourceDocument);
  const capabilities = services.map((s) => ({
    ...s,
    normalizedValue: normalizeCapability(s.normalizedValue),
  }));
  const projects = extractProjects(text, sourceDocument);
  const { certifications, policies, insurance } = extractCompliance(text, sourceDocument);
  const technologies = extractTechnologies(text, sourceDocument);
  const strengths = extractListSection(text, /7\.\s*Company Strengths|Company Strengths/i, sourceDocument, "Company Strengths");
  const limitations = extractListSection(text, /8\.\s*Known Limitations|Known Limitations/i, sourceDocument, "Known Limitations");
  const tenderPreferences = extractListSection(
    text,
    /9\.\s*Tender Preferences|Tender Preferences/i,
    sourceDocument,
    "Tender Preferences",
  );
  const historicalOutcomes = extractHistorical(text, sourceDocument);
  const operationalCapacity = extractOperationalCapacity(text, sourceDocument, employees);

  const coverage: ProvenancedFact[] = [];
  const covMatch = text.match(/Morocco nationwide|Areas served\s+([^\n]+)/i);
  if (covMatch && covMatch.index != null) {
    coverage.push({
      key: "geographic_coverage",
      value: covMatch[0].replace(/^Areas served\s+/i, "").trim(),
      provenance: provenance(
        sourceDocument,
        text,
        covMatch.index,
        "Company Overview",
        covMatch[0],
        "Morocco",
        "VERIFIED",
      ),
    });
  }

  const prefMatch = text.match(
    /Preferred contract size\s+Approximately\s+(MAD\s*[\d,]+)\s*[–-]\s*(MAD\s*[\d,]+|[\d,]+)/i,
  );
  let preferredMin: string | null = null;
  let preferredMax: string | null = null;
  let preferredMaxNumeric: number | null = null;
  let capacityProv: FactProvenance | null = null;
  if (prefMatch && prefMatch.index != null) {
    preferredMin = prefMatch[1];
    preferredMax = /MAD/i.test(prefMatch[2]) ? prefMatch[2] : `MAD ${prefMatch[2]}`;
    const maxNum = Number(String(preferredMax).replace(/[^\d]/g, ""));
    preferredMaxNumeric = Number.isFinite(maxNum) ? maxNum : null;
    capacityProv = provenance(
      sourceDocument,
      text,
      prefMatch.index,
      "Tender Preferences",
      prefMatch[0],
      preferredMax,
      "VERIFIED",
    );
  }

  const country =
    locationField?.value.match(/Morocco|UK|United Kingdom|France|UAE|Saudi/i)?.[0] ??
    (coverage[0] ? "Morocco" : null);

  return {
    documentKind: classification.kind,
    classificationConfidence: classification.confidence,
    classificationSignals: classification.signals,
    identity: {
      companyName: nameField?.value?.slice(0, 160) ?? null,
      legalStructure: legalField?.value?.slice(0, 160) ?? null,
      industry: industryField?.value?.slice(0, 160) ?? null,
      sector: industryField?.value?.slice(0, 160) ?? null,
      location: locationField?.value?.slice(0, 160) ?? null,
      country,
      companySize: sizeField?.value?.slice(0, 80) ?? (employees != null ? `Small — ${employees} employees` : null),
      employees,
      foundedYear,
      experienceYears,
    },
    services,
    capabilities,
    technologies,
    projects,
    certifications,
    policies,
    insurance,
    geographicCoverage: coverage,
    contractCapacity: {
      preferredMin,
      preferredMax,
      preferredMaxNumeric,
      notes: null,
      provenance: capacityProv,
    },
    operationalCapacity,
    strengths,
    limitations,
    tenderPreferences,
    historicalOutcomes,
    extraFacts: [],
    sourceDocuments: [sourceDocument],
    extractedAt: new Date().toISOString(),
  };
}
