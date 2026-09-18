import { capabilityMatchesText } from "./normalize";
import type {
  CompanyKnowledge,
  FactProvenance,
  ProjectReference,
  RequirementMatchResult,
} from "./types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .replace(/[^a-z0-9+ /]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bmaroc\b/g, "morocco");
}

const PUBLIC_SECTOR_REQ =
  /\b(public[- ]sector|government|municipal|public administration|citizen services|civic|secteur\s+public|administration\s+publique|collectivit[eé]s?\s+territoriales?)\b/i;

const PUBLIC_SECTOR_EVIDENCE =
  /\b(civic|municipal|government|public administration|local public|citizen[- ]facing|citizen services|public[- ]sector|public sector|secteur\s+public)\b/i;

const GEO_REQ =
  /\b(morocco[- ]based|based in morocco|delivery within morocco|morocco nationwide|in morocco|morocco[- ]wide|livraison\s+(?:au|à|a)\s+(?:maroc|morocco)|domicile\s+au\s+maroc|domicile\s+in\s+morocco|establish\s+domicile|[eé]lire\s+domicile|lieu\s+d['']ex[ée]cution|implant[eé]e?\s+au\s+maroc|au\s+maroc)\b/i;

const CAPACITY_REQ =
  /\b(operational capacity|financial and operational|delivery capacity|staffing capacity|8[- ]month|months? project|concurrent projects|team capacity|capacit[eé]\s+(?:op[eé]rationnelle|de\s+livraison)|dur[eé]e\s+(?:du\s+)?(?:projet|march[eé])|mois\s+de\s+(?:projet|prestation))\b/i;

/** Specialized infra — must not be satisfied by generic software/cloud wording alone. */
const SPECIALIZED_INFRA_REQ =
  /\b(hyperconverg|hci|virtualisation|virtualization|vmware|vsphere|nutanix|appliance|infrastructure\s+hyperconverg|solution\s+de\s+virtualisation)\b/i;

const SPECIALIZED_INFRA_EVIDENCE =
  /\b(hyperconverg|hci|virtualisation|virtualization|vmware|vsphere|nutanix|san\b|hypervisor|bare[- ]metal|appliance)\b/i;

function projectBlob(p: ProjectReference): string {
  return `${p.name} ${p.clientSector ?? ""} ${p.description ?? ""}`;
}

function isPublicSectorProject(p: ProjectReference): boolean {
  // Require contextual cues — do not treat every "portal" as public-sector
  return (
    p.clientSector === "public administration" ||
    PUBLIC_SECTOR_EVIDENCE.test(projectBlob(p))
  );
}

function geographyMatches(knowledge: CompanyKnowledge, tenderText: string): {
  hit: boolean;
  evidence: string | null;
  sourceDocument: string | null;
  page: number | "UNKNOWN" | null;
  section: string | null;
} {
  const geoFacts: {
    value: string;
    provenance: FactProvenance | null;
  }[] = [];
  for (const g of knowledge.geographicCoverage) {
    geoFacts.push({ value: g.value, provenance: g.provenance });
  }
  if (knowledge.identity.location) {
    geoFacts.push({
      value: knowledge.identity.location,
      provenance: null,
    });
  }
  if (knowledge.identity.country) {
    geoFacts.push({
      value: knowledge.identity.country,
      provenance: null,
    });
  }

  const tenderNorm = normalize(tenderText);
  for (const fact of geoFacts) {
    const place = normalize(fact.value);
    if (!place) continue;
    // Country / city token present in company evidence and tender asks for that place
    const placeTokens = place.split(" ").filter((t) => t.length >= 4);
    const tenderAsksForPlace = placeTokens.some(
      (t) => tenderNorm.includes(t) && GEO_REQ.test(tenderText),
    );
    // Also: tender says "Morocco-based" and company states Morocco
    const countryHit =
      placeTokens.some((t) => tenderNorm.includes(t)) &&
      (/based|delivery|nationwide|within|located|morocco/i.test(tenderText) ||
        GEO_REQ.test(tenderText));

    if (tenderAsksForPlace || (GEO_REQ.test(tenderText) && placeTokens.some((t) => tenderNorm.includes(t)))) {
      return {
        hit: true,
        evidence: fact.value,
        sourceDocument: fact.provenance?.sourceDocument ?? knowledge.sourceDocuments[0] ?? null,
        page: fact.provenance?.page ?? "UNKNOWN",
        section: fact.provenance?.section ?? "Company Overview",
      };
    }
    if (countryHit && /morocco/i.test(fact.value) && /morocco/i.test(tenderText)) {
      return {
        hit: true,
        evidence: fact.value,
        sourceDocument: fact.provenance?.sourceDocument ?? knowledge.sourceDocuments[0] ?? null,
        page: fact.provenance?.page ?? "UNKNOWN",
        section: fact.provenance?.section ?? "Company Overview",
      };
    }
  }

  // Generic: any stated country/location overlapping tender geography wording
  for (const fact of geoFacts) {
    const place = normalize(fact.value);
    if (place.length < 4) continue;
    if (tenderNorm.includes(place)) {
      if (
        /based|delivery|nationwide|within|located|geographic|country|morocco|maroc|coverage|domicile|livraison|ex[eé]cution/i.test(
          tenderText,
        )
      ) {
        return {
          hit: true,
          evidence: fact.value,
          sourceDocument: fact.provenance?.sourceDocument ?? knowledge.sourceDocuments[0] ?? null,
          page: fact.provenance?.page ?? "UNKNOWN",
          section: fact.provenance?.section ?? "Company Overview",
        };
      }
    }
  }

  return { hit: false, evidence: null, sourceDocument: null, page: null, section: null };
}

function knowledgeHasSpecializedInfra(knowledge: CompanyKnowledge): {
  hit: boolean;
  evidence: string | null;
  sourceDocument: string | null;
  page: number | "UNKNOWN" | null;
  section: string | null;
} {
  const blobs: Array<{
    text: string;
    sourceDocument: string | null;
    page: number | "UNKNOWN" | null;
    section: string | null;
  }> = [];
  for (const c of knowledge.capabilities) {
    blobs.push({
      text: `${c.originalValue} ${c.normalizedValue}`,
      sourceDocument: c.provenance.sourceDocument,
      page: c.provenance.page,
      section: c.provenance.section,
    });
  }
  for (const s of knowledge.services) {
    blobs.push({
      text: `${s.originalValue} ${s.normalizedValue}`,
      sourceDocument: s.provenance.sourceDocument,
      page: s.provenance.page,
      section: s.provenance.section,
    });
  }
  for (const p of knowledge.projects) {
    blobs.push({
      text: projectBlob(p),
      sourceDocument: p.provenance.sourceDocument,
      page: p.provenance.page,
      section: p.provenance.section,
    });
  }
  for (const blob of blobs) {
    if (SPECIALIZED_INFRA_EVIDENCE.test(blob.text)) {
      return {
        hit: true,
        evidence: blob.text.slice(0, 200),
        sourceDocument: blob.sourceDocument,
        page: blob.page,
        section: blob.section,
      };
    }
  }
  return { hit: false, evidence: null, sourceDocument: null, page: null, section: null };
}

function matchOperationalCapacity(
  knowledge: CompanyKnowledge,
  tenderText: string,
): RequirementMatchResult | null {
  if (!CAPACITY_REQ.test(tenderText)) return null;

  const cap = knowledge.operationalCapacity;
  const monthsNeeded = tenderText.match(/(\d+)\s*[- ]?\s*month/i);
  const needed = monthsNeeded ? Number(monthsNeeded[1]) : null;

  const hasHeadcount =
    (cap.totalEmployees != null && cap.totalEmployees > 0) ||
    (cap.developers != null && cap.developers > 0);
  const durationOk =
    needed == null ||
    (cap.typicalDurationMonthsMax != null && cap.typicalDurationMonthsMax >= needed) ||
    (cap.typicalDurationMonthsMin != null &&
      cap.typicalDurationMonthsMax != null &&
      needed >= cap.typicalDurationMonthsMin &&
      needed <= cap.typicalDurationMonthsMax) ||
    knowledge.projects.some((p) => {
      if (!p.duration) return false;
      const m = p.duration.match(/(\d+)/);
      return m != null && Number(m[1]) >= (needed ?? 0);
    });

  const completedProjects = knowledge.projects.filter((p) =>
    /completed/i.test(p.status ?? ""),
  ).length;

  if (hasHeadcount && durationOk && (completedProjects > 0 || cap.typicalDuration)) {
    const parts = [...cap.notes];
    if (needed != null && cap.typicalDuration) {
      parts.push(`Tender duration ${needed} months within/near stated typical duration ${cap.typicalDuration}`);
    }
    const evidence = parts.join("; ") || `Employees: ${cap.totalEmployees}`;
    return {
      requirement: tenderText,
      status: "MATCHED",
      evidence,
      sourceDocument: cap.provenance?.sourceDocument ?? knowledge.sourceDocuments[0] ?? null,
      page: cap.provenance?.page ?? "UNKNOWN",
      section: cap.provenance?.section ?? "Team & Capacity",
      rationale:
        "Company capacity evidence (headcount and/or typical project duration) supports the stated delivery period.",
    };
  }

  if (hasHeadcount && !durationOk) {
    return {
      requirement: tenderText,
      status: "UNCERTAIN",
      evidence: cap.notes.join("; ") || null,
      sourceDocument: cap.provenance?.sourceDocument ?? null,
      page: cap.provenance?.page ?? null,
      section: cap.provenance?.section ?? null,
      rationale:
        "Some capacity evidence exists but duration/staffing fit requires confirmation.",
    };
  }

  return {
    requirement: tenderText,
    status: "UNCERTAIN",
    evidence: null,
    sourceDocument: null,
    page: null,
    section: null,
    rationale: "Insufficient operational capacity evidence in company knowledge.",
  };
}

/**
 * Match a tender requirement against structured company knowledge.
 * Company capabilities are NOT requirements — this only scores evidence against real tender reqs.
 *
 * Traffic semantics:
 * MATCHED = GREEN (positive evidence)
 * UNCERTAIN = YELLOW (unknown / ambiguous / needs confirmation)
 * FAILED = RED (explicit negative evidence or clear non-compliance)
 */
export function matchRequirementToKnowledge(input: {
  requirementId?: string;
  requirement: string;
  category: string;
  mandatory: boolean;
  value?: string | null;
  knowledge: CompanyKnowledge;
}): RequirementMatchResult {
  const text = `${input.category} ${input.requirement} ${input.value ?? ""}`;
  const n = normalize(text);
  const base = {
    requirementId: input.requirementId,
    requirement: input.requirement,
  };

  // Informational / non-scoring — do not force GREEN/RED
  if (/^INFORMATIONAL$/i.test(input.category)) {
    return {
      ...base,
      status: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      page: null,
      section: null,
      rationale: "Informational / procedural content — not scored as a compliance requirement.",
    };
  }

  // —— Explicit certification / compliance ——
  const certNeedle =
    text.match(/\b(ISO\s?\d+|PCI\s?DSS|Cyber Essentials(?:\sPlus)?)\b/i)?.[0] ?? null;
  if (certNeedle) {
    const needleKey = normalize(certNeedle).replace(/\s+/g, "");
    const item =
      input.knowledge.certifications.find((c) => {
        const nameKey = normalize(c.name).replace(/\s+/g, "");
        return nameKey.includes(needleKey) || needleKey.includes(nameKey);
      }) ?? null;
    if (item?.status === "AVAILABLE") {
      return {
        ...base,
        status: "MATCHED",
        evidence: item.detail ?? item.provenance.originalValue,
        sourceDocument: item.provenance.sourceDocument,
        page: item.provenance.page,
        section: item.provenance.section,
        rationale: `Company evidence lists ${item.name} as available.`,
      };
    }
    if (item?.status === "NOT_HELD") {
      return {
        ...base,
        status: "FAILED",
        evidence: item.detail ?? item.provenance.originalValue,
        sourceDocument: item.provenance.sourceDocument,
        page: item.provenance.page,
        section: item.provenance.section,
        rationale: `Company profile explicitly states ${item.name} is not held.`,
      };
    }
    if (item?.status === "VERIFY") {
      return {
        ...base,
        status: "UNCERTAIN",
        evidence: item.detail,
        sourceDocument: item.provenance.sourceDocument,
        page: item.provenance.page,
        section: item.provenance.section,
        rationale: `${item.name} requires verification against company evidence.`,
      };
    }
    return {
      ...base,
      status: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      page: null,
      section: null,
      rationale: `No company evidence found for ${certNeedle}.`,
    };
  }

  // —— 24/7: explicit negative → FAILED (RED); unknown → UNCERTAIN (YELLOW) ——
  if (/24\s*\/\s*7|round[- ]the[- ]clock|24x7/i.test(text)) {
    const lim = input.knowledge.limitations.find((l) =>
      /24\s*\/\s*7|round[- ]the[- ]clock|no\s+stated\s+24|service desk/i.test(l.value),
    );
    if (lim) {
      return {
        ...base,
        status: "FAILED",
        evidence: lim.value,
        sourceDocument: lim.provenance.sourceDocument,
        page: lim.provenance.page,
        section: lim.provenance.section,
        rationale:
          "Explicit negative evidence: company profile states absence of 24/7 support operation.",
      };
    }
    return {
      ...base,
      status: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      page: null,
      section: null,
      rationale: "24/7 support evidence unavailable (unknown) in company knowledge.",
    };
  }

  // —— Specialized infrastructure / HCI / virtualization ——
  // Do NOT treat generic software or cloud wording as proof of HCI capability.
  if (SPECIALIZED_INFRA_REQ.test(text)) {
    const infra = knowledgeHasSpecializedInfra(input.knowledge);
    if (infra.hit) {
      return {
        ...base,
        status: "MATCHED",
        evidence: infra.evidence,
        sourceDocument: infra.sourceDocument,
        page: infra.page,
        section: infra.section,
        rationale:
          "Company evidence explicitly supports virtualization / hyperconverged infrastructure capability.",
      };
    }
    return {
      ...base,
      status: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      page: null,
      section: null,
      rationale:
        "Specialized virtualization / hyperconverged infrastructure is required; company evidence does not explicitly support this capability.",
    };
  }

  // —— Public-sector / government / municipal experience ——
  if (PUBLIC_SECTOR_REQ.test(text)) {
    const publicProjects = input.knowledge.projects.filter(isPublicSectorProject);
    if (publicProjects.length > 0) {
      const p = publicProjects[0];
      return {
        ...base,
        status: "MATCHED",
        evidence: `${p.name}${p.clientSector ? ` (${p.clientSector})` : ""}${
          p.description ? ` — ${p.description.slice(0, 120)}` : ""
        }`,
        sourceDocument: p.provenance.sourceDocument,
        page: p.provenance.page,
        section: p.provenance.section,
        rationale:
          "Project reference includes public-sector / municipal / citizen-services context.",
      };
    }
    return {
      ...base,
      status: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      page: null,
      section: null,
      rationale: "No public-sector contextual project evidence found.",
    };
  }

  // —— Geography ——
  if (
    GEO_REQ.test(text) ||
    (/morocco|maroc|geographic|delivery capability|based delivery|nationwide|domicile|livraison/i.test(
      text,
    ) &&
      /morocco|maroc|country|location|delivery|based|domicile|rabat/i.test(text))
  ) {
    const geo = geographyMatches(input.knowledge, text);
    if (geo.hit) {
      return {
        ...base,
        status: "MATCHED",
        evidence: geo.evidence,
        sourceDocument: geo.sourceDocument,
        page: geo.page,
        section: geo.section,
        rationale: "Company geographic coverage / location matches tender delivery geography.",
      };
    }
    if (/morocco|maroc|geographic|delivery capability|based|domicile/i.test(text)) {
      return {
        ...base,
        status: "UNCERTAIN",
        evidence: null,
        sourceDocument: null,
        page: null,
        section: null,
        rationale: "Geographic delivery requirement could not be confirmed from company evidence.",
      };
    }
  }

  // —— Operational capacity ——
  const capacityHit = matchOperationalCapacity(input.knowledge, text);
  if (capacityHit) {
    return { ...capacityHit, ...base, requirement: input.requirement };
  }

  // —— Capability / project semantic match ——
  // Prefer software/application language; do not soft-match specialized infra (handled above).
  const matchedCaps = input.knowledge.capabilities.filter((c) =>
    capabilityMatchesText(c.normalizedValue, text),
  );
  const matchedProjects = input.knowledge.projects.filter((p) => {
    const blob = normalize(projectBlob(p));
    return (
      (capabilityMatchesText("Web Application Development", text) &&
        /portal|web|dashboard|portail|application/i.test(blob)) ||
      (capabilityMatchesText("Mobile Application Development", text) && /mobile/i.test(blob)) ||
      (capabilityMatchesText("API Integration", text) && /api|integration/i.test(blob)) ||
      (capabilityMatchesText("Cloud Solutions", text) &&
        /cloud|docker|deploy/i.test(blob) &&
        !SPECIALIZED_INFRA_REQ.test(text)) ||
      (capabilityMatchesText("Technical Support", text) &&
        /support|maintenance|incident/i.test(text) &&
        /support|maintenance|incident/i.test(blob)) ||
      (capabilityMatchesText("Application Maintenance", text) &&
        /maintenance|logiciel|software/i.test(text) &&
        /maintenance|application/i.test(blob))
    );
  });

  if (matchedCaps.length > 0) {
    const cap = matchedCaps[0];
    const project = matchedProjects[0];
    const evidence = project
      ? `${cap.normalizedValue}; project: ${project.name}`
      : cap.originalValue;
    return {
      ...base,
      status: "MATCHED",
      evidence,
      sourceDocument: project?.provenance.sourceDocument ?? cap.provenance.sourceDocument,
      page: project?.provenance.page ?? cap.provenance.page,
      section: project?.provenance.section ?? cap.provenance.section,
      rationale: project
        ? `Capability ${cap.normalizedValue} supported by project evidence ${project.name}.`
        : `Normalized capability ${cap.normalizedValue} matches tender language.`,
    };
  }

  // Soft token overlap with services
  for (const s of input.knowledge.services) {
    if (n.includes(normalize(s.normalizedValue)) || n.includes(normalize(s.originalValue))) {
      return {
        ...base,
        status: "MATCHED",
        evidence: s.originalValue,
        sourceDocument: s.provenance.sourceDocument,
        page: s.provenance.page,
        section: s.provenance.section,
        rationale: "Direct service wording overlap with company profile.",
      };
    }
  }

  // Healthcare limitation — explicit negative when mandatory; YELLOW when preferred/unknown depth
  if (/healthcare|hospital|clinical/i.test(text)) {
    const lim = input.knowledge.limitations.find((l) => /healthcare/i.test(l.value));
    if (lim) {
      return {
        ...base,
        status: input.mandatory ? "FAILED" : "UNCERTAIN",
        evidence: lim.value,
        sourceDocument: lim.provenance.sourceDocument,
        page: lim.provenance.page,
        section: lim.provenance.section,
        rationale: "Company limitation: no healthcare-specific experience.",
      };
    }
  }

  // Large contract experience (MAD 1,000,000+) — do not invent qualifying contracts
  if (/mad\s*1[\s,]*000[\s,]*000|above\s+mad\s*1|minimum previous contract/i.test(text)) {
    const lim = input.knowledge.limitations.find((l) =>
      /mad\s*1[\s,]*000[\s,]*000|above\s+mad\s*1|limited experience with contracts/i.test(l.value),
    );
    if (lim) {
      return {
        ...base,
        status: "UNCERTAIN",
        evidence: lim.value,
        sourceDocument: lim.provenance.sourceDocument,
        page: lim.provenance.page,
        section: lim.provenance.section,
        rationale:
          "Company states limited experience above MAD 1,000,000 — requires confirmation against exact tender criteria.",
      };
    }
  }

  return {
    ...base,
    status: "UNCERTAIN",
    evidence: null,
    sourceDocument: null,
    page: null,
    section: null,
    rationale: "Insufficient company evidence to confirm this requirement.",
  };
}

export function matchAllRequirements(input: {
  requirements: {
    id?: string;
    category: string;
    description: string;
    mandatory: boolean;
    value?: string | null;
  }[];
  knowledge: CompanyKnowledge;
}): RequirementMatchResult[] {
  return input.requirements.map((r) =>
    matchRequirementToKnowledge({
      requirementId: r.id,
      requirement: r.description,
      category: r.category,
      mandatory: r.mandatory,
      value: r.value,
      knowledge: input.knowledge,
    }),
  );
}
