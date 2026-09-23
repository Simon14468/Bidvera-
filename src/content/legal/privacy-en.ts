import { getLegalPendingCopy } from "./pending";
import type { LegalSection } from "./types";

const PENDING = getLegalPendingCopy("en");

/**
 * English Privacy Policy body.
 * Only describes processing consistent with Bidvera’s implemented product surface.
 */
export const privacyPolicySections: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introduction and scope",
    paragraphs: [
      "This Privacy Policy explains how Bidvera (“Bidvera”, “we”, “us”, or “our”) processes personal data when you visit getbidvera.com, create an account, or use the Bidvera software-as-a-service platform.",
      "Bidvera helps business teams manage company readiness, document compliance, supplier qualification, evidence, client requests, questionnaires, calendars, decision support, and related workspace features. Some modules appear only when enabled for your subscription or organization.",
      "This Policy applies to personal data processed through our websites, authenticated application, and related support channels. It does not cover third-party websites or services that we do not control.",
      "This document is informational and does not constitute legal advice. Final compliance for your organization should be reviewed with qualified counsel.",
    ],
  },
  {
    id: "controller",
    title: "2. Data controller",
    paragraphs: [
      PENDING.controllerIdentity,
      PENDING.registeredAddress,
      PENDING.privacyContact,
      PENDING.dataProtectionContact,
    ],
  },
  {
    id: "categories",
    title: "3. Categories of personal data we process",
    paragraphs: [
      "Depending on how you use Bidvera, we may process the following categories. We only collect what is needed to operate the service you request.",
    ],
    bullets: [
      "Account and identity data: name, email address, role in a company workspace, onboarding status, and profile information you provide (including optional avatar images).",
      "Authentication data: password credentials (stored as irreversible hashes when you use email/password), session identifiers, and device fingerprints used for security.",
      "Google sign-in data (when enabled): Google account subject identifier, verified email, and display name/picture claims returned by Google for authentication. We do not receive or store your Google password.",
      "Company / workspace data: company name, profile fields, country, size, and other business attributes you enter for readiness and collaboration features.",
      "Uploaded documents and work content: tender packages, compliance documents, qualification evidence, questionnaire materials, client-request files, and related metadata needed to provide the features you use.",
      "Billing-related data: subscription and plan metadata, payment-provider references, invoices/payment records maintained by Bidvera, and billing contact context. Card or PayPal credential details are handled by the payment provider when you check out; Bidvera is not designed to store full payment card numbers.",
      "Support and operational communications: messages and emails related to verification, password reset, alerts, and customer support.",
      "Technical and security data: IP address (often stored in hashed form for security/audit), user-agent, timestamps, rate-limit and abuse-prevention signals, and application logs.",
      "Cookies and similar technologies: session cookies, locale preference cookies, short-lived OAuth state cookies, and local browser storage for theme preference (see Cookies).",
    ],
  },
  {
    id: "sources",
    title: "4. Sources of data",
    paragraphs: [
      "We obtain personal data from: (a) you or your organization when you register, complete onboarding, upload content, or configure settings; (b) authentication providers such as Google when you choose Google sign-in; (c) payment providers for subscription status and payment events; (d) automated systems that generate logs and security signals when you use the platform; and (e) email and bot-protection providers involved in delivering mail or verifying human interactions where enabled.",
    ],
  },
  {
    id: "purposes",
    title: "5. Purposes of processing",
    paragraphs: [
      "We process personal data to:",
    ],
    bullets: [
      "Create and administer accounts, authenticate users, maintain sessions, and complete onboarding.",
      "Provide Bidvera product features you are entitled to use (for example document compliance, supplier qualification, tender calendar, client requests, questionnaire assistance, decision memory, team workflow, smart alerts, company profile, and related tools).",
      "Process uploaded documents and structured inputs to generate the analyses, checklists, drafts, reminders, or other outputs you request.",
      "Operate billing, trials, plan entitlements, and payment-provider integrations.",
      "Send transactional email (verification, password reset, alerts) and respond to support requests.",
      "Protect the service: prevent abuse, enforce rate limits, detect fraud or unauthorized access, and maintain audit trails.",
      "Improve reliability and user experience using operational metrics and feedback, without claiming unverified secondary uses.",
      "Comply with applicable legal obligations and respond to lawful requests.",
    ],
  },
  {
    id: "legal-bases",
    title: "6. Legal bases",
    paragraphs: [
      "Where data-protection laws require a legal basis, we typically rely on one or more of the following, depending on the activity and your location:",
    ],
    bullets: [
      "Performance of a contract — to provide the Bidvera service you or your organization request.",
      "Legitimate interests — for example securing the platform, preventing abuse, and improving service reliability, balanced against your rights.",
      "Consent — where required (for example certain optional processing or marketing, if offered and consented to).",
      "Legal obligations — where processing is necessary to meet applicable law.",
    ],
    // Note: we do not assert a single exclusive basis for every processing activity.
  },
  {
    id: "ai-documents",
    title: "7. AI processing and uploaded documents",
    paragraphs: [
      "Bidvera includes features that use artificial intelligence and automated processing to help you review documents, extract information, draft questionnaire answers, support decisions, or assist with related workflows.",
      "When you upload tender, procurement, compliance, or business documents, that content is processed to deliver the feature you requested (for example analysis, compliance tracking, questionnaire assistance, or collaboration). Outputs may be incomplete, inaccurate, or unsuitable for a specific procurement decision — you remain responsible for independent verification.",
      "We do not claim in this Policy that customer documents are never used for model training, never reviewed by humans, or automatically deleted after a fixed period, unless a separate written commitment or verified technical control applies to your account. Ask your Bidvera contact or counsel if you need contractual processing terms beyond this Policy.",
      "Service providers that power AI features may process prompts, documents, or derived text as needed to generate responses, subject to our agreements with those providers and applicable law.",
    ],
  },
  {
    id: "google-oauth",
    title: "8. Google sign-in",
    paragraphs: [
      "If Google sign-in is enabled for Bidvera and you choose it, we receive identity information from Google (such as a stable Google user ID, verified email, and name) solely to authenticate you and create or link your Bidvera account according to our account rules.",
      "Your use of Google is also governed by Google’s terms and privacy policy. Bidvera does not receive your Google password and does not expose Google client secrets to browsers.",
      "You can disconnect Google access through Google’s account settings for third-party apps; doing so may require you to use another sign-in method for Bidvera if one is available.",
    ],
  },
  {
    id: "sharing",
    title: "9. Sharing and service providers",
    paragraphs: [
      "We do not sell personal data. We share personal data only with categories of recipients needed to operate Bidvera, including:",
    ],
    bullets: [
      "Hosting and infrastructure providers (application hosting, databases, object/file storage).",
      "Email delivery providers for transactional messages.",
      "Authentication and bot-protection providers (for example Google OAuth and Cloudflare Turnstile when enabled).",
      "Payment processors for subscriptions and invoices (for example PayPal and, if enabled, Stripe).",
      "AI / model providers used to generate requested outputs.",
      "Professional advisers or authorities when required by law or to protect rights and safety.",
    ],
    // Providers named only where the codebase integrates them; exact subprocessors may change.
  },
  {
    id: "transfers",
    title: "10. International transfers and hosting",
    paragraphs: [
      PENDING.hostingRegions,
      PENDING.transferSafeguards,
    ],
  },
  {
    id: "retention",
    title: "11. Retention",
    paragraphs: [
      "We retain personal data for as long as needed to provide the service, maintain accounts and subscriptions, meet security and audit needs, resolve disputes, and comply with legal obligations.",
      "Exact retention periods depend on data category, account status, and legal requirements. Bidvera does not publish a single universal deletion schedule in this Policy. When you close an account or request deletion, we will handle the request according to applicable law and our then-current operational procedures — which may include retention of limited records where legally required.",
      "Backups and disaster-recovery copies may persist for a limited period after primary deletion.",
    ],
  },
  {
    id: "security",
    title: "12. Security",
    paragraphs: [
      "We apply administrative, technical, and organizational measures designed to protect personal data, including encrypted transport where configured, hashed credentials, access controls, session management, rate limiting, and audit logging.",
      "No method of transmission or storage is completely secure. We do not publish internal infrastructure diagrams, secret values, admin paths, or other security-sensitive implementation details in this Policy.",
    ],
  },
  {
    id: "rights",
    title: "13. Your rights",
    paragraphs: [
      "Depending on the laws that apply to you and to the relevant processing, you may have rights to:",
    ],
    bullets: [
      "Access personal data we hold about you.",
      "Request correction of inaccurate data.",
      "Request deletion, restriction, or objection, where applicable.",
      "Data portability, where applicable.",
      "Withdraw consent where processing is based on consent.",
      "Lodge a complaint with a competent supervisory authority.",
    ],
  },
  {
    id: "regional-privacy-laws",
    title: "14. Regional Privacy Laws and Your Rights",
    paragraphs: [
      "Bidvera is offered as a global service. Which privacy laws apply depends on your location and on the nature of the relevant processing. This Policy does not treat any particular country, regulator, or statute as governing every user or every processing activity.",
      "Where a privacy law applies to you or to a given processing activity, you may have additional rights, and we may have additional obligations, only to the extent that law requires.",
      "This Policy does not claim that Bidvera is certified, registered, authorized, or otherwise formally approved under any specific privacy regime.",
    ],
  },
  {
    id: "cookies",
    title: "15. Cookies and similar technologies",
    paragraphs: [
      "Bidvera uses essential cookies and similar technologies required for the service to function:",
    ],
    bullets: [
      "Authentication/session cookies (for example the Bidvera session cookie) to keep you signed in securely.",
      "Short-lived OAuth state cookies during Google sign-in to protect against CSRF and complete the login flow.",
      "Locale preference cookies so the interface can remember your language choice.",
      "Super Admin session cookies on administrative surfaces (not used for ordinary customer browsing).",
    ],
    // Theme preference uses localStorage, not a cookie.
  },
  {
    id: "cookies-other",
    title: "15.1 Other local storage and third-party challenges",
    paragraphs: [
      "Theme preference may be stored in your browser’s local storage (not a cookie).",
      "When bot protection is enabled, Cloudflare Turnstile may set or read technologies controlled by Cloudflare as part of verifying that a request is human.",
      "We do not claim that Bidvera currently operates a marketing analytics cookie suite or a cookie consent banner. If non-essential analytics or advertising cookies are introduced later, this Policy and any required consent UI will be updated.",
    ],
  },
  {
    id: "children",
    title: "16. Children’s privacy",
    paragraphs: [
      "Bidvera is a business service directed to organizations and professionals. It is not intended for children. We do not knowingly collect personal data from children. If you believe a child has provided personal data, contact us so we can take appropriate steps.",
    ],
  },
  {
    id: "third-parties",
    title: "17. Third-party links and services",
    paragraphs: [
      "The website or application may link to third-party sites or embed third-party services (for example video embeds or payment pages). Their privacy practices are governed by their own policies. Bidvera is not responsible for third-party content or practices we do not control.",
    ],
  },
  {
    id: "changes",
    title: "18. Changes to this Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. The Effective date / Last updated date at the top of the page will change when a new version is published. Material changes may also be communicated through the product or by email when appropriate.",
    ],
  },
];
