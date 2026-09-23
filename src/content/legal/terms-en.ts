import { getLegalPendingCopy } from "./pending";
import type { LegalSection } from "./types";

const PENDING = getLegalPendingCopy("en");

/**
 * English Terms of Service body.
 * Localized counterparts live beside this file and are selected by locale.
 * Describes Bidvera’s SaaS offering based on implemented, publicly relevant capabilities.
 */
export const termsOfServiceSections: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introduction, agreement, and scope",
    paragraphs: [
      "These Terms of Service (“Terms”) govern access to and use of Bidvera’s websites and software-as-a-service platform (the “Service”).",
      "By creating an account, clicking to accept these Terms, or using the Service, you agree to these Terms and to our Privacy Policy. If you use Bidvera on behalf of a company, you represent that you have authority to bind that company.",
      "If you do not agree, do not use the Service.",
      "These Terms are a business contract summary for Bidvera users. They are not a substitute for advice from a qualified lawyer.",
    ],
  },
  {
    id: "definitions",
    title: "2. Definitions",
    paragraphs: [
      "In these Terms:",
    ],
    bullets: [
      PENDING.operatorIdentity,
      "“Platform” or “Service” means the Bidvera web application, related APIs, and associated websites.",
      "“User” means an individual who accesses the Service.",
      "“Customer” means the company or other organization that owns or administers a workspace and is responsible for its Users.",
      "“Company” or “workspace” means a tenant organization account in Bidvera.",
      "“Content” means data, text, files, and materials submitted to or generated in the Service.",
      "“Documents” means files you upload (for example tenders, certificates, questionnaires, or client-request materials).",
      "“Outputs” means analyses, drafts, scores, recommendations, reminders, or other results produced by Bidvera features, including AI-assisted features.",
      "“Subscription” means a paid or free/trial plan entitlement that controls access to modules and limits.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility and authority",
    paragraphs: [
      "You must be able to form a binding contract under applicable law and use Bidvera only for lawful business purposes. The Service is intended for organizational and professional use, not for children.",
      "If you invite teammates, you confirm you are authorized to do so for your organization.",
    ],
  },
  {
    id: "accounts",
    title: "4. Accounts, registration, and security",
    paragraphs: [
      "You must provide accurate account information and keep it updated. You are responsible for safeguarding credentials and for activity under your account.",
      "Notify us promptly of unauthorized access. Bidvera may require email verification, bot checks, rate limits, and other security controls.",
      "If you use Google sign-in, you must keep your Google account secure; Bidvera relies on Google’s authentication assertions for that method.",
    ],
  },
  {
    id: "workspaces",
    title: "5. Company workspaces, roles, and administrators",
    paragraphs: [
      "Bidvera organizes data by company workspace. Owners and administrators may manage settings, seats, billing (where permitted), and access for their workspace.",
      "Customer is responsible for configuring roles appropriately, for User compliance with these Terms, and for Content submitted by its Users.",
      "Super Admin or operator tooling used by Bidvera staff (if any) is separate from Customer workspace administration and is governed by Bidvera’s internal controls.",
    ],
  },
  {
    id: "services",
    title: "6. Description of the Service",
    paragraphs: [
      "Bidvera provides company-intelligence and procurement-readiness software. Depending on your Subscription and feature flags, modules may include (without limitation): company profile management; document compliance and expiry tracking; supplier qualification; evidence-related tools; client request management; questionnaire assistance; tender calendar and deadline reminders; decision memory; team decision workflow; smart alerts; billing and plan management; and an AI assistant for Bidvera-related questions.",
      "Some capabilities that exist in the codebase may be commercially unavailable, globally disabled, or limited to internal/admin testing. Bidvera does not promise that every technical module is sold or enabled for every Customer.",
      "Matching/opportunity and tender-analysis style capabilities, if present in your environment, are provided only when enabled for your account and must not be treated as a guarantee of opportunity quality or award outcomes.",
    ],
  },
  {
    id: "ai-limitations",
    title: "7. AI-generated content and limitations",
    paragraphs: [
      "Parts of the Service use artificial intelligence and automated processing. Outputs may be incomplete, inaccurate, outdated, biased, or unsuitable for your situation.",
      "You must independently verify tender requirements, eligibility, deadlines, calculations, legal and commercial conditions, and any procurement decision. Bidvera is not a law firm, procurement authority, auditor, or financial adviser, and does not replace professional advice.",
      "You remain solely responsible for bids, submissions, and business decisions made using the Service.",
    ],
  },
  {
    id: "no-guarantee",
    title: "8. No guarantee of outcomes",
    paragraphs: [
      "Bidvera does not guarantee that you will win tenders, qualify for opportunities, meet buyer requirements, achieve any commercial result, or that the Service will be error-free or uninterrupted.",
      "Availability, feature sets, and plan limits may change as we improve the product.",
    ],
  },
  {
    id: "user-content",
    title: "9. User content and uploaded documents",
    paragraphs: [
      "As between you and Bidvera, you (or your Customer) retain ownership of Documents and other Content you submit, to the extent you own them under applicable law.",
      "You grant Bidvera a limited, worldwide, non-exclusive license to host, process, transmit, display, and create derived Outputs from your Content solely as needed to operate, secure, maintain, support, and provide the Service (including through subprocessors such as hosting, email, payment, and AI providers).",
      "Bidvera does not claim ownership of your uploaded tender or business documents.",
      "You represent that you have all rights necessary to submit Content and that doing so does not violate law or third-party rights.",
    ],
  },
  {
    id: "prohibited",
    title: "10. User responsibilities and prohibited uses",
    paragraphs: [
      "You agree not to:",
    ],
    bullets: [
      "Use the Service unlawfully or for fraudulent procurement activity.",
      "Infringe intellectual property or privacy rights.",
      "Upload malware or attempt to disrupt or probe the Service.",
      "Bypass authentication, entitlements, rate limits, or security controls.",
      "Scrape, bulk-export, or reverse engineer the Service except as allowed by mandatory law.",
      "Share credentials or allow unauthorized access to a workspace.",
      "Misrepresent AI Outputs as verified legal or procurement advice.",
      "Submit Content you are not allowed to share (including confidential third-party materials without rights).",
    ],
  },
  {
    id: "ip",
    title: "11. Intellectual property",
    paragraphs: [
      "Bidvera and its licensors own the Service software, branding, UI, documentation, and related materials. These Terms do not transfer Bidvera IP to you.",
      "Your Content remains yours as described above. Third-party marks (for example Google or payment brands) belong to their owners.",
    ],
  },
  {
    id: "privacy",
    title: "12. Privacy and data processing",
    paragraphs: [
      "Personal data is handled as described in our Privacy Policy (linked from this page and the website footer). The Privacy Policy explains categories of data, purposes, cookies, and contact channels.",
      "If you require a separate data-processing agreement or subprocessor list for enterprise procurement, request it from Bidvera in writing.",
    ],
  },
  {
    id: "billing",
    title: "13. Subscriptions, trials, and billing",
    paragraphs: [
      "Bidvera offers plans that may include free workspace, trial, and paid subscriptions. Entitlements (modules, seats, analysis or usage limits) are controlled by your active plan and admin configuration.",
      "Paid checkout may be processed by third-party payment providers (such as PayPal and, if enabled, Stripe). Their terms also apply to payment processing.",
      "Prices, taxes, renewal intervals, grace periods, and promo terms are those shown at checkout or in your billing UI at the time of purchase, or as otherwise agreed in writing. This document does not invent fixed prices or tax rates.",
      "Failed payments may lead to past-due status, restricted access, or suspension according to the billing lifecycle implemented for your account.",
      "Upgrades, downgrades, and cancellations are handled through the billing interfaces or by contacting Bidvera support, subject to plan rules then in effect.",
    ],
  },
  {
    id: "refunds",
    title: "14. Refunds and cancellation",
    paragraphs: [
      PENDING.refundPolicy,
      "Cancelling a Subscription typically stops future renewals; it does not automatically delete your Content unless separately requested and processed.",
    ],
  },
  {
    id: "availability",
    title: "15. Availability, changes, suspension, and maintenance",
    paragraphs: [
      "We aim to keep the Service available but do not guarantee uninterrupted uptime. We may perform maintenance, deploy updates, or modify features.",
      "We may suspend or limit access to protect security, address abuse, enforce these Terms, comply with law, or manage unpaid accounts.",
    ],
  },
  {
    id: "termination",
    title: "16. Termination and effect",
    paragraphs: [
      "You may stop using the Service at any time. We may terminate or suspend access for material breach, unlawful use, or as otherwise permitted by these Terms.",
      "After termination, your right to access the Service ends. Retention or deletion of Content follows our Privacy Policy, backup practices, and legal obligations. We do not promise immediate irreversible deletion of all copies upon termination unless separately agreed and technically implemented.",
    ],
  },
  {
    id: "confidentiality",
    title: "17. Confidentiality",
    paragraphs: [
      "Each party may receive confidential business information from the other. Recipient will use reasonable care to protect such information and use it only for performing under these Terms, except for information that is public, independently developed, or required to be disclosed by law.",
      "Customer Documents are treated as Customer confidential information, subject to the processing license in Section 9 and the Privacy Policy.",
    ],
  },
  {
    id: "third-party",
    title: "18. Third-party services",
    paragraphs: [
      "The Service may integrate third parties for sign-in, payments, email, hosting, bot protection, and AI inference. Your use of those services may be subject to their terms. Bidvera is not responsible for third-party outages or policy changes outside our control.",
    ],
  },
  {
    id: "disclaimers",
    title: "19. Disclaimers",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE AND OUTPUTS ARE PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT, AND WITHOUT WARRANTY THAT OUTPUTS ARE CORRECT OR COMPLETE.",
      "Nothing in these Terms excludes liability that cannot be excluded under mandatory law.",
    ],
  },
  {
    id: "liability",
    title: "20. Limitation of liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BIDVERA AND ITS SUPPLIERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR LOST-PROFIT DAMAGES, OR FOR LOST BIDS, LOST BUSINESS, OR PROCUREMENT OUTCOMES.",
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BIDVERA’S AGGREGATE LIABILITY ARISING OUT OF THESE TERMS OR THE SERVICE IS LIMITED TO THE AMOUNTS PAID BY CUSTOMER TO BIDVERA FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR, IF NONE, ONE HUNDRED US DOLLARS OR LOCAL EQUIVALENT).",
      PENDING.liabilityLimitsNote,
    ],
  },
  {
    id: "indemnity",
    title: "21. Indemnification",
    paragraphs: [
      "To the extent permitted by law, Customer will defend and indemnify Bidvera against third-party claims arising from Customer Content, Customer’s misuse of the Service, or Customer’s violation of these Terms or applicable law, except to the extent caused by Bidvera’s willful misconduct.",
      PENDING.indemnityScopeNote,
    ],
  },
  {
    id: "governing-law",
    title: "22. Governing law and disputes",
    paragraphs: [
      PENDING.governingLaw,
      PENDING.governingLawProcess,
    ],
  },
  {
    id: "changes-terms",
    title: "23. Changes to these Terms",
    paragraphs: [
      "We may update these Terms from time to time. The Effective date / Last updated date on this page will change when a new version is published. Continued use after the effective date constitutes acceptance of the updated Terms, except where mandatory law requires a different process.",
    ],
  },
  {
    id: "general",
    title: "24. General",
    paragraphs: [
      "If a provision is unenforceable, the remainder stays in effect. Failure to enforce a provision is not a waiver. These Terms, together with the Privacy Policy and any order form or plan terms shown at checkout, are the entire agreement regarding the Service and supersede conflicting prior understandings on the same subject.",
      "You may not assign these Terms without our consent; we may assign them in connection with a corporate reorganization or sale of assets. Neither party is liable for delays caused by events beyond reasonable control (force majeure).",
    ],
  },
];
