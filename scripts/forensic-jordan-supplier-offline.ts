/**
 * Offline forensic — proves first wrong lifecycle value for Jordan XLSX-style clauses.
 * NO CODE CHANGES. Uses exact wording patterns from real-pack contamination artifact.
 */
import fs from "node:fs";
import { interpretSemanticStatement } from "../src/domain/semantic-tender-intelligence/interpret";
import { classifyProcurementPhase, PRE_AWARD_COMMITMENT_FRAME } from "../src/domain/semantic-tender-intelligence/phase";
import { resolveSemanticActor } from "../src/domain/semantic-tender-intelligence/actor";
import { classifyClausePurpose } from "../src/domain/semantic-tender-intelligence/clause-purpose";
import { resolveRecipient } from "../src/domain/semantic-tender-intelligence/recipient";
import { buildCanonicalSemanticCandidates } from "../src/domain/semantic-tender-intelligence/candidates";
import { StiApprovedRequirementBatch } from "../src/domain/semantic-tender-intelligence/sti-seal";
import { buildCanonicalRequirements } from "../src/domain/tender-requirements";
import { evaluateNormalizedAdmissionFirewall } from "../src/domain/tender-requirements/admission-firewall";
import {
  inferSectionRole,
  mapPackageDocumentRole,
} from "../src/domain/semantic-tender-intelligence/document-context";
import { detectTemplateStatus } from "../src/domain/semantic-tender-intelligence/template";
import { isObligationBoundaryComplete } from "../src/domain/semantic-tender-intelligence/boundary";

// Exact / near-exact clauses from real pack samples + typical XLSX flattening
const CLAUSES = [
  {
    id: "A",
    label: "transportation/offloading/placement",
    texts: [
      "The supplier shall be responsible for transportation, offloading and placement of the equipment at the Site.",
      "A12=1 | B12=The supplier shall provide transportation, offloading and placement of all goods. | C12=☐ Yes ☐ No",
      "Transportation and offloading of equipment shall be arranged by the supplier.",
    ],
  },
  {
    id: "B",
    label: "repair/replacement defective",
    texts: [
      "Any non-compliant or defective items shall be repaired or replaced at supplier expense.",
      "A23=1 | B23=Where applicable, the supplier shall repair or replace defective items at its own expense. | C23=☐ Yes ☐ No",
      "If repair is not possible, the supplier must replace the item with a new one.",
    ],
  },
  {
    id: "C",
    label: "delivery notes / installation completion / warranty certificates",
    texts: [
      "The supplier shall submit delivery notes, installation completion reports, and warranty certificates.",
      "A31=1 | B31=The supplier shall submit delivery notes, installation completion reports, and warranty certificates. | C31=☐ Yes ☐ No",
      "The supplier shall submit delivery and installation reports after delivery.",
    ],
  },
  {
    id: "E",
    label: "coordinate delivery/installation schedules",
    texts: [
      "The supplier shall coordinate delivery and installation schedules with the Purchaser.",
      "K Coordination and Scheduling 1 The supplier shall coordinate delivery and installation schedules with the site.",
    ],
  },
  {
    id: "F",
    label: "storage before installation",
    texts: [
      "The supplier shall provide storage of the equipment before installation.",
      "The supplier shall store the goods on site before installation if required.",
    ],
  },
  {
    id: "COMPARE",
    label: "correct bidder pre-award",
    texts: [
      "The Bidder shall possess a valid Commercial Registration Certificate issued by the competent authority.",
      "The Bidder shall submit a valid Commercial Registration Certificate with the proposal.",
    ],
  },
];

const DOC = "UNOPS_General_Requirements___Delivery_Table.xlsx";
const DOC_ROLE = mapPackageDocumentRole("SCHEDULE_OF_REQUIREMENTS");

function probePhasePath(text: string) {
  // Mirror phase.ts decision points for diagnostics (read-only probe)
  const EXECUTION_VERB =
    /\b(?:install|commission|mobilize|maintain|repair|replace|train|transport|deliver\s+(?:the\s+)?(?:goods|equipment|materials|works)|execute|implement|perform\s+(?:the\s+)?(?:services|works|contract)|submit\s+monthly|provide\s+training)\b/i;
  const CONTRACT_EXECUTION_CUE =
    /\b(?:after\s+(?:delivery|installation|commissioning|acceptance|handover|taking[- ]over)|upon\s+(?:delivery|installation|commissioning|acceptance)|following\s+(?:delivery|installation|commissioning)|during\s+(?:the\s+)?(?:warranty|defects?\s+liability)\s+period|under\s+(?:the\s+)?warranty|testing\s+and\s+commissioning|provide\s+training|conduct\s+training|replace\s+(?:defective|faulty)|repair\s+(?:defective|faulty)|delivery\s+(?:and\s+installation\s+)?reports?|progress\s+reports?|transport(?:ation)?\s+(?:of\s+)?(?:the\s+)?(?:goods|equipment|materials)|install(?:ation|ing)?\s+and\s+commission(?:ing)?|commission(?:ing)?\s+(?:the\s+)?(?:equipment|system|works|goods))\b/i;
  const SUBMIT_CUE =
    /\b(?:submit|submission|bid\s+closing|tender\s+closing|proposal\s+deadline|with\s+the\s+(?:bid|tender|proposal)|proposal\s+validity)\b/i;

  return {
    matchesExecutionVerb: EXECUTION_VERB.test(text),
    matchesContractExecutionCue: CONTRACT_EXECUTION_CUE.test(text),
    matchesSubmitCue: SUBMIT_CUE.test(text),
    matchesPreAwardFrame: PRE_AWARD_COMMITMENT_FRAME.test(text),
    executionVerbDetail: {
      install: /\binstall\b/i.test(text),
      installation: /\binstallation\b/i.test(text),
      repair: /\brepair\b/i.test(text),
      replace: /\breplace\b/i.test(text),
      transport: /\btransport\b/i.test(text),
      transportation: /\btransportation\b/i.test(text),
      submit: /\bsubmit\b/i.test(text),
      submitMonthly: /\bsubmit\s+monthly\b/i.test(text),
      deliveryReports: /\bdelivery\s+(?:and\s+installation\s+)?reports?\b/i.test(text),
      deliveryNotes: /\bdelivery\s+notes?\b/i.test(text),
    },
  };
}

function fullTrace(text: string) {
  const actorResolved = resolveSemanticActor(text);
  const actor = actorResolved.actor;
  const recipient = resolveRecipient({ text, actor });
  const sectionRole = inferSectionRole("Contractual", text);
  const documentRole = DOC_ROLE;
  const phase = classifyProcurementPhase({ text, actor, documentRole, sectionRole });
  const template = detectTemplateStatus(text);
  const boundaryComplete = isObligationBoundaryComplete(text);
  const purpose = classifyClausePurpose({
    text,
    documentRole,
    sectionRole,
    actor,
    recipient,
    phase,
    templateStatus: template.status,
    isMetadata: false,
    boundaryComplete,
  });
  const interpreted = interpretSemanticStatement({
    text,
    provenance: { sourceDocument: DOC, sourceSection: "Contractual" },
    context: {
      packageDocumentRole: "SCHEDULE_OF_REQUIREMENTS",
      sectionLabel: "Contractual",
    },
  });

  const { candidates, rejected } = buildCanonicalSemanticCandidates(
    [
      {
        description: text,
        sourceDocument: DOC,
        packageDocumentRole: "SCHEDULE_OF_REQUIREMENTS",
        sourceSection: "Contractual",
        mandatory: true,
      },
    ],
    { packageLabel: "jordan-pack" },
  );
  const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, "jordan-pack");
  const canonical = buildCanonicalRequirements({ stiApproved: sealed });
  const firewall = canonical.map((r) => ({
    hit: evaluateNormalizedAdmissionFirewall(r),
    stiPhase: r.stiProcurementPhase,
    stiActor: r.stiActor,
    stiPurpose: r.stiClausePurpose,
  }));

  return {
    text: text.slice(0, 220),
    cueProbe: probePhasePath(text),
    actor,
    recipient,
    documentRole,
    sectionRole,
    phaseFromClassifier: phase,
    purposeFromClassifier: purpose,
    interpret: {
      admit: interpreted.admitToCanonical,
      actor: interpreted.actor,
      phase: interpreted.procurementPhase,
      purpose: interpreted.clausePurpose,
      role: interpreted.clauseRole,
      kind: interpreted.semanticKind,
      strength: interpreted.obligationStrength,
      bidderRelevant: interpreted.bidderRelevant,
      excl: interpreted.exclusionCode,
      reason: interpreted.exclusionReason,
    },
    entryRejected: rejected.map((r) => ({
      excl: r.exclusionCode,
      phase: r.procurementPhase,
      purpose: r.clausePurpose,
    })),
    sealedSize: sealed.size,
    finalGateRejected: sealed.finalRejected.map((r) => ({
      excl: r.exclusionCode,
      phase: r.candidate.procurementPhase,
      failed: r.failedChecks,
    })),
    canonicalCount: canonical.length,
    firewall,
    firstWrongStage:
      phase === "BID_SUBMISSION" || interpreted.procurementPhase === "BID_SUBMISSION"
        ? "STI_LIFECYCLE_CLASSIFICATION (classifyProcurementPhase)"
        : interpreted.admitToCanonical === false && canonical.length > 0
          ? "POST_STI_RESURRECTION"
          : interpreted.admitToCanonical === true
            ? "STI_ADMISSION (lifecycle already wrong or purpose admits)"
            : "none_or_correctly_excluded",
  };
}

const results = CLAUSES.map((c) => ({
  id: c.id,
  label: c.label,
  traces: c.texts.map(fullTrace),
}));

// Prove divergence: same path for bidder vs supplier submit
const divergence = {
  bidderSubmitCert: fullTrace(
    "The Bidder shall submit a valid Commercial Registration Certificate with the proposal.",
  ),
  supplierSubmitDeliveryNotes: fullTrace(
    "The supplier shall submit delivery notes, installation completion reports, and warranty certificates.",
  ),
};

const analysis = {
  primaryFinding: {
    summary:
      "SUPPLIER actor is correct; lifecycle is wrongly BID_SUBMISSION inside classifyProcurementPhase before entry gate. Firewall never sees POST_AWARD so cannot exclude.",
    mechanism: [
      "1) Bare 'submit' cue (lines ~198-204 phase.ts) forces BID_SUBMISSION for ANY actor including SUPPLIER.",
      "2) EXECUTION_VERB lacks: submit (non-monthly), coordinate, store/storage, offload, placement, transportation (only transport), delivery notes (only delivery reports).",
      "3) SUPPLIER without matching EXECUTION_VERB defaults to BID_SUBMISSION (phase.ts ~229-231).",
      "4) Admission firewall only blocks POST_AWARD/CONTRACT_EXECUTION/DELIVERY_IMPLEMENTATION — not SUPPLIER+BID_SUBMISSION execution-shaped duties.",
    ],
  },
  results,
  divergence,
};

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/forensic-jordan-supplier-offline.json",
  JSON.stringify(analysis, null, 2),
);
console.log(JSON.stringify(analysis, null, 2));
