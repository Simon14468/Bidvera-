/**
 * Compose the authoritative package identity record.
 */

import type { PackageIdentityPart, PackageIdentityRecord } from "./types";
import { PACKAGE_IDENTITY_VERSION } from "./types";
import { classifyPackageDocumentIdentity } from "./roles";
import { collectLabelledCandidates, fieldStatusNote, resolveIdentityField } from "./fields";
import { resolvePackageDeadline } from "./deadline";

export function resolvePackageIdentity(
  parts: PackageIdentityPart[],
): PackageIdentityRecord {
  const documents = classifyPackageDocumentIdentity(parts);
  const buyer = resolveIdentityField(collectLabelledCandidates(parts, documents, "client"));
  const title = resolveIdentityField(collectLabelledCandidates(parts, documents, "title"));
  const estimatedValue = resolveIdentityField(
    collectLabelledCandidates(parts, documents, "estimatedValue"),
  );
  const reference = resolveIdentityField(
    collectLabelledCandidates(parts, documents, "reference"),
  );
  const location = resolveIdentityField(
    collectLabelledCandidates(parts, documents, "location"),
  );
  const country = resolveIdentityField(
    collectLabelledCandidates(parts, documents, "country"),
  );
  const procurementType = resolveIdentityField(
    collectLabelledCandidates(parts, documents, "procurementType"),
  );
  const deadline = resolvePackageDeadline(parts, documents);

  return {
    version: PACKAGE_IDENTITY_VERSION,
    documents,
    buyer,
    title,
    estimatedValue,
    reference,
    location,
    country,
    procurementType,
    deadline,
  };
}

export function formatPackageIdentityNote(identity: PackageIdentityRecord): string {
  const bits = [
    fieldStatusNote("buyer", identity.buyer),
    fieldStatusNote("title", identity.title),
    fieldStatusNote("estimatedValue", identity.estimatedValue),
    fieldStatusNote("reference", identity.reference),
    fieldStatusNote("location", identity.location),
    fieldStatusNote("country", identity.country),
    fieldStatusNote("procurementType", identity.procurementType),
    identity.deadline.status === "CONFLICT"
      ? `deadline=CONFLICT (${identity.deadline.sources.map((s) => `${s.iso} [${s.fileName}]`).join(" | ")})`
      : identity.deadline.status === "INCOMPLETE"
        ? `deadline=INCOMPLETE (${identity.deadline.reason ?? "incomplete"})`
        : identity.deadline.status === "OK" && identity.deadline.deadlineIso
          ? `deadline=${identity.deadline.deadlineIso} (source=${identity.deadline.sources[0]?.fileName ?? "package"})`
          : null,
    identity.documents
      .map((d) => `${d.fileName}:${d.role}${d.completeness === "TRUNCATED" ? ":TRUNCATED" : ""}`)
      .join(","),
  ].filter(Boolean);
  return bits.join("; ");
}
