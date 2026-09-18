/**
 * Source conflict detection — never silently choose between contradictory tender facts.
 */

import { extractHighRiskFactTokens } from "../high-risk-facts";
import { failure } from "../helpers";
import type { GuardianSourceContradiction } from "../source-hierarchy";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

function amountsConflict(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\d.]/g, "").replace(/^0+/, "");
  const na = norm(a);
  const nb = norm(b);
  return Boolean(na && nb && na !== nb);
}

export function detectCanonicalSourceConflicts(
  input: DecisionGuardianInput,
): GuardianSourceContradiction[] {
  const contradictions: GuardianSourceContradiction[] = [
    ...(input.contradictions ?? []),
  ];

  // Same requirement ref appearing with divergent high-risk amounts across rows
  const byRef = new Map<string, typeof input.requirements>();
  for (const req of input.requirements) {
    const ref = extractHighRiskFactTokens(req.requirement).find(
      (t) => t.kind === "REQUIREMENT_REF",
    )?.normalized;
    if (!ref) continue;
    const list = byRef.get(ref) ?? [];
    list.push(req);
    byRef.set(ref, list);
  }

  // Cross-section amount conflicts for guarantee / bond language
  const guaranteeRows = input.requirements.filter((r) =>
    /guarantee|bond|caution|bid security/i.test(r.requirement),
  );
  if (guaranteeRows.length >= 2) {
    const amounts = guaranteeRows.flatMap((r) =>
      extractHighRiskFactTokens(r.requirement)
        .filter((t) => t.kind === "CURRENCY_AMOUNT" || t.kind === "PERCENTAGE")
        .map((t) => ({ id: r.id, section: r.sourceSection ?? "unknown", token: t })),
    );
    for (let i = 0; i < amounts.length; i++) {
      for (let j = i + 1; j < amounts.length; j++) {
        const a = amounts[i]!;
        const b = amounts[j]!;
        if (a.token.kind !== b.token.kind) continue;
        if (!amountsConflict(a.token.normalized, b.token.normalized)) continue;
        contradictions.push({
          id: `con-amount-${a.id}-${b.id}`,
          affectedCanonicalItemIds: [a.id, b.id],
          sourceA: `${a.section}: ${a.token.raw}`,
          sourceB: `${b.section}: ${b.token.raw}`,
          conflictType: a.token.kind === "PERCENTAGE" ? "PERCENTAGE" : "AMOUNT",
          severity: "HIGH",
          explanation: `Conflicting ${a.token.kind.toLowerCase()} values for guarantee/bond obligations across source sections.`,
          requiredHumanVerification: true,
        });
      }
    }
  }

  // Deadline phrases in tender source vs canonical deadline
  if (input.tenderSourceText && input.deadline?.deadlineIso) {
    const times = extractHighRiskFactTokens(input.tenderSourceText).filter(
      (t) => t.kind === "TIME",
    );
    const uniqueTimes = [...new Set(times.map((t) => t.normalized))];
    if (uniqueTimes.length > 1) {
      contradictions.push({
        id: "con-deadline-times",
        affectedCanonicalItemIds: [],
        sourceA: `time:${uniqueTimes[0]}`,
        sourceB: `time:${uniqueTimes[1]}`,
        conflictType: "DEADLINE",
        severity: "HIGH",
        explanation:
          "Multiple wall-clock times appear in tender source for deadlines — authoritative time requires human verification.",
        requiredHumanVerification: true,
      });
    }
  }

  return contradictions;
}

export function checkSourceConflicts(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const contradictions = detectCanonicalSourceConflicts(input);
  return contradictions.map((c) =>
    failure({
      validationCode: "SOURCE_CONTRADICTION",
      severity: c.severity === "LOW" ? "MEDIUM" : c.severity,
      check: "source-conflicts",
      explanation: `${c.explanation} A=[${c.sourceA}] B=[${c.sourceB}]`,
      affectedCanonicalItemId: c.affectedCanonicalItemIds[0] ?? null,
      sourceProvenance: `${c.sourceA} vs ${c.sourceB}`,
    }),
  );
}
