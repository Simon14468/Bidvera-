/**
 * Legal document metadata for Bidvera public pages.
 * Update EFFECTIVE_DATE when a new version is published.
 * Never invent company registration details — keep tokens here for internal tracking only.
 */

/** ISO date (YYYY-MM-DD) shown as Effective / Last updated on legal pages. */
export const LEGAL_DOCUMENTS_EFFECTIVE_DATE = "2026-09-23";

/**
 * Internal unresolved tokens. Do not interpolate these into public legal copy.
 * Customer-facing pending wording lives in `pending.ts`.
 */
export const LEGAL_PLACEHOLDERS = {
  legalEntityName: "[LEGAL_ENTITY_NAME]",
  registeredAddress: "[REGISTERED_ADDRESS]",
  privacyContactEmail: "[PRIVACY_CONTACT_EMAIL]",
  legalContactEmail: "[LEGAL_CONTACT_EMAIL]",
  governingLaw: "[GOVERNING_LAW_AND_VENUE — to be confirmed by counsel]",
  cndpReference: "[CNDP_NOTIFICATION_OR_AUTHORIZATION_REFERENCE — if/when applicable]",
  dataProtectionOfficer: "[DATA_PROTECTION_CONTACT — if designated]",
  refundPolicySummary: "[REFUND_AND_CANCELLATION_POLICY — business decision pending]",
  hostingRegions: "[HOSTING_AND_PROCESSING_REGIONS — confirm with infrastructure provider]",
} as const;

/** Raw tokens and internal drafting notes that must never appear in published legal bodies. */
export const UNPUBLISHED_LEGAL_TOKEN_RE =
  /\[LEGAL_ENTITY_NAME\]|\[REGISTERED_ADDRESS\]|\[PRIVACY_CONTACT_EMAIL\]|\[LEGAL_CONTACT_EMAIL\]|\[GOVERNING_LAW_AND_VENUE[^\]]*\]|\[CNDP_NOTIFICATION_OR_AUTHORIZATION_REFERENCE[^\]]*\]|\[DATA_PROTECTION_CONTACT[^\]]*\]|\[REFUND_AND_CANCELLATION_POLICY[^\]]*\]|\[HOSTING_AND_PROCESSING_REGIONS[^\]]*\]|to be confirmed by counsel|business decision pending|confirm with infrastructure provider|if\/when applicable|if designated/i;
