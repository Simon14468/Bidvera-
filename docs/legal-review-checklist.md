# Legal review checklist (internal)

**Not customer-facing.** Complete before treating Privacy Policy / Terms as final for a jurisdiction.

Public pages no longer show raw tokens. They use temporary pending wording from `src/content/legal/pending.ts` until the items below are confirmed and substituted.

## Unresolved items

| Token | Public location (pending copy) | Owner | Status |
|-------|-------------------------------|--------|--------|
| `[LEGAL_ENTITY_NAME]` | Privacy §2 controller identity; Terms §2 operator definition | Business / counsel | Unpublished — pending wording only |
| `[REGISTERED_ADDRESS]` | Privacy §2 registered address | Business / counsel | Unpublished — pending wording only |
| `[PRIVACY_CONTACT_EMAIL]` | Privacy §2 privacy contact | Business | Unpublished — pending wording only |
| `[LEGAL_CONTACT_EMAIL]` | Not on public pages (contact sections omitted) | Business | Held in `LEGAL_PLACEHOLDERS` only |
| `[DATA_PROTECTION_CONTACT — if designated]` | Privacy §2 data-protection contact | Counsel | Unpublished — pending wording only |
| `[HOSTING_AND_PROCESSING_REGIONS — confirm with infrastructure provider]` | Privacy §10 hosting / transfers | Ops + counsel | Unpublished — pending wording only |
| `[GOVERNING_LAW_AND_VENUE — to be confirmed by counsel]` | Terms §22 governing law | Counsel | Unpublished — pending wording only |
| `[REFUND_AND_CANCELLATION_POLICY — business decision pending]` | Terms §14 refunds | Business | Unpublished — pending wording only |

Source of tokens: `src/content/legal/meta.ts`.

## Confirm before asserting

- [ ] Registered legal entity name and office address
- [ ] Dedicated privacy and legal contact emails
- [ ] Whether a data-protection contact / DPO is designated
- [ ] Hosting and processing regions with the infrastructure provider
- [ ] Which regional privacy laws apply, and any required filings or transfer tools (do not claim a specific regime without documents)
- [ ] Exact retention schedules per data category
- [ ] Whether AI providers may use customer content for training (contractual truth)
- [ ] Refund / cooling-off rules for the sales model
- [ ] Governing law, venue, and enforceability of liability caps / indemnity
- [ ] Counsel review of localized Privacy / Terms bodies (en/es/zh/ar/fr). Current texts are product translations, not counsel-certified legal versions.

## Effective date

Update `LEGAL_DOCUMENTS_EFFECTIVE_DATE` in `src/content/legal/meta.ts` when publishing a counsel-approved revision.
