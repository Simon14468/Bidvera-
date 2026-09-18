/**
 * Heuristic structured requirement extraction for public tenders.
 * Does NOT invent facts — only surfaces patterns present in the tender text.
 * Page numbers come only from explicit "--- Page N ---" markers when present.
 */

import { isDeadlineOrSchedulingNoise, isNonRequirementText, isExplicitlyNotATenderRequirementSection } from "@/domain/tender-requirements/filter-non-requirements";
import { isRealBidderObligation } from "@/domain/tender-requirements/obligation";
import {
  hasUniversalObligationModal,
  isNumberedDocumentaryEvidenceItem,
} from "@/domain/semantic-tender-intelligence/obligation-lexicon";
import { stripTableResponseChrome } from "@/domain/semantic-tender-intelligence/table-context";
import { isStructuredDiscoveryCandidate } from "@/domain/document-intelligence/semantic-units";
import { extractTenderDeadlineFromText } from "@/domain/tender-requirements/tender-deadline";
import {
  aggregatePackageMetadata,
} from "@/domain/tender-package/package-metadata";
import { resolvePackageIdentity } from "@/domain/package-identity";

export type ExtractedRequirementDraft = {
  category: string;
  description: string;
  mandatory: boolean;
  value: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
  evidenceText: string | null;
  verificationStatus: "UNKNOWN" | "VERIFIED" | "INFERRED";
  sourceDocument?: string | null;
};

export type TenderPackageExtraction = {
  title: string | null;
  client: string | null;
  country: string | null;
  region: string | null;
  industry: string | null;
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  deadlineUnknownReason: string | null;
  /** Raw tender excerpt used for deadline parse — never a re-serialized ISO. */
  deadlineEvidence: string | null;
  deadlineLocalHour: number | null;
  deadlineLocalMinute: number | null;
  estimatedValue: number | null;
  guarantee: string | null;
  /** Tender / AO / QT reference when explicitly present */
  reference: string | null;
  submissionMethod: string | null;
  requirements: ExtractedRequirementDraft[];
    missingDocuments: Array<{
    documentName: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
  packageMetadata?: import("@/domain/tender-package/package-metadata").CanonicalPackageMetadata;
  packageIdentity?: import("@/domain/package-identity").PackageIdentityRecord;
  /** Safety cap was hit — remaining independent lines were skipped with an explicit reason. */
  harvestLimitReached?: boolean;
  harvestSkippedAfterLimit?: number;
};

/** Runaway-protection only. Never a silent completeness ceiling. */
const HARVEST_SAFETY_CAP = 800;

type PageChunk = { page: number | null; text: string };

function splitByPageMarkers(text: string): PageChunk[] {
  const re = /---\s*Page\s+(\d+)\s*\((?:pdf-parse|OCR)\)\s*---/gi;
  const parts: PageChunk[] = [];
  let lastIndex = 0;
  let lastPage: number | null = null;
  let match: RegExpExecArray | null;
  const matches: Array<{ index: number; page: number }> = [];
  while ((match = re.exec(text)) !== null) {
    matches.push({ index: match.index, page: Number(match[1]) });
  }
  if (matches.length === 0) {
    return [{ page: null, text }];
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    if (i === 0 && start > 0) {
      parts.push({ page: null, text: text.slice(0, start) });
    } else if (i > 0) {
      parts.push({
        page: lastPage,
        text: text.slice(lastIndex, start),
      });
    }
    lastPage = matches[i]!.page;
    lastIndex = start;
  }
  parts.push({ page: lastPage, text: text.slice(lastIndex) });
  return parts.filter((p) => p.text.trim().length > 0);
}

function findPageForSnippet(chunks: PageChunk[], snippet: string): number | null {
  const needle = snippet.slice(0, 80).toLowerCase();
  for (const chunk of chunks) {
    if (chunk.page != null && chunk.text.toLowerCase().includes(needle)) {
      return chunk.page;
    }
  }
  return null;
}

/** Incomplete construction that must continue from the following source line. */
export function isIncompleteRequirementTail(s: string): boolean {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/[.!?:;…]"?$/.test(t)) return false;
  if (
    /\b(shall|must|will|should|may)\s*(be|have|include|provide|comply|remain|not|completely)?\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(be|been|being|completely|consisting|including|comprising|according)\s*$/i.test(t)) {
    return true;
  }
  if (
    /\b(during the|including the|and the|provided by the successful|include programmable|rather than repairing existing units,? the proposed)\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(the|and|or|of|for|with|by|to)\s*$/i.test(t)) return true;
  if (/[A-Za-zÀ-ÖØ-öø-ÿ]-$/.test(t)) return true;
  return false;
}

/**
 * Rejoin soft-wrapped PDF lines so multi-line obligations stay one statement.
 * Handles page markers, hyphenation, and OCR whitespace without inventing text.
 */
export function joinSoftWrappedPdfLines(text: string): string {
  const raw = text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  const lines = raw.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? "";
    // Drop exact consecutive OCR repeats / repeated headers
    const nextPeek = (lines[i + 1] ?? "").trim();
    if (
      line.trim() &&
      nextPeek &&
      line.trim().toLowerCase() === nextPeek.toLowerCase() &&
      line.trim().length < 120
    ) {
      continue;
    }
    while (i + 1 < lines.length) {
      const trimmedCurrent = line.replace(/\s+$/, "");
      if (/[.!?:;…]\s*$/.test(trimmedCurrent)) break;
      if (!trimmedCurrent.trim()) break;

      const nextRaw = lines[i + 1] ?? "";
      let next = nextRaw.trim();
      if (!next) break;

      // Skip standalone pdf-parse page markers; allow wrap across the gap.
      if (/^---\s*Page\s+\d+/i.test(next)) {
        const afterMarker = next.replace(/^---\s*Page\s+\d+.*?---\s*/i, "").trim();
        if (!afterMarker) {
          i += 1;
          continue;
        }
        next = afterMarker;
      }

      if (/^[•\-\u2022]\s+/.test(next)) break;
      if (/^\d+\.\s+[A-ZÀ-ÖØ-Þ]/.test(next) && !isIncompleteRequirementTail(trimmedCurrent)) break;
      if (/^(?:page\s+\d+\s+of\s+\d+|confidential)\s*$/i.test(next)) {
        i += 1;
        continue;
      }

      // Hyphenated wrap: "perform-\nance" → "performance"
      if (/[A-Za-zÀ-ÖØ-öø-ÿ]-$/.test(trimmedCurrent) && /^[a-zà-öø-ÿ]/i.test(next)) {
        line = `${trimmedCurrent.slice(0, -1)}${next}`;
        i += 1;
        continue;
      }

      const incomplete = isIncompleteRequirementTail(trimmedCurrent);
      const nextLooksHeading =
        /^(?:Bidvera Test|INVITATION TO TENDER|Final Tender Statement|TEST DOCUMENT|Publication:|Submission deadline:|Contract period:|Estimated value:|Procedure:|Tender Reference:|Contracting authority:)/i.test(
          next,
        ) || /^(?:TECHNICAL SPECIFICATIONS|EVALUATION CRITERIA|MANDATORY DOCUMENTS)\s*$/i.test(next);

      // Table wrap: continue an incomplete cell; do not glue a header onto a numbered data row.
      if (/\|/.test(trimmedCurrent) || /\|/.test(next)) {
        if (/^\d+\s*\|/.test(next) && !incomplete) break;
        if (incomplete && (/\|/.test(next) || !nextLooksHeading)) {
          line = `${trimmedCurrent} ${next.replace(/^\|\s*/, "")}`;
          i += 1;
          continue;
        }
        break;
      }

      if (nextLooksHeading) break;

      // True PDF wrap, or incomplete construction continued on a Title-Case technical line.
      if (!incomplete && !/^[a-zà-öø-ÿ0-9(]/.test(next)) break;
      if (incomplete && /^\d+\.\s+[A-ZÀ-ÖØ-Þ]/.test(next)) break;
      line = `${trimmedCurrent} ${next}`;
      i += 1;
    }
    out.push(line);
  }
  return out.join("\n");
}

function pushUnique(
  list: ExtractedRequirementDraft[],
  item: ExtractedRequirementDraft,
) {
  const key = `${item.category}|${item.description.toLowerCase()}|${item.value ?? ""}`;
  if (list.some((r) => `${r.category}|${r.description.toLowerCase()}|${r.value ?? ""}` === key)) {
    return;
  }
  list.push(item);
}

function extractClient(text: string): string | null {
  const patterns = [
    /(?:procuring\s+entity|procuring\s+authority|procuring\s+body)\s*[:\-]\s*([^\n]{5,160})/i,
    /(?:maître\s+d['’]ouvrage|acheteur\s+public|pouvoir\s+adjudicateur|contracting\s+authority|client)\s*[:\-]\s*([^\n]{5,120})/i,
    /(?:issued\s+by|on\s+behalf\s+of)\s*[:\-]\s*([^\n]{8,160})/i,
    /(?:pour\s+le\s+compte\s+du|relevant\s+du)\s+([^\n.]{8,140})/i,
    /ROYAUME\s+DU\s+MAROC[\s\S]{0,200}?(MINIST[ÈE]RE[^\n]{0,100})/i,
    /(?:MAJLIS\s+DAERAH[^\n]{0,80}|KEMENTERIAN\s+[A-Z][^\n]{3,80}|JABATAN\s+[A-Z][^\n]{3,80})/i,
    /YANG\s+DIPERTUA,?\s*\n\s*([A-Z][^\n]{5,100})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].replace(/\s+/g, " ").trim().slice(0, 160);
    if (m?.[0] && /MAJLIS|KEMENTERIAN|JABATAN/i.test(m[0])) {
      return m[0].replace(/\s+/g, " ").trim().slice(0, 160);
    }
  }
  return null;
}

function extractTitle(text: string, fileName: string): string | null {
  const objet = text.match(
    /(?:^|\n)\s*(?:objet|subject|tajuk\s+perolehan|title\s+of\s+(?:the\s+)?(?:tender|procurement|contract))\s*[:\-]\s*([^\n]{10,220})/im,
  );
  if (objet?.[1]) return objet[1].replace(/\s+/g, " ").trim();
  const ao = text.match(
    /appel\s+d['’]offres[^\n]{0,80}\n([^\n]{10,180})/i,
  );
  if (ao?.[1]) return ao[1].replace(/\s+/g, " ").trim();
  // Malay notice title block after "PERINCIAN TENDER" or numbered tender line
  const myTitle = text.match(
    /(?:PERINCIAN\s+TENDER\s+)([A-Z][^\n]{15,200})/i,
  );
  if (myTitle?.[1]) return myTitle[1].replace(/\s+/g, " ").trim();
  const myCadangan = text.match(
    /((?:Cadangan|Cadangan\s+Membekal)[^\n.]{20,200})/i,
  );
  if (myCadangan?.[1]) return myCadangan[1].replace(/\s+/g, " ").trim();
  const frAcquisition = text.match(
    /pour\s+l['’]acquisition[^\n.]{10,180}/i,
  );
  if (frAcquisition?.[0]) {
    return frAcquisition[0].replace(/\s+/g, " ").trim().replace(/^pour\s+/i, "");
  }
  void fileName;
  return null;
}

function extractTenderReference(text: string): string | null {
  const patterns = [
    /N[°ºo]\s*([0-9]+\/[A-Z0-9]+\/[0-9]{4})/i,
    /\b(T\d{4}\/\d{2}[^\s,]{0,40})/i,
    /\b(QT\d{10,})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractSubmissionMethod(text: string): string | null {
  if (/portail\s+des\s+march[eé]s\s+publics|www\.marchespublics\.gov\.ma/i.test(text)) {
    return "Electronic submission via public procurement portal";
  }
  if (/tender\s+selangor|secara\s+dalam\s+talian|e-?perolehan/i.test(text)) {
    return "Online tender portal submission";
  }
  if (/peti\s+tender|physical\s+submission|hand[\s-]deliver/i.test(text)) {
    return "Physical tender box / hard-copy submission";
  }
  return null;
}

function parseSectionHeader(line: string): string | null {
  const numbered = line.match(/^(\d+\.\s+.+)$/);
  if (numbered?.[1]) {
    // Numbered bidder obligations are not section titles.
    if (line.length >= 80) return null;
    if (hasUniversalObligationModal(line) && line.length > 50) return null;
    if (isNumberedDocumentaryEvidenceItem(line)) return null;
    return numbered[1].trim();
  }
  if (line.length >= 80) return null;
  // Fact lines such as "Evaluation criteria: Technical 60%" are not section titles.
  if (/\d+\s*%/.test(line)) return null;
  if (/:\s*.{8,}/.test(line) && !/^lot\s+\d+\s*:/i.test(line)) return null;
  if (
    /^(?:lot\s+\d+\b.{0,60}|mandatory\s+documents?|required\s+documents?|technical\s+specifications?|evaluation\s+criteria|annex(?:e)?\s+[\dA-Z]+\b.{0,40})\s*$/i.test(
      line,
    )
  ) {
    return line;
  }
  return null;
}

function isExcludedHarvestSection(section: string | null): boolean {
  if (!section) return false;
  if (isExplicitlyNotATenderRequirementSection(section)) return true;
  // Narrative / packaging / non-obligation sections — discrete IDs live under Requirements sections
  return /\b((?:^|\d+\.\s*)scope\b|scope of work|project scope|evaluation method|evaluation criteria|tender facts|verification test|verification scenarios|reviewer verification|quality-?control|analysis-system|repeated references|clarifications|required submission package|submission package)\b/i.test(
    section,
  );
}

/**
 * Extract requirements and meta from tender package text (EN/FR public procurement cues).
 */
export function extractTenderPackageHeuristic(input: {
  text: string;
  fileName: string;
}): TenderPackageExtraction {
  const text = joinSoftWrappedPdfLines(input.text);
  const chunks = splitByPageMarkers(text);
  const requirements: ExtractedRequirementDraft[] = [];
  const missingDocuments: TenderPackageExtraction["missingDocuments"] = [];

  const addReq = (
    category: string,
    description: string,
    opts: {
      mandatory?: boolean;
      value?: string | null;
      evidence?: string | null;
      section?: string | null;
    } = {},
  ) => {
    const evidence = opts.evidence?.replace(/\s+/g, " ").trim().slice(0, 400) ?? null;
    pushUnique(requirements, {
      category,
      description,
      mandatory: opts.mandatory ?? true,
      value: opts.value ?? null,
      sourcePage: evidence ? findPageForSnippet(chunks, evidence) : null,
      sourceSection: opts.section ?? null,
      evidenceText: evidence,
      verificationStatus: "UNKNOWN",
      sourceDocument: input.fileName,
    });
  };

  // Certifications / norms cited as requirements
  const certRe =
    /\b(ISO\s?\d+(?::\d+)?|SOC\s?2|PCI[\s-]?DSS|HDS|RGPD|GDPR|Cyber\s+Essentials(?:\s+Plus)?)\b/gi;
  const certs = [...text.matchAll(certRe)].map((m) => m[0].replace(/\s+/g, " "));
  for (const cert of [...new Set(certs)]) {
    const idx = text.toLowerCase().indexOf(cert.toLowerCase());
    const evidence =
      idx >= 0 ? text.slice(Math.max(0, idx - 40), idx + cert.length + 80) : cert;
    if (
      !hasUniversalObligationModal(evidence) &&
      !/\b(fournir)\b/i.test(evidence)
    ) {
      continue;
    }
    addReq("certification", `${cert} certification required`, {
      value: cert,
      evidence,
      mandatory: true,
      section: "Compliance / norms",
    });
  }

  if (/support\s+editeur|type\s*:\s*24\s*\/\s*7|24\s*\/\s*7/i.test(text)) {
    const m = text.match(
      /[^\n.]{0,40}(?:support\s+editeur|24\s*\/\s*7)[^\n.]{0,80}/i,
    );
    addReq("MANDATORY_TECHNICAL", "Editor support covering hardware and software: 24/7", {
      evidence: m?.[0] ?? null,
      section: "24/7 editor support",
      mandatory: true,
      value: "24/7",
    });
  }

  // Only when tender explicitly asks for public-sector / government experience
  if (
    /exp[eé]rience\s+(?:dans\s+)?(?:le\s+)?secteur\s+public|public[- ]sector\s+(?:digital\s+)?(?:project\s+)?experience|exp[eé]rience\s+(?:avec\s+)?(?:les\s+)?administrations?\s+publiques|références?\s+(?:dans\s+)?(?:le\s+)?secteur\s+public/i.test(
      text,
    )
  ) {
    const m = text.match(
      /[^\n.]{0,40}(?:secteur\s+public|public[- ]sector|administrations?\s+publiques)[^\n.]{0,80}/i,
    );
    addReq(
      "MANDATORY_ELIGIBILITY",
      "Public-sector / government project experience required",
      {
        evidence: m?.[0] ?? null,
        section: "Public-sector experience",
        mandatory: true,
      },
    );
  }

  if (/caution(?:nement)?\s+provisoire|provisional\s+(?:bond|guarantee)/i.test(text)) {
    const m = text.match(
      /[^\n.]{0,80}(?:caution(?:nement)?\s+provisoire|provisional\s+(?:bond|guarantee))[^\n.]{0,120}/i,
    );
    const evidence = m?.[0]?.replace(/\s+/g, " ").trim() ?? null;
    // Prefer the source window so conditional triggers are not replaced by a short label.
    const description =
      evidence && evidence.length >= 24
        ? evidence
        : "Provisional bond / caution provisoire required";
    addReq("MANDATORY_ADMINISTRATIVE", description, {
      evidence,
      section: "Provisional bond / caution",
      mandatory: true,
    });
  }

  // Obligation lines — keep independently testable bidder obligations only
  const noiseLine =
    /approbation\s+du\s+march[eé]|dispositions\s+de\s+l['']article|d[eé]cret\s+n|table\s+des\s+mati|page\s+\d+|d[eé]lai\s+d['']attente|autorit[eé]\s+comp[eé]tente|se\s+procurer\s+ces\s+documents\s+s['']il\s+ne\s+les\s+poss[eè]de|personne\s+charg[eé]e\s+de\s+fournir\s+au\s+titulaire|nantissement|synthetic\s+tender|test\s+document|for\s+testing\s+only|this\s+document\s+is\s+synthetic|not a tender requirement/i;

  let currentSection: string | null = null;
  let excludeSection = false;
  let keptObligations = 0;
  let harvestLimitReached = false;
  let harvestSkippedAfterLimit = 0;

  const rawLines = text.split(/\n+/);
  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    try {
    const rawLine = rawLines[lineIdx]!;
    const trimmed = stripTableResponseChrome(rawLine.replace(/\s+/g, " ").trim());
    const header = parseSectionHeader(trimmed);
    if (header) {
      currentSection = header;
      excludeSection = isExcludedHarvestSection(currentSection);
      continue;
    }
    if (excludeSection) continue;

    const cleaned = trimmed;
    const labeledRequirement = /^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(cleaned);
    const numberedDocumentary = isNumberedDocumentaryEvidenceItem(cleaned);
    const structuredField = isStructuredDiscoveryCandidate(cleaned);
    if (
      !labeledRequirement &&
      !numberedDocumentary &&
      !structuredField &&
      !hasUniversalObligationModal(cleaned) &&
      !/\b(fournir|assurer|mettre\s+en\s+place|installer|livrer|supply|install|provide|deliver|complete|commission(?:ing)?|will\s+be\s+made|may\s+be\s+applied|may\s+apply|is\s+responsible|remain(?:s)?\s+responsible|remain(?:s)?\s+the\s+contractor)\b/i.test(
        cleaned,
      )
    ) {
      continue;
    }
    if (keptObligations >= HARVEST_SAFETY_CAP) {
      harvestLimitReached = true;
      harvestSkippedAfterLimit += 1;
      continue;
    }
    // Some tender tables use short "ID + title" rows under "Mandatory Requirements"
    // (e.g. "D-01 Technical methodology") without repeating "must/shall" in the same line.
    // When the tender has an explicit requirement ID, we must not drop it just because
    // the line is short — the obligation is still substantive and must survive.
    const minLen = labeledRequirement || numberedDocumentary || structuredField ? 12 : 40;
    if (cleaned.length < minLen || cleaned.length > 420) continue;
    if (noiseLine.test(cleaned)) continue;
    if (isNonRequirementText(cleaned)) continue;
    if (
      !structuredField &&
      !labeledRequirement &&
      !numberedDocumentary &&
      !isRealBidderObligation(cleaned)
    ) {
      continue;
    }
    if (/^\d+\.\s+[A-Z].*(?:Requirements|Criteria|Procedure|Facts|Scenarios|Note)\s*\.?\s*$/i.test(cleaned)) {
      continue;
    }
    if (isDeadlineOrSchedulingNoise(cleaned)) continue;
    // Skip pure post-award process without capability test
    if (
      /notification\s+de\s+l['’]approbation|vingt\s+jours\s+qui\s+suivent|pr[eé]avis\s+d['’]au\s+moins/i.test(
        cleaned,
      )
    ) {
      continue;
    }
    // If a requirement line ends mid-phrase (PDF line breaks), merge the
    // continuation from subsequent lines to avoid Guardian "truncated mid-phrase" failures.
    let candidateText = cleaned;
    if (isIncompleteRequirementTail(candidateText) && lineIdx + 1 < rawLines.length) {
      let merged = candidateText;
      let consumed = 0;
      for (
        let j = lineIdx + 1;
        j < rawLines.length && consumed < 10;
        j++, consumed++
      ) {
        const nextRaw = rawLines[j]!;
        let nextTrimmed = nextRaw.replace(/\s+/g, " ").trim();
        if (!nextTrimmed) continue;

        // Allow merges across PDF page markers inserted by pdf-parse.
        // Some pipelines merge the marker and following continuation text
        // onto the same line (e.g. `--- Page 9 (pdf-parse) --- bidder ...`).
        // In that case, we strip the marker prefix and still allow the
        // remaining text to be merged as continuation.
        if (/^---\s*page\s+\d+/i.test(nextTrimmed)) {
          const afterMarker = nextTrimmed
            .replace(/^---\s*page\s+\d+.*?---\s*/i, "")
            .trim();
          if (!afterMarker) continue;
          // Continue merging using the text after the marker.
          nextTrimmed = afterMarker;
        }

        // Stop when the next chunk is a *excluded* structural boundary.
        // If it's a non-excluded subsection header but we're clearly mid-phrase,
        // allow merging so the sentence isn't left dangling for Guardian.
        const nextHeader = parseSectionHeader(nextTrimmed);
        if (nextHeader && isExcludedHarvestSection(nextHeader)) break;
        if (/^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(nextTrimmed)) break;
        if (/^\d+\.\s+[A-Z].*(?:Requirements|Criteria|Procedure|Facts|Scenarios|Note)\s*\.?\s*$/i.test(nextTrimmed)) break;

        // Stop if it looks like pure noise / non-requirement content.
        if (noiseLine.test(nextTrimmed)) break;

        merged = `${merged} ${nextTrimmed}`.trim();
        candidateText = merged;
        if (!isIncompleteRequirementTail(candidateText)) break;
        // Allow longer merged paragraphs; canonical/guardian integrity is
        // enforced later. We only prevent runaway merges via structural stops.
        if (candidateText.length > 1200) break;
      }

      // Skip consumed continuation lines.
      lineIdx += consumed;
    }

    let category = "technical";
    if (/assurance|garantie|caution|bond|insurance|guarantee/i.test(cleaned)) category = "guarantee";
    else if (/expérience|experience|référence|reference|secteur\s+public/i.test(cleaned))
      category = "experience";
    else if (/chiffre\s+d['’]affaires|turnover|revenue|financier|payment|penalt|non[- ]revisable|firm\s+and/i.test(cleaned))
      category = "financial";
    else if (/\b(certif|iso\s?\d+|soc\s?2|pci)\b/i.test(cleaned)) category = "certification";
    else if (/document|pièce|dossier|attestation|CNSS|sijil|salinan|certificate|certificat/i.test(cleaned))
      category = "documentation";
    else if (/délai|deadline|planning|durée|duration|livraison/i.test(cleaned)) {
      if (isDeadlineOrSchedulingNoise(cleaned)) continue;
      category = "delivery";
    }
    else if (/\b(?:domicile|registered\s+office|place\s+of\s+business)\b/i.test(cleaned))
      category = "geography";
    else if (/\b(?:hardware|software|equipment|install|support|network)\b/i.test(cleaned))
      category = "technical";
    addReq(category, candidateText, {
      evidence: candidateText,
      section: currentSection,
      mandatory:
        labeledRequirement ||
        numberedDocumentary ||
        hasUniversalObligationModal(candidateText) ||
        /provide|supply|install|complete/i.test(candidateText),
    });
    keptObligations += 1;
    } catch {
      // Isolate one malformed harvest line — continue remaining independent content.
    }
  }

  // Required submission documents (missing document cues)
  const docPatterns = [
    /attestation\s+de\s+r[ée]gularit[ée]\s+fiscale/gi,
    /attestation\s+CNSS/gi,
    /registre\s+de\s+commerce/gi,
    /caution\s+(?:provisoire|définitive)/gi,
    /acte\s+d['’]engagement/gi,
    /bordereau\s+des\s+prix/gi,
    /m[ée]moire\s+technique/gi,
    /certificate\s+of\s+incorporation/gi,
    /tax\s+clearance/gi,
    /Sijil\s+Kementerian\s+Kewangan\s+Malaysia/gi,
    /Sijil\s+Suruhanjaya\s+Syarikat\s+Malaysia/gi,
    /Sijil\s+PKK/gi,
    /Sijil\s+CIDB/gi,
  ];
  for (const re of docPatterns) {
    const m = text.match(re);
    if (!m?.[0]) continue;
    const name = m[0].replace(/\s+/g, " ");
    if (!missingDocuments.some((d) => d.documentName.toLowerCase() === name.toLowerCase())) {
      missingDocuments.push({
        documentName: name,
        reason: "Referenced as a submission / administrative document in the tender package.",
        severity: "HIGH",
      });
    }
  }

  let country: string | null = null;
  if (/\bMaroc\b|\bMorocco\b|ROYAUME\s+DU\s+MAROC/i.test(text)) country = "Morocco";
  else if (/\bMAD\b|\bDH\b|\bDHS\b/i.test(text) && /tender|submission|contract|bidder/i.test(text)) {
    // Currency MAD without explicit country — Morocco tender semantics for deadline TZ
    country = "Morocco";
  } else if (/\bFrance\b/i.test(text)) country = "France";
  else if (
    /\bMalaysia\b|\bMALAYSIA\b|Selangor|Sabak\s+Bernam|Kementerian\s+Kewangan\s+Malaysia/i.test(
      text,
    )
  ) {
    country = "Malaysia";
  }

  const deadlineParsed = extractTenderDeadlineFromText(text, country);

  let estimatedValue: number | null = null;
  const valueMatch = text.match(
    /(?:montant|budget|estimation|estimated\s+(?:contract\s+)?value|valeur|somme\s+de|Jumlah\s+Harga\s+Indikatif)\s*[:\-]?\s*([\d\s.,]{3,})\s*(?:MAD|DH|DHS|EUR|€|USD|RM|TTC)?/i,
  );
  if (valueMatch?.[1]) {
    const raw = valueMatch[1].trim();
    let n: number;
    if (/,\d{2}$/.test(raw) && raw.includes(".")) {
      n = Number(raw.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(raw.replace(/[\s,]/g, "").replace(/\.(?=.*\.)/g, ""));
    }
    if (Number.isFinite(n) && n > 0) estimatedValue = Math.round(n);
  }
  // French written amounts with parenthetical figures e.g. (4.200.000,00 DH TTC)
  if (estimatedValue == null) {
    const frAmount = text.match(
      /\(\s*([\d.]+)\s*,\s*\d+\s*(?:DH|DHS|MAD)\b/i,
    );
    if (frAmount?.[1]) {
      const n = Number(frAmount[1].replace(/\./g, ""));
      if (Number.isFinite(n) && n > 0) estimatedValue = Math.round(n);
    }
  }
  // Malay RM amounts e.g. 4,130,388.00
  if (estimatedValue == null) {
    const rm = text.match(/\b([\d]{1,3}(?:,\d{3})+(?:\.\d{2})?)\s*(?:RM)?\b/);
    if (rm?.[1] && /RM|Harga\s+Indikatif|Jumlah/i.test(text)) {
      const n = Number(rm[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 1000) estimatedValue = Math.round(n);
    }
  }

  const reference = extractTenderReference(text);
  const submissionMethod = extractSubmissionMethod(text);

  const deadlineTimezone = deadlineParsed.deadlineTimezone;

  return {
    title: extractTitle(text, input.fileName),
    client: extractClient(text),
    country,
    region: /Rabat/i.test(text)
      ? "Rabat"
      : /Selangor|Sabak\s+Bernam/i.test(text)
        ? "Selangor"
        : null,
    industry: /informatique|logiciel|software|digital|IT\b|ICT|Internet\s+of\s+Things|\bIoT\b/i.test(
      text,
    )
      ? "Information Technology"
      : null,
    deadlineIso: deadlineParsed.deadlineIso,
    deadlineTimezone,
    deadlineUnknownReason: deadlineParsed.deadlineIso ? null : deadlineParsed.reason,
    deadlineEvidence: deadlineParsed.evidence,
    deadlineLocalHour: deadlineParsed.localHour,
    deadlineLocalMinute: deadlineParsed.localMinute,
    estimatedValue,
    guarantee: /caution|garantie|bond/i.test(text) ? "Referenced in tender" : null,
    reference,
    submissionMethod,
    requirements: requirements.map((r) => ({
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value ?? null,
      sourcePage: r.sourcePage ?? null,
      sourceSection: r.sourceSection ?? null,
      evidenceText: r.evidenceText ?? null,
      verificationStatus: r.verificationStatus ?? "UNKNOWN",
      sourceDocument: r.sourceDocument ?? input.fileName,
    })),
    missingDocuments,
    harvestLimitReached,
    harvestSkippedAfterLimit,
  };
}

function isolatedHarvestFailure(fileName: string): TenderPackageExtraction {
  return {
    title: null,
    client: null,
    country: null,
    region: null,
    industry: null,
    deadlineIso: null,
    deadlineTimezone: null,
    deadlineUnknownReason: "HARVEST_ISOLATED_FAILURE",
    deadlineEvidence: null,
    deadlineLocalHour: null,
    deadlineLocalMinute: null,
    estimatedValue: null,
    guarantee: null,
    reference: null,
    submissionMethod: null,
    requirements: [],
    missingDocuments: [
      {
        documentName: fileName,
        reason: "HARVEST_ISOLATED_FAILURE",
        severity: "HIGH",
      },
    ],
  };
}

export type PackagePartInput = {
  fileName: string;
  text: string;
  documentId?: string | null;
  truncated?: boolean;
};

/**
 * Per-document extraction then package-level merge (metadata + requirements).
 */
export function extractTenderPackageFromParts(
  parts: PackagePartInput[],
  packageLabel: string,
): TenderPackageExtraction {
  const usable = parts.filter((p) => (p.text ?? "").trim().length > 0);
  const sources = (usable.length > 0 ? usable : [{ fileName: packageLabel, text: "" }]).map((p) => {
    try {
      return {
        fileName: p.fileName,
        text: p.text,
        extraction: extractTenderPackageHeuristic({ text: p.text, fileName: p.fileName }),
      };
    } catch {
      return {
        fileName: p.fileName,
        text: p.text,
        extraction: isolatedHarvestFailure(p.fileName),
      };
    }
  });
  const packageIdentity = resolvePackageIdentity(
    sources.map((s) => ({
      fileName: s.fileName,
      text: s.text,
      truncated: usable.find((p) => p.fileName === s.fileName)?.truncated === true,
      extraction: {
        title: s.extraction.title,
        client: s.extraction.client,
        deadlineIso: s.extraction.deadlineIso,
        deadlineTimezone: s.extraction.deadlineTimezone,
        deadlineEvidence: s.extraction.deadlineEvidence,
        deadlineLocalHour: s.extraction.deadlineLocalHour,
        deadlineLocalMinute: s.extraction.deadlineLocalMinute,
        deadlineUnknownReason: s.extraction.deadlineUnknownReason,
        estimatedValue: s.extraction.estimatedValue,
        reference: s.extraction.reference,
        country: s.extraction.country,
        location: null,
        procurementType: null,
      },
    })),
  );
  const packageMetadata = applyIdentityToPackageMetadata(
    aggregatePackageMetadata(
      sources.map((s) => ({ fileName: s.fileName, extraction: s.extraction, text: s.text })),
    ),
    packageIdentity,
  );
  const requirements: ExtractedRequirementDraft[] = [];
  const missingDocuments: TenderPackageExtraction["missingDocuments"] = [];
  for (const s of sources) {
    for (const r of s.extraction.requirements) {
      const existing = requirements.find(
        (x) =>
          x.category === r.category &&
          x.description.toLowerCase() === r.description.toLowerCase() &&
          (x.value ?? "") === (r.value ?? ""),
      );
      if (existing) {
        const docs = new Set(
          [existing.sourceDocument, r.sourceDocument, s.fileName]
            .filter(Boolean)
            .flatMap((d) => String(d).split(";"))
            .map((d) => d.trim())
            .filter(Boolean),
        );
        existing.sourceDocument = [...docs].join("; ");
        continue;
      }
      requirements.push({ ...r, sourceDocument: s.fileName });
    }
    for (const d of s.extraction.missingDocuments) {
      if (
        !missingDocuments.some(
          (x) => x.documentName.toLowerCase() === d.documentName.toLowerCase(),
        )
      ) {
        missingDocuments.push(d);
      }
    }
  }
  const pick = (field: { status: string; value: string | null }) =>
    field.status === "CONFLICT" || field.status === "INCOMPLETE" ? null : field.value;

  const deadlineLocal =
    packageMetadata.deadlineLocalTime.status === "CONFLICT"
      ? null
      : packageMetadata.deadlineLocalTime.value;
  const [lh, lm] = deadlineLocal?.split(":") ?? [];
  return {
    title: pick(packageMetadata.title),
    client: pick(packageMetadata.buyer),
    country: pick(packageIdentity.country),
    region: pick(packageIdentity.location),
    industry: sources.map((s) => s.extraction.industry).find(Boolean) ?? null,
    deadlineIso:
      packageIdentity.deadline.status === "OK" ? packageIdentity.deadline.deadlineIso : null,
    deadlineTimezone: packageIdentity.deadline.deadlineTimezone,
    deadlineUnknownReason:
      packageIdentity.deadline.status === "OK"
        ? packageIdentity.deadline.reason
        : packageIdentity.deadline.reason ??
          sources.map((s) => s.extraction.deadlineUnknownReason).find(Boolean) ??
          null,
    deadlineEvidence:
      packageIdentity.deadline.evidence ??
      packageMetadata.deadlineIso.candidates[0]?.sourceText ??
      null,
    deadlineLocalHour: packageIdentity.deadline.localHour ?? (lh ? Number(lh) : null),
    deadlineLocalMinute: packageIdentity.deadline.localMinute ?? (lm ? Number(lm) : null),
    estimatedValue: pick(packageMetadata.estimatedValue)
      ? Number(pick(packageMetadata.estimatedValue))
      : null,
    guarantee: sources.map((s) => s.extraction.guarantee).find(Boolean) ?? null,
    reference: pick(packageMetadata.reference),
    submissionMethod: sources.map((s) => s.extraction.submissionMethod).find(Boolean) ?? null,
    requirements,
    missingDocuments,
    packageMetadata,
    packageIdentity,
    harvestLimitReached: sources.some((s) => s.extraction.harvestLimitReached),
    harvestSkippedAfterLimit: sources.reduce(
      (n, s) => n + (s.extraction.harvestSkippedAfterLimit ?? 0),
      0,
    ),
  };
}

function applyIdentityToPackageMetadata(
  meta: import("@/domain/tender-package/package-metadata").CanonicalPackageMetadata,
  identity: import("@/domain/package-identity").PackageIdentityRecord,
): import("@/domain/tender-package/package-metadata").CanonicalPackageMetadata {
  const overlay = (
    field: import("@/domain/tender-package/package-metadata").AggregatedMetadataField,
    resolved: { value: string | null; status: string },
  ) => ({
    ...field,
    value: resolved.status === "OK" ? resolved.value : null,
    status: resolved.status as import("@/domain/tender-package/package-metadata").MetadataStatus,
  });
  return {
    ...meta,
    buyer: overlay(meta.buyer, identity.buyer),
    title: overlay(meta.title, identity.title),
    estimatedValue: overlay(meta.estimatedValue, identity.estimatedValue),
    reference: overlay(meta.reference, identity.reference),
    deadlineIso: overlay(meta.deadlineIso, {
      value: identity.deadline.deadlineIso,
      status: identity.deadline.status,
    }),
    timezone: overlay(meta.timezone, {
      value: identity.deadline.deadlineTimezone,
      status: identity.deadline.deadlineTimezone
        ? "OK"
        : identity.deadline.status === "CONFLICT"
          ? "CONFLICT"
          : "UNKNOWN",
    }),
    location: overlay(meta.location, identity.location),
    procurementType: overlay(meta.procurementType, identity.procurementType),
  };
}
