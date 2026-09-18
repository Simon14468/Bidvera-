import { matchRequirementToKnowledge } from "@/domain/company-knowledge/match";
import type { CompanyKnowledge } from "@/domain/company-knowledge/types";
import type {
  DraftAnswerCandidate,
  DraftEvidenceRef,
  ExtractedQuestion,
} from "./types";

/**
 * Generate draft-answer candidates from company knowledge ONLY.
 * Missing / ambiguous / VERIFY knowledge → status VERIFY.
 * Never fabricates company facts.
 */
export function generateDraftAnswers(input: {
  questions: Array<Pick<ExtractedQuestion, "questionKey" | "prompt" | "questionType" | "mandatoryStatus">>;
  knowledge: CompanyKnowledge | null;
  /** Flat profile fallbacks — only used when knowledge has matching provenanced facts OR explicit profile fields with VERIFY. */
  profile?: {
    companyName?: string | null;
    country?: string | null;
    industry?: string | null;
    employeeRange?: string | null;
    certifications?: string[];
    services?: string[];
  } | null;
}): DraftAnswerCandidate[] {
  return input.questions.map((q) =>
    draftOne({
      question: q,
      knowledge: input.knowledge,
      profile: input.profile ?? null,
    }),
  );
}

function draftOne(input: {
  question: Pick<
    ExtractedQuestion,
    "questionKey" | "prompt" | "questionType" | "mandatoryStatus"
  >;
  knowledge: CompanyKnowledge | null;
  profile: {
    companyName?: string | null;
    country?: string | null;
    industry?: string | null;
    employeeRange?: string | null;
    certifications?: string[];
    services?: string[];
  } | null;
}): DraftAnswerCandidate {
  const q = input.question;

  if (q.questionType === "ATTACHMENT") {
    return verify(q.questionKey, "Attachment/document requests require human selection of Bidvera evidence — no automatic claim.");
  }
  if (q.questionType === "UNKNOWN") {
    return verify(q.questionKey, "Question type is ambiguous — draft withheld pending human review.");
  }

  if (!input.knowledge) {
    // Profile-only identity answers still marked VERIFY (no provenance trail).
    const identity = tryProfileIdentity(q.prompt, input.profile);
    if (identity) {
      return {
        questionKey: q.questionKey,
        status: "VERIFY",
        draftText: identity.text,
        evidenceRefs: [],
        confidence: 0.25,
        rationale:
          "Suggested from Company Profile fields without structured knowledge provenance — VERIFY before use.",
      };
    }
    return verify(
      q.questionKey,
      "No structured company knowledge available — cannot draft an evidence-backed answer.",
    );
  }

  const match = matchRequirementToKnowledge({
    requirement: q.prompt,
    category: categoryForQuestion(q.prompt, q.questionType),
    mandatory: q.mandatoryStatus === "MANDATORY",
    knowledge: input.knowledge,
  });

  if (match.status === "MATCHED" && match.evidence) {
    const refs: DraftEvidenceRef[] = [
      {
        sourceDocument: match.sourceDocument ?? "Company knowledge",
        page: match.page,
        section: match.section,
        excerpt: match.evidence,
      },
    ];
    return {
      questionKey: q.questionKey,
      status: "DRAFT_READY",
      draftText: match.evidence,
      evidenceRefs: refs,
      confidence: 0.7,
      rationale: match.rationale,
    };
  }

  if (match.status === "FAILED" && match.evidence) {
    // Explicit NOT_HELD — surface as VERIFY draft stating the limitation (not a fabrication).
    return {
      questionKey: q.questionKey,
      status: "VERIFY",
      draftText: match.evidence,
      evidenceRefs: [
        {
          sourceDocument: match.sourceDocument ?? "Company knowledge",
          page: match.page,
          section: match.section,
          excerpt: match.evidence,
        },
      ],
      confidence: 0.55,
      rationale: `${match.rationale} Human confirmation required.`,
    };
  }

  // UNCERTAIN / MISSING
  const identity = tryProfileIdentity(q.prompt, input.profile);
  if (identity && match.status !== "FAILED") {
    return {
      questionKey: q.questionKey,
      status: "VERIFY",
      draftText: identity.text,
      evidenceRefs: [],
      confidence: 0.3,
      rationale:
        match.rationale ||
        "Only weak profile signal available — VERIFY; do not treat as verified evidence.",
    };
  }

  return verify(
    q.questionKey,
    match.rationale ||
      "Insufficient or ambiguous company evidence — VERIFY required; no answer invented.",
  );
}

function verify(questionKey: string, rationale: string): DraftAnswerCandidate {
  return {
    questionKey,
    status: "VERIFY",
    draftText: null,
    evidenceRefs: [],
    confidence: 0,
    rationale,
  };
}

function categoryForQuestion(
  prompt: string,
  type: ExtractedQuestion["questionType"],
): string {
  if (/\b(?:ISO|PCI|Cyber\s+Essentials|certif)/i.test(prompt)) return "CERTIFICATION";
  if (/\b(?:insur|liability|indemnit)/i.test(prompt)) return "COMPLIANCE";
  if (/\b(?:country|location|geograph|based\s+in|coverage)/i.test(prompt)) {
    return "GEOGRAPHY";
  }
  if (/\b(?:staff|employee|capacity|fte|headcount)/i.test(prompt)) return "CAPACITY";
  if (/\b(?:service|capability|experience|project)/i.test(prompt)) return "CAPABILITY";
  if (type === "YES_NO") return "COMPLIANCE";
  return "GENERAL";
}

function tryProfileIdentity(
  prompt: string,
  profile: {
    companyName?: string | null;
    country?: string | null;
    industry?: string | null;
    employeeRange?: string | null;
    certifications?: string[];
    services?: string[];
  } | null,
): { text: string } | null {
  if (!profile) return null;
  const p = prompt.toLowerCase();
  if (/\b(?:company\s+name|legal\s+name|organisation\s+name|organization\s+name)\b/.test(p) && profile.companyName) {
    return { text: profile.companyName };
  }
  if (/\b(?:country|registered\s+in|based\s+in)\b/.test(p) && profile.country) {
    return { text: profile.country };
  }
  if (/\b(?:industry|sector)\b/.test(p) && profile.industry) {
    return { text: profile.industry };
  }
  if (/\b(?:employees?|staff|headcount|fte)\b/.test(p) && profile.employeeRange) {
    return { text: profile.employeeRange };
  }
  return null;
}
