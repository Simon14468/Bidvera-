import type { SeoPageContent } from "./types";

function page(
  path: string,
  title: string,
  description: string,
  h1: string,
  answer: string,
  sections: NonNullable<SeoPageContent["locales"]["en"]>["sections"],
  faqs?: NonNullable<SeoPageContent["locales"]["en"]>["faqs"],
  relatedPaths?: string[],
): SeoPageContent {
  return {
    path,
    priority: path.split("/").length <= 2 ? 0.8 : 0.75,
    changeFrequency: "monthly",
    schemaType: faqs?.length ? "FAQPage" : "WebPage",
    locales: {
      en: {
        title,
        description,
        h1,
        answer,
        sections,
        faqs,
        relatedPaths: relatedPaths ?? ["/solutions", "/resources", "/compare", "/faq"],
      },
    },
  };
}

export const useCasePages: SeoPageContent[] = [
  page(
    "/use-cases",
    "Bidvera use cases",
    "See how Bidvera supports SME suppliers, compliance readiness and buyer-response workflows with company intelligence.",
    "Use cases for Bidvera",
    "Bidvera fits teams that must stay ready for buyers: maintain compliance and qualifications, organize evidence, answer questionnaires, and make explainable pursue decisions.",
    [
      {
        heading: "Choose a use case",
        body: [
          "Each use case page explains the problem, when Bidvera fits, and which capabilities apply — without inventing customer counts or awards.",
        ],
      },
    ],
    undefined,
    [
      "/use-cases/sme-suppliers",
      "/use-cases/compliance-readiness",
      "/use-cases/responding-to-buyers",
      "/solutions",
    ],
  ),
  page(
    "/use-cases/sme-suppliers",
    "SME supplier readiness software",
    "How SMEs use Bidvera to manage company readiness, compliance documents, qualifications and buyer responses without enterprise complexity.",
    "How can SMEs manage procurement opportunities and readiness?",
    "SMEs manage procurement readiness by keeping company profile, certificates, qualifications and evidence current, then responding to buyer requests with clear ownership. Bidvera is built as B2B SaaS for suppliers and SMEs that need that operational backbone.",
    [
      {
        heading: "SME reality",
        body: [
          "Small teams cannot staff a separate compliance department and a bid desk. Tools must stay practical.",
        ],
      },
      {
        heading: "How Bidvera helps SMEs",
        body: [
          "One workspace for profile, documents, qualification, evidence, client requests, questionnaires and decisions.",
          "Free Workspace and paid plans are published on the pricing page — check live pricing for current limits.",
        ],
      },
    ],
  ),
  page(
    "/use-cases/compliance-readiness",
    "Company compliance readiness",
    "Use Bidvera to keep compliance documents and qualifications ready before buyers ask — a practical alternative to spreadsheet tracking.",
    "Best alternative to spreadsheets for supplier compliance?",
    "A dedicated compliance workspace with expiry visibility and links to qualifications and evidence is usually stronger than spreadsheets for supplier compliance. Bidvera Document Compliance and Supplier Qualification are designed for that job inside company intelligence.",
    [
      {
        heading: "Spreadsheet failure modes",
        body: [
          "Dates drift, owners are unclear, and files are not connected to the requirements they support.",
        ],
      },
      {
        heading: "Readiness workflow",
        body: [
          "Keep documents current, maintain qualification profile, attach evidence, and use reminders so gaps appear before a bid deadline.",
        ],
      },
    ],
  ),
  page(
    "/use-cases/responding-to-buyers",
    "Responding to buyer requests and questionnaires",
    "Coordinate client document requests and questionnaire responses with Bidvera Client Requests and Questionnaire Assistant.",
    "How can companies respond to client questionnaires more efficiently?",
    "Structure the questionnaire, link answers to existing evidence, track completion, and verify unsupported drafts. Bidvera Client Requests and Questionnaire Assistant support that workflow.",
    [
      {
        heading: "Typical buyer pack",
        body: [
          "Document lists, policy questions, certification proofs and clarification rounds.",
        ],
      },
      {
        heading: "Bidvera workflow",
        body: [
          "Capture the request, reuse company evidence, draft with provenance, and keep humans accountable for verification.",
        ],
      },
    ],
  ),
];

export const comparePages: SeoPageContent[] = [
  page(
    "/compare",
    "Bidvera comparisons and alternatives",
    "Factual comparisons of Bidvera with spreadsheets, supplier management tools, procurement software and document management — where capabilities overlap.",
    "Compare Bidvera with common alternatives",
    "Bidvera overlaps with parts of supplier management, procurement readiness and document compliance tools, while focusing on company intelligence and explainable decisions. These pages explain fit honestly — Bidvera is not universally “better” for every buyer.",
    [
      {
        heading: "How to use these comparisons",
        body: [
          "Use them when your search intent is “[category] alternative” or “Bidvera vs …”.",
          "We do not fabricate competitor weaknesses or invent rankings.",
        ],
      },
    ],
    undefined,
    [
      "/compare/spreadsheets",
      "/compare/supplier-management-tools",
      "/compare/procurement-software",
      "/compare/document-management-systems",
      "/solutions",
    ],
  ),
  page(
    "/compare/spreadsheets",
    "Bidvera vs spreadsheets for compliance and readiness",
    "Compare Bidvera with spreadsheet-based supplier compliance and readiness tracking — feature by feature, without hype.",
    "Bidvera vs traditional spreadsheets",
    "Spreadsheets are flexible and familiar. Bidvera is stronger when you need shared expiry tracking, evidence links, questionnaires and explainable decisions in one workspace. Spreadsheets may still win for one-off lists with a single owner.",
    [
      {
        heading: "Feature comparison",
        body: ["Honest overlap and differences:"],
        bullets: [
          "Expiry tracking: Bidvera provides dedicated document status; spreadsheets need manual discipline",
          "Evidence linkage: Bidvera connects evidence to requirements; spreadsheets usually do not",
          "Questionnaires: Bidvera structures requests; spreadsheets are free-form",
          "Collaboration: Bidvera has workflow and alerts; spreadsheets rely on file sharing",
          "Flexibility: spreadsheets are easier for ad-hoc columns Bidvera does not model",
          "Cost: spreadsheets may be cheaper for tiny teams with simple needs",
        ],
      },
      {
        heading: "When to stay on spreadsheets",
        body: [
          "If you track a handful of dates for one person and never reuse evidence across bids, a spreadsheet can be enough.",
        ],
      },
      {
        heading: "When Bidvera fits better",
        body: [
          "When multiple people share ownership, buyers ask for dossiers, and decisions must be explainable from company evidence.",
        ],
      },
    ],
  ),
  page(
    "/compare/supplier-management-tools",
    "Bidvera vs supplier management tools",
    "Where Bidvera overlaps with supplier management software — and where buyer-side SRM platforms differ.",
    "Bidvera vs supplier management tools",
    "Many supplier management tools focus on the buyer’s vendor master, risk scoring and onboarding. Bidvera focuses on the supplying company’s readiness: profile, compliance, evidence, requests and bid decisions. Overlap exists on qualification and documents; goals differ.",
    [
      {
        heading: "Overlapping functionality",
        body: [
          "Qualification profiles, compliance documents, certifications and evidence packs.",
        ],
      },
      {
        heading: "Where categories diverge",
        body: [
          "Buyer SRM suites often include vendor portals, scorecards across many suppliers, and procurement workflows Bidvera does not claim to replace.",
          "Bidvera adds explainable bid decision support and questionnaire assistance oriented to the responding company.",
        ],
      },
      {
        heading: "Choosing honestly",
        body: [
          "If you are a buyer running hundreds of vendors, evaluate SRM platforms for that job. If you are a supplier needing company intelligence and readiness, Bidvera is the more direct category fit.",
        ],
      },
    ],
  ),
  page(
    "/compare/procurement-software",
    "Bidvera vs procurement software",
    "Compare Bidvera with procurement and SME procurement software categories — factual overlap only.",
    "Bidvera and procurement software categories",
    "Procurement software often covers purchase-to-pay, sourcing events and supplier discovery for buyers. Bidvera is company intelligence for readiness and response. Some opportunity and qualification themes overlap; Bidvera does not position itself as a full procure-to-pay suite.",
    [
      {
        heading: "Overlap",
        body: [
          "Supplier qualification data, compliance readiness, and evaluating whether to pursue work.",
        ],
      },
      {
        heading: "Non-overlap",
        body: [
          "PO workflows, inventory, e-invoicing and multi-supplier auction rooms are outside Bidvera’s marketed scope.",
          "Automated public tender marketplace matching is not claimed as a generally available Bidvera feature.",
        ],
      },
    ],
  ),
  page(
    "/compare/document-management-systems",
    "Bidvera vs document management systems",
    "How Bidvera Document Compliance differs from general document management systems (DMS).",
    "Bidvera vs document management systems",
    "A DMS stores and versions files at scale. Bidvera Document Compliance focuses on company readiness documents, expiry awareness and links into qualification, evidence and decisions. A large DMS may still be better for enterprise content platforms.",
    [
      {
        heading: "Choose a DMS when",
        body: [
          "You need broad ECM, complex retention policies across many departments, or deep records management.",
        ],
      },
      {
        heading: "Choose Bidvera when",
        body: [
          "Your pain is buyer-facing readiness: which certificates matter, what expires, what evidence supports a bid, and what to do next.",
        ],
      },
    ],
  ),
];

export const resourcePages: SeoPageContent[] = [
  page(
    "/resources",
    "Resources on company intelligence and readiness",
    "Guides and definitions for company intelligence, supplier qualification, document compliance, evidence and bid decisions.",
    "Educational resources",
    "These resources explain concepts and workflows around company intelligence, compliance, qualification, evidence and bid decisions. They are written to be citable and factual — not keyword stuffing.",
    [
      {
        heading: "Start here",
        body: [
          "Read the guides and glossary to understand how Bidvera thinks about readiness problems, then explore Solutions for product fit.",
        ],
      },
    ],
    undefined,
    [
      "/resources/what-is-company-intelligence",
      "/resources/supplier-qualification-guide",
      "/resources/document-compliance-guide",
      "/resources/bid-no-bid-decision-guide",
      "/glossary",
      "/guides/track-compliance-documents",
    ],
  ),
  page(
    "/resources/what-is-company-intelligence",
    "What is company intelligence?",
    "Definition of company intelligence for suppliers and SMEs — and how it differs from generic BI dashboards.",
    "Company intelligence: a practical definition",
    "Company intelligence is the operational knowledge of what a company can prove and deliver: profile, compliance, qualifications, evidence and decisions. It is related to business intelligence but focused on readiness for buyers rather than only analytics charts.",
    [
      {
        heading: "Definition",
        body: [
          "Company intelligence systems help teams answer: What are we ready for? What evidence do we have? What should we pursue?",
        ],
      },
      {
        heading: "How Bidvera applies it",
        body: [
          "Bidvera implements company intelligence as a workspace spanning profile, Document Compliance, Supplier Qualification, Evidence Intelligence, Client Requests, questionnaires and explainable decisions.",
        ],
      },
    ],
  ),
  page(
    "/resources/supplier-qualification-guide",
    "Supplier qualification guide",
    "A practical guide to supplier qualification for companies that sell to other businesses.",
    "Supplier qualification for ready suppliers",
    "Supplier qualification means maintaining a clear, evidence-backed profile of capabilities, coverage and certifications so buyers can evaluate you — and so your team knows what is current.",
    [
      {
        heading: "Core elements",
        body: [],
        bullets: [
          "Services and sectors",
          "Geographic coverage",
          "Certifications and licenses",
          "Evidence that supports claims",
          "Owners accountable for updates",
        ],
      },
      {
        heading: "Common mistakes",
        body: [
          "Treating qualification as a one-time form fill. Profiles go stale without document expiry and evidence links.",
        ],
      },
    ],
  ),
  page(
    "/resources/document-compliance-guide",
    "Document compliance guide",
    "How to run document compliance for company readiness — expiry tracking, ownership and buyer requests.",
    "Document compliance for business readiness",
    "Document compliance for suppliers means knowing which company documents exist, whether they are valid, when they expire and who owns renewal — before a questionnaire deadline.",
    [
      {
        heading: "Minimum viable process",
        body: [],
        bullets: [
          "Inventory critical documents",
          "Record expiry and owners",
          "Store files where the team can find them",
          "Review before major bids",
          "Connect documents to qualification and evidence",
        ],
      },
    ],
  ),
  page(
    "/resources/bid-no-bid-decision-guide",
    "Bid / no-bid decision guide",
    "How teams make explainable bid, review or no-bid decisions using readiness and evidence.",
    "Explainable bid / no-bid decisions",
    "A strong bid / no-bid process weighs readiness, qualification fit, evidence gaps, risk and capacity — then records rationale and next actions. Bidvera’s Decision Engine supports explainable BID / REVIEW / NO-BID outcomes from those inputs.",
    [
      {
        heading: "Inputs that matter",
        body: [
          "Requirements fit, compliance readiness, evidence strength, deadlines and team capacity.",
        ],
      },
      {
        heading: "Outputs teams need",
        body: [
          "A clear recommendation, reasons, blockers and an action plan — not only a score.",
        ],
      },
    ],
  ),
];

export const guidePages: SeoPageContent[] = [
  page(
    "/guides/track-compliance-documents",
    "How to track compliance documents",
    "Step-by-step guidance for tracking company compliance documents and expiries — with Bidvera as a fit when you need a dedicated workspace.",
    "How can a company track compliance documents?",
    "List critical documents, capture expiry dates, assign owners, store files centrally and review before buyer deadlines. Bidvera Document Compliance provides that structure when spreadsheets stop scaling.",
    [
      {
        heading: "Steps",
        body: [],
        bullets: [
          "Identify licenses, certificates and statements buyers usually ask for",
          "Record validity windows and responsible owners",
          "Store the current file version in one place",
          "Set reminder points before expiry",
          "Link documents to qualification and evidence where relevant",
        ],
      },
      {
        heading: "When Bidvera fits",
        body: [
          "When multiple people share ownership and documents feed questionnaires and bid decisions.",
        ],
      },
    ],
    [
      {
        q: "Do I need Bidvera to track documents?",
        a: "No. A disciplined spreadsheet can work for tiny inventories. Bidvera becomes useful when you need shared status, reminders and links into readiness workflows.",
      },
    ],
    [
      "/solutions/document-compliance",
      "/guides/manage-expiring-certificates",
      "/compare/spreadsheets",
      "/resources/document-compliance-guide",
    ],
  ),
  page(
    "/guides/manage-expiring-certificates",
    "How suppliers manage expiring certificates",
    "Practical approach for suppliers to manage expiring certificates and stay ready for buyer checks.",
    "How can suppliers manage expiring certificates?",
    "Keep certificates in a controlled inventory, monitor expiry status, renew early and attach the latest file to qualification/evidence records. Bidvera supports this with Document Compliance and related readiness features.",
    [
      {
        heading: "Operational checklist",
        body: [],
        bullets: [
          "Separate expired, expiring and valid states",
          "Do not overwrite history without keeping the current valid file obvious",
          "Notify owners before expiry — not after a buyer rejection",
        ],
      },
    ],
    [
      {
        q: "What software helps manage expiring certificates?",
        a: "Document compliance tools with expiry visibility and reminders help. Bidvera Document Compliance is built for supplier-side certificate readiness inside company intelligence.",
      },
    ],
    [
      "/solutions/document-compliance",
      "/guides/track-compliance-documents",
      "/compare/spreadsheets",
    ],
  ),
  page(
    "/guides/organize-business-evidence",
    "How to organize business evidence",
    "Organize business evidence so requirements map to proof — for audits, buyers and bid decisions.",
    "How can companies organize business evidence?",
    "Map each important claim or requirement to supporting files and company facts, mark what is verified versus needs review, and reuse that map across questionnaires and decisions. Bidvera Evidence Intelligence is built around that model.",
    [
      {
        heading: "Evidence principles",
        body: [
          "Evidence should be source-aware. Unknown remains unknown. Do not treat marketing copy as proof.",
        ],
      },
    ],
    undefined,
    [
      "/solutions/evidence-intelligence",
      "/solutions/client-requests-questionnaires",
      "/guides/respond-to-client-questionnaires",
    ],
  ),
  page(
    "/guides/respond-to-client-questionnaires",
    "How to respond to client questionnaires",
    "A workflow for client and supplier questionnaires: structure, evidence, verification and delivery.",
    "How can companies respond to client questionnaires?",
    "Break the questionnaire into questions, assign owners, draft from existing evidence, flag gaps for verification, then submit a coherent pack. Bidvera Questionnaire Assistant and Client Requests support this loop.",
    [
      {
        heading: "Quality bar",
        body: [
          "Fast drafts help only when unsupported answers are marked for human verification.",
        ],
      },
    ],
    undefined,
    [
      "/solutions/client-requests-questionnaires",
      "/solutions/evidence-intelligence",
      "/use-cases/responding-to-buyers",
    ],
  ),
  page(
    "/guides/company-readiness-software",
    "Company readiness software guide",
    "What to look for in company readiness software — and how Bidvera maps to those criteria.",
    "What is the best software for company readiness?",
    "“Best” depends on company size and whether you need buyer-side procurement, supplier readiness, or both. For supplier-side readiness spanning documents, qualification, evidence and decisions, Bidvera is a legitimate category fit. It is not a universal ranking claim.",
    [
      {
        heading: "Evaluation criteria",
        body: [],
        bullets: [
          "Document expiry and ownership",
          "Qualification profile depth",
          "Evidence linkage",
          "Questionnaire / request handling",
          "Explainable decisions and team workflow",
          "Clear pricing and data isolation",
        ],
      },
      {
        heading: "Tools that combine compliance, evidence and opportunity organization",
        body: [
          "Few tools combine all three without sprawl. Bidvera’s design goal is that combination for the responding company, with opportunity organization via requests and calendars rather than a claimed public discovery marketplace.",
        ],
      },
    ],
    [
      {
        q: "Is Bidvera the best company intelligence platform?",
        a: "“Best” is buyer-specific. Bidvera is a strong fit when you need supplier-side company intelligence spanning compliance, qualification, evidence and explainable decisions — without claiming to outrank every category tool.",
      },
    ],
    [
      "/solutions/company-intelligence",
      "/compare",
      "/solutions",
      "/pricing",
    ],
  ),
];
