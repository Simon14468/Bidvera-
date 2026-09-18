/**
 * Package-level metadata aggregation — search every discovered document.
 * Never invent values. Conflicting authoritative values stay CONFLICT.
 */

export type MetadataStatus = "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE";

export type ProvenancedMetadataValue = {
  value: string;
  sourceFile: string;
  sourcePage: number | null;
  sourceSection: string | null;
  sourceText: string;
  confidence: number;
};

export type AggregatedMetadataField = {
  value: string | null;
  status: MetadataStatus;
  candidates: ProvenancedMetadataValue[];
};

export type CanonicalPackageMetadata = {
  buyer: AggregatedMetadataField;
  title: AggregatedMetadataField;
  reference: AggregatedMetadataField;
  deadlineIso: AggregatedMetadataField;
  deadlineLocalTime: AggregatedMetadataField;
  timezone: AggregatedMetadataField;
  currency: AggregatedMetadataField;
  publicationDate: AggregatedMetadataField;
  estimatedValue: AggregatedMetadataField;
  lots: AggregatedMetadataField;
  location: AggregatedMetadataField;
  procurementType: AggregatedMetadataField;
  documentRelationships: AggregatedMetadataField;
  corrigenda: AggregatedMetadataField;
};

export type DocumentMetadataSource = {
  fileName: string;
  text: string;
  extraction: {
    title: string | null;
    client: string | null;
    region: string | null;
    deadlineIso: string | null;
    deadlineTimezone: string | null;
    deadlineEvidence: string | null;
    deadlineLocalHour: number | null;
    deadlineLocalMinute: number | null;
    estimatedValue: number | null;
    reference: string | null;
  };
};

function foldKey(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltd|limited|llc|inc|plc|sdn|bhd)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emptyField(): AggregatedMetadataField {
  return { value: null, status: "UNKNOWN", candidates: [] };
}

function mergeUnionField(candidates: ProvenancedMetadataValue[]): AggregatedMetadataField {
  const usable = candidates.filter((c) => c.value.trim().length > 0);
  if (usable.length === 0) return emptyField();
  const unique = [...new Map(usable.map((c) => [foldKey(c.value), c])).values()];
  return {
    value: unique.map((c) => c.value).join(" | "),
    status: "OK",
    candidates: usable,
  };
}

function mergeField(candidates: ProvenancedMetadataValue[]): AggregatedMetadataField {
  const usable = candidates.filter((c) => c.value.trim().length > 0);
  if (usable.length === 0) return emptyField();
  const groups = new Map<string, ProvenancedMetadataValue[]>();
  for (const c of usable) {
    const k = foldKey(c.value);
    if (!k) continue;
    const list = groups.get(k) ?? [];
    list.push(c);
    groups.set(k, list);
  }
  const keys = [...groups.keys()];
  if (keys.length === 0) return emptyField();
  if (keys.length > 1) {
    return { value: null, status: "CONFLICT", candidates: usable };
  }
  const best = (groups.get(keys[0]!) ?? []).sort((a, b) => b.confidence - a.confidence)[0]!;
  return { value: best.value, status: "OK", candidates: usable };
}

function candidate(
  sourceFile: string,
  value: string | null | undefined,
  sourceText: string,
  confidence: number,
  sourcePage: number | null = null,
): ProvenancedMetadataValue | null {
  if (!value?.trim()) return null;
  return {
    value: value.replace(/\s+/g, " ").trim(),
    sourceFile,
    sourcePage,
    sourceSection: null,
    sourceText: sourceText.replace(/\s+/g, " ").trim().slice(0, 240),
    confidence,
  };
}

function extractCurrency(text: string): string | null {
  const m = text.match(/\b(MAD|EUR|USD|INR|GBP|RM|DHS?)\b/);
  return m?.[1] ?? null;
}

function extractPublicationDate(text: string): string | null {
  const m = text.match(
    /(?:publication\s+date|date\s+of\s+publication|published\s+on)\s*[:\-]?\s*([^\n]{6,40})/i,
  );
  return m?.[1]?.replace(/\s+/g, " ").trim().slice(0, 40) ?? null;
}

function extractLots(text: string): string | null {
  const lots = [...text.matchAll(/\bLOT\s*[:\-]?\s*([\dIVXLC]+)\b/gi)].map((m) =>
    `LOT ${m[1]}`.toUpperCase(),
  );
  if (lots.length === 0) return null;
  return [...new Set(lots)].join(", ");
}

function extractLocation(text: string): string | null {
  const m = text.match(
    /(?:place\s+of\s+(?:performance|delivery|execution)|delivery\s+location|lieu\s+(?:de\s+)?(?:livraison|execution)|location)\s*[:\-]\s*([^\n]{4,80})/i,
  );
  return m?.[1]?.replace(/\s+/g, " ").trim().slice(0, 80) ?? null;
}

function extractProcurementType(text: string): string | null {
  if (/\bNCB\b|national\s+competitive\s+bidd/i.test(text)) return "NCB";
  if (/\bICB\b|international\s+competitive\s+bidd/i.test(text)) return "ICB";
  if (/open\s+tender|appel\s+d['’]offres\s+ouvert/i.test(text)) return "Open tender";
  if (/\bRFQ\b|request\s+for\s+quotation/i.test(text)) return "RFQ";
  return null;
}

function extractCorrigendum(fileName: string, text: string): string | null {
  if (/corrigendum|addendum|amendment/i.test(fileName) || /corrigendum|addendum/i.test(text)) {
    const m = text.match(/corrigendum[^\n]{0,80}|addendum[^\n]{0,80}/i);
    return (m?.[0] ?? `Corrigendum/addendum in ${fileName}`).replace(/\s+/g, " ").trim().slice(0, 160);
  }
  return null;
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().toLowerCase();
}

export function aggregatePackageMetadata(
  sources: DocumentMetadataSource[],
): CanonicalPackageMetadata {
  const buyer: ProvenancedMetadataValue[] = [];
  const title: ProvenancedMetadataValue[] = [];
  const reference: ProvenancedMetadataValue[] = [];
  const deadlineIso: ProvenancedMetadataValue[] = [];
  const deadlineLocalTime: ProvenancedMetadataValue[] = [];
  const timezone: ProvenancedMetadataValue[] = [];
  const currency: ProvenancedMetadataValue[] = [];
  const publicationDate: ProvenancedMetadataValue[] = [];
  const estimatedValue: ProvenancedMetadataValue[] = [];
  const lots: ProvenancedMetadataValue[] = [];
  const location: ProvenancedMetadataValue[] = [];
  const procurementType: ProvenancedMetadataValue[] = [];
  const documentRelationships: ProvenancedMetadataValue[] = [];
  const corrigenda: ProvenancedMetadataValue[] = [];

  for (const src of sources) {
    const e = src.extraction;
    const t = src.text;
    const f = src.fileName;
    const push = (list: ProvenancedMetadataValue[], c: ProvenancedMetadataValue | null) => {
      if (c) list.push(c);
    };

    push(buyer, candidate(f, e.client, e.client ?? t.slice(0, 120), e.client ? 0.85 : 0));
    const titleLooksInvented =
      !e.title || foldKey(e.title) === foldKey(fileStem(f)) || foldKey(e.title) === foldKey(f);
    if (!titleLooksInvented) {
      push(title, candidate(f, e.title, e.title ?? "", 0.7));
    }
    push(reference, candidate(f, e.reference, e.reference ?? "", 0.8));
    push(
      deadlineIso,
      candidate(f, e.deadlineIso, e.deadlineEvidence ?? e.deadlineIso ?? "", 0.9, null),
    );
    if (e.deadlineLocalHour != null && e.deadlineLocalMinute != null) {
      const hm = `${String(e.deadlineLocalHour).padStart(2, "0")}:${String(e.deadlineLocalMinute).padStart(2, "0")}`;
      push(deadlineLocalTime, candidate(f, hm, e.deadlineEvidence ?? hm, 0.9));
    }
    if (e.deadlineTimezone) {
      push(
        timezone,
        candidate(f, e.deadlineTimezone, e.deadlineEvidence ?? e.deadlineTimezone, 0.95),
      );
    }
    push(currency, candidate(f, extractCurrency(t), extractCurrency(t) ?? "", 0.75));
    push(
      publicationDate,
      candidate(f, extractPublicationDate(t), extractPublicationDate(t) ?? "", 0.7),
    );
    if (e.estimatedValue != null) {
      push(
        estimatedValue,
        candidate(f, String(e.estimatedValue), String(e.estimatedValue), 0.7),
      );
    }
    push(lots, candidate(f, extractLots(t), extractLots(t) ?? "", 0.6));
    push(location, candidate(f, extractLocation(t) ?? e.region, extractLocation(t) ?? e.region ?? "", 0.6));
    push(procurementType, candidate(f, extractProcurementType(t), extractProcurementType(t) ?? "", 0.6));
    push(documentRelationships, candidate(f, `${f}:${e.reference ?? "unreferenced"}`, f, 0.5));
    push(corrigenda, candidate(f, extractCorrigendum(f, t), extractCorrigendum(f, t) ?? "", 0.8));
  }

  const metadata: CanonicalPackageMetadata = {
    buyer: mergeField(buyer),
    title: mergeField(title),
    reference: mergeField(reference),
    deadlineIso: mergeField(deadlineIso),
    deadlineLocalTime: mergeField(deadlineLocalTime),
    timezone: mergeField(timezone),
    currency: mergeField(currency),
    publicationDate: mergeField(publicationDate),
    estimatedValue: mergeField(estimatedValue),
    lots: mergeUnionField(lots),
    location: mergeField(location),
    procurementType: mergeField(procurementType),
    documentRelationships: mergeUnionField(documentRelationships),
    corrigenda: mergeUnionField(corrigenda),
  };

  if (!metadata.timezone.value) {
    metadata.timezone = {
      value: null,
      status: metadata.timezone.candidates.length > 1 ? "CONFLICT" : "UNKNOWN",
      candidates: metadata.timezone.candidates,
    };
  }

  return metadata;
}

export function formatPackageMetadataNote(meta: CanonicalPackageMetadata): string {
  const lines: string[] = [];
  for (const [key, field] of Object.entries(meta) as [string, AggregatedMetadataField][]) {
    if (field.status === "CONFLICT") {
      const vs = field.candidates
        .map((c) => `${c.value} [${c.sourceFile}]`)
        .join(" | ");
      lines.push(`${key}=CONFLICT (${vs})`);
    } else if (field.status === "OK" && field.value) {
      const src = field.candidates.find((c) => foldKey(c.value) === foldKey(field.value!));
      lines.push(`${key}=${field.value} (source=${src?.sourceFile ?? "package"})`);
    }
  }
  return lines.join("; ");
}
