/**
 * Catalog of factors the user can safely adjust in simulation.
 */

import type { RequirementMatchStatus } from "@prisma/client";
import type { SimulationSnapshot, SimulatableFactorCatalog } from "./types";

const REQUIREMENT_STATUS_OPTIONS: RequirementMatchStatus[] = [
  "MATCHED",
  "FAILED",
  "UNCERTAIN",
  "MISSING",
];

export function buildSimulatableFactorCatalog(
  snapshot: SimulationSnapshot,
): SimulatableFactorCatalog {
  if (snapshot.companyKnowledgeOnly) {
    return {
      requirements: [],
      evidence: [],
      missingDocuments: [],
      profileFields: [],
      unavailableReason: "Company-knowledge-only analysis has no tender decision to simulate.",
    };
  }
  if (snapshot.scoringBlocked) {
    return {
      requirements: [],
      evidence: [],
      missingDocuments: [],
      profileFields: [],
      unavailableReason: "Tender extraction is incomplete — scoring and simulation are unavailable.",
    };
  }

  const readinessById = new Map(
    (snapshot.baselineReadiness?.items ?? []).map((i) => [i.id, i.status]),
  );

  return {
    requirements: snapshot.requirements.map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      mandatory: r.mandatory,
      currentStatus: r.status,
      currentReadinessStatus: readinessById.get(r.id) ?? null,
      allowedStatuses: REQUIREMENT_STATUS_OPTIONS,
    })),
    evidence: snapshot.evidence.map((e) => {
      const req = e.requirementId
        ? snapshot.requirements.find((r) => r.id === e.requirementId)
        : null;
      return {
        id: e.id,
        requirementId: e.requirementId,
        label: req
          ? `${req.description.slice(0, 80)}…`
          : e.evidenceText.slice(0, 80),
        currentVerificationStatus: e.verificationStatus,
      };
    }),
    missingDocuments: snapshot.missingDocuments.map((d) => ({
      id: d.id,
      documentName: d.documentName,
    })),
    profileFields: [
      {
        key: "certifications",
        label: "Certifications",
        currentValue: snapshot.profile.certifications.join(", ") || "None",
      },
      {
        key: "services",
        label: "Services",
        currentValue: snapshot.profile.services.join(", ") || "None",
      },
    ],
    unavailableReason: null,
  };
}
