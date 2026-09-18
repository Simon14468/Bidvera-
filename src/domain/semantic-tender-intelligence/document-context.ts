/**
 * Map package / UTI document roles into STI document roles.
 * Generic — no buyer-specific exceptions.
 */

import type { SemanticDocumentRole, SemanticSectionRole } from "./types";

export function mapPackageDocumentRole(
  role: string | null | undefined,
): SemanticDocumentRole {
  const r = (role ?? "").toUpperCase().replace(/\s+/g, "_");
  switch (r) {
    case "INVITATION":
    case "AVIS":
    case "NOTICE":
      return "NOTICE";
    case "TENDER_NOTICE":
      return "NOTICE";
    case "RFP":
    case "ADMINISTRATIVE":
    case "INSTRUCTIONS_TO_BIDDERS":
    case "INSTRUCTIONS_TO_TENDERERS":
    case "INSTRUCTIONS_TO_OFFERORS":
    case "INSTRUCTIONS":
      return "INSTRUCTIONS_TO_BIDDERS";
    case "TECHNICAL_SPECIFICATION":
      return "TECHNICAL_SPECIFICATION";
    case "CPS":
      return "TERMS_AND_CONDITIONS";
    case "STATEMENT_OF_WORK":
    case "SOW":
      return "STATEMENT_OF_WORK";
    case "SCHEDULE_OF_REQUIREMENTS":
      return "SCHEDULE_OF_REQUIREMENTS";
    case "FINANCIAL":
    case "FINANCIAL_FORMS":
    case "PRICING_SCHEDULE":
    case "PRICING":
      return "FINANCIAL_FORMS";
    case "FORM_OF_TENDER":
    case "DECLARATION":
    case "BIDDER_RESPONSE":
    case "RETURNABLE_BIDDING_FORMS":
    case "RETURNABLE_FORMS":
      return "RETURNABLE_BIDDING_FORMS";
    case "TERMS_AND_CONDITIONS":
      return "TERMS_AND_CONDITIONS";
    case "CONTRACT":
    case "CONTRACT_FORM":
    case "CONTRACT_FORMS":
      return "CONTRACT_FORM";
    case "SAMPLE_CONTRACT":
      return "SAMPLE_CONTRACT";
    case "ANNEX":
    case "APPENDIX":
      return "ANNEX";
    case "CLARIFICATION":
      return "CLARIFICATION";
    case "CORRIGENDUM":
      return "CORRIGENDUM";
    case "ADDENDUM":
    case "AMENDMENT":
      return "AMENDMENT";
    case "Q_AND_A":
      return "Q_AND_A";
    case "PREBID":
    case "PREBID_MATERIAL":
      return "PREBID_MATERIAL";
    case "QUALIFICATION":
      return "QUALIFICATION";
    case "VENDOR_GUIDE":
      return "VENDOR_GUIDE";
    case "PORTAL_GUIDE":
      return "PORTAL_GUIDE";
    case "POLICY_OR_CODE":
    case "POLICY_OR_CODE_OF_CONDUCT":
      return "POLICY_OR_CODE_OF_CONDUCT";
    case "OTHER":
      return "OTHER";
    default:
      return "UNKNOWN";
  }
}

export function inferSectionRole(
  sectionLabel: string | null | undefined,
  documentRole: SemanticDocumentRole,
): SemanticSectionRole {
  const s = (sectionLabel ?? "").toLowerCase();
  if (!s || /^\d+(?:\.\d+)*$/.test(s.trim())) {
    if (documentRole === "Q_AND_A" || documentRole === "CLARIFICATION") {
      return "CLARIFICATION_PROCEDURE";
    }
    if (documentRole === "SAMPLE_CONTRACT" || documentRole === "CONTRACT_FORM") {
      return "CONTRACT_CONDITIONS";
    }
    return "UNKNOWN";
  }
  if (/\beligib|qualification|ineligible\b/.test(s)) return "ELIGIBILITY";
  if (/\bevaluat|award\s+criter|scoring\b/.test(s)) return "EVALUATION";
  if (/\bsubmi|instruction|how\s+to\s+bid\b/.test(s)) return "SUBMISSION_INSTRUCTIONS";
  if (/\brequired\s+document|returnable|forms?\s+to\s+be\s+submitted\b/.test(s)) {
    return "REQUIRED_DOCUMENTS";
  }
  if (/\btechnical\s+spec|specification|scope\s+of\s+work\b/.test(s)) {
    return "TECHNICAL_REQUIREMENTS";
  }
  if (/\bpric|financial\s+capacity|turnover\b/.test(s)) return "PRICING";
  if (/\bdeliver|incoterm|lead\s+time\b/.test(s)) return "DELIVERY";
  if (/\bpayment\b/.test(s)) return "PAYMENT";
  if (/\bdefinition|glossary\b/.test(s)) return "DEFINITIONS";
  if (/\bprivileg|immunit|jurisdiction|governing\s+law\b/.test(s)) {
    return "LEGAL_RESERVATIONS";
  }
  if (/\bclarification|pre[- ]?bid\b/.test(s)) return "CLARIFICATION_PROCEDURE";
  if (/\bamend|corrigend|addendum\b/.test(s)) return "AMENDMENT";
  if (/\bannex|appendix|reference\b/.test(s)) return "ANNEX_REFERENCE";
  if (/\btemplate|insert|to\s+be\s+completed\b/.test(s)) return "TEMPLATE_FIELDS";
  if (/\bbackground|introduction|overview\b/.test(s)) return "INFORMATIONAL_BACKGROUND";
  if (/\bcontract\s+condition|general\s+conditions|special\s+conditions\b/.test(s)) {
    return "CONTRACT_CONDITIONS";
  }
  if (/\bperformance|sla|service\s+level\b/.test(s)) return "PERFORMANCE";
  return "UNKNOWN";
}
