import type { SeoPageContent } from "./types";
import { mergeSolutionLocales } from "./solution-locales";

export const solutionsHub: SeoPageContent = {
  path: "/solutions",
  priority: 0.9,
  changeFrequency: "monthly",
  schemaType: "CollectionPage",
  locales: {
    en: {
      title: "Company intelligence solutions",
      description:
        "Explore Bidvera solutions for company readiness, document compliance, supplier qualification, evidence, client requests, questionnaires, and explainable bid decisions.",
      h1: "Solutions for company intelligence and readiness",
      answer:
        "Bidvera is a company intelligence workspace that helps teams manage readiness, compliance documents, supplier qualifications, evidence, buyer requests, questionnaires, and explainable bid decisions — without treating tender analysis as the whole product.",
      sections: [
        {
          heading: "What Bidvera solutions cover",
          body: [
            "Bidvera connects company profile data, compliance documents, qualifications, evidence, client requests, and decision workflows in one place.",
            "These solution pages explain capabilities that are available in Bidvera today. Features that are not commercially available are not marketed here.",
          ],
        },
        {
          heading: "Who these solutions are for",
          body: [
            "Suppliers and SMEs that respond to RFPs, questionnaires, and buyer document requests.",
            "Teams replacing spreadsheets for certificate expiry, evidence packs, and readiness tracking.",
            "Groups that need explainable bid / review / no-bid judgment with shared next actions.",
          ],
        },
      ],
      relatedPaths: [
        "/solutions/company-intelligence",
        "/solutions/document-compliance",
        "/solutions/supplier-qualification",
        "/solutions/evidence-intelligence",
        "/solutions/client-requests-questionnaires",
        "/solutions/decision-intelligence",
        "/solutions/opportunity-readiness",
        "/use-cases",
        "/compare",
      ],
    },
    fr: {
      title: "Solutions d’intelligence d’entreprise",
      description:
        "Découvrez les solutions Bidvera pour la préparation, la conformité documentaire, la qualification fournisseur, les preuves, les demandes clients et les décisions d’appel d’offres explicables.",
      h1: "Solutions d’intelligence et de préparation d’entreprise",
      answer:
        "Bidvera est un espace de travail d’intelligence d’entreprise qui aide les équipes à gérer la préparation, les documents de conformité, les qualifications, les preuves, les demandes acheteurs, les questionnaires et les décisions explicables.",
      sections: [
        {
          heading: "Ce que couvrent les solutions Bidvera",
          body: [
            "Bidvera relie le profil entreprise, les documents de conformité, les qualifications, les preuves, les demandes clients et les flux de décision.",
            "Ces pages décrivent des capacités disponibles aujourd’hui. Les fonctions non commercialisées ne sont pas présentées comme disponibles.",
          ],
        },
      ],
      relatedPaths: [
        "/solutions/company-intelligence",
        "/solutions/document-compliance",
        "/solutions/supplier-qualification",
        "/use-cases",
      ],
    },
    es: {
      title: "Soluciones de inteligencia empresarial",
      description:
        "Explora soluciones Bidvera para preparación, cumplimiento documental, cualificación de proveedores, evidencias, solicitudes de clientes y decisiones explicables.",
      h1: "Soluciones de inteligencia y preparación empresarial",
      answer:
        "Bidvera es un espacio de inteligencia empresarial para gestionar preparación, documentos de cumplimiento, cualificaciones, evidencias, solicitudes de compradores, cuestionarios y decisiones explicables.",
      sections: [
        {
          heading: "Qué cubren las soluciones",
          body: [
            "Bidvera conecta perfil, documentos, cualificaciones, evidencias, solicitudes y flujos de decisión.",
            "Estas páginas describen capacidades disponibles hoy. No presentamos como disponibles funciones que no se comercializan.",
          ],
        },
      ],
      relatedPaths: [
        "/solutions/company-intelligence",
        "/solutions/document-compliance",
        "/solutions/supplier-qualification",
        "/use-cases",
      ],
    },
    ar: {
      title: "حلول ذكاء الشركة",
      description:
        "استكشف حلول بيدفراء للجاهزية وامتثال المستندات وتأهيل الموردين والأدلة وطلبات العملاء والقرارات القابلة للتفسير.",
      h1: "حلول لذكاء الشركة والجاهزية",
      answer:
        "بيدفراء مساحة عمل لذكاء الشركة تساعد الفرق على إدارة الجاهزية ومستندات الامتثال والتأهيلات والأدلة وطلبات المشترين والاستبيانات والقرارات القابلة للتفسير.",
      sections: [
        {
          heading: "ماذا تغطي حلول بيدفراء",
          body: [
            "تربط بيدفراء ملف الشركة ومستندات الامتثال والتأهيلات والأدلة وطلبات العملاء وسير القرار.",
          ],
        },
      ],
      relatedPaths: ["/solutions/company-intelligence", "/solutions/document-compliance"],
    },
    zh: {
      title: "企业情报解决方案",
      description:
        "了解 Bidvera 在企业就绪度、文件合规、供应商资质、证据、客户请求与可解释投标决策方面的解决方案。",
      h1: "企业情报与就绪度解决方案",
      answer:
        "Bidvera 是企业情报工作区，帮助团队管理就绪度、合规文件、资质、证据、买方请求、问卷与可解释的投标决策。",
      sections: [
        {
          heading: "解决方案覆盖范围",
          body: [
            "Bidvera 将公司资料、合规文件、资质、证据、客户请求与决策流程连接在同一工作区。",
          ],
        },
      ],
      relatedPaths: ["/solutions/company-intelligence", "/solutions/document-compliance"],
    },
  },
};

const enCapability = (
  path: string,
  title: string,
  description: string,
  h1: string,
  answer: string,
  sections: SeoPageContent["locales"]["en"] extends infer T
    ? T extends { sections: infer S }
      ? S
      : never
    : never,
  faqs?: { q: string; a: string }[],
): SeoPageContent => ({
  path,
  priority: 0.85,
  changeFrequency: "monthly",
  schemaType: "WebPage",
  locales: {
    en: {
      title,
      description,
      h1,
      answer,
      sections,
      faqs,
      relatedPaths: [
        "/solutions",
        "/product",
        "/pricing",
        "/faq",
        "/resources",
        "/compare",
        "/guides/company-readiness-software",
      ],
    },
  },
});

const solutionPagesEn: SeoPageContent[] = [
  solutionsHub,
  enCapability(
    "/solutions/company-intelligence",
    "Company intelligence platform",
    "Bidvera company intelligence helps teams organize company profile, readiness, compliance, qualifications, evidence and explainable decisions in one workspace.",
    "What is a company intelligence platform?",
    "A company intelligence platform helps a business keep a living picture of what it can deliver — profile, documents, qualifications, evidence and decisions — instead of scattering that knowledge across folders and spreadsheets. Bidvera is built for that job.",
    [
      {
        heading: "Problems Bidvera addresses",
        body: [
          "Teams often cannot answer quickly whether they are ready for a requirement, which certificates are current, or what evidence supports a claim.",
          "Bidvera centralizes company profile, document compliance, supplier qualification and evidence so readiness is inspectable.",
        ],
      },
      {
        heading: "When Bidvera is a good fit",
        body: [
          "You need one workspace for readiness and evidence — not only a PDF summarizer.",
          "You respond to buyer questionnaires and document requests with shared accountability.",
          "You want explainable bid decisions grounded in company data you control.",
        ],
        bullets: [
          "Company profile management",
          "Document compliance tracking",
          "Supplier qualification",
          "Evidence and decision workflows",
        ],
      },
      {
        heading: "What Bidvera is not",
        body: [
          "Bidvera is not marketed here as a public tender scraping marketplace. Opportunity organization focuses on client requests, calendars and analysis workflows that are available in the product.",
        ],
      },
    ],
    [
      {
        q: "Is Bidvera only tender analysis software?",
        a: "No. Tender analysis is one capability. Bidvera is positioned as a broader company intelligence workspace spanning readiness, compliance, qualification, evidence, requests and decisions.",
      },
      {
        q: "Who is company intelligence for?",
        a: "Suppliers, SMEs and teams that must prove readiness to buyers and make defensible pursue / review / no-bid decisions.",
      },
    ],
  ),
  enCapability(
    "/solutions/document-compliance",
    "Document compliance and expiry tracking",
    "Track company compliance documents, monitor expiry dates and stay ready for buyer requirements with Bidvera Document Compliance.",
    "How can a company track compliance documents?",
    "Companies can track compliance documents by keeping licenses, certificates and statements in one secure workspace with expiry visibility and reminders — which is what Bidvera Document Compliance is designed to do.",
    [
      {
        heading: "Document compliance challenges",
        body: [
          "Critical documents live in email and shared drives. Expiry dates are missed. Teams discover gaps only when a buyer asks.",
        ],
      },
      {
        heading: "How Bidvera helps",
        body: [
          "Document Compliance keeps company documents organized, surfaces what is valid or expiring, and supports readiness for upcoming requirements.",
          "It pairs with supplier qualification and evidence workflows so compliance is part of company intelligence, not a separate spreadsheet.",
        ],
        bullets: [
          "Central document workspace",
          "Expiry awareness",
          "Readiness for buyer requirements",
          "Links into broader Bidvera evidence and decisions",
        ],
      },
      {
        heading: "Related searches Bidvera answers honestly",
        body: [
          "Business document expiry tracking, company compliance management, and alternatives to spreadsheets for supplier compliance documents.",
        ],
      },
    ],
    [
      {
        q: "How can suppliers manage expiring certificates?",
        a: "Store certificates in Bidvera Document Compliance, monitor expiry status, and use reminders so attention happens before a buyer request fails.",
      },
      {
        q: "Is Bidvera a full GRC suite?",
        a: "Bidvera focuses on company document readiness and related intelligence workflows. It is not claiming to replace every enterprise GRC platform.",
      },
    ],
  ),
  enCapability(
    "/solutions/supplier-qualification",
    "Supplier qualification software",
    "Manage supplier qualification profiles, capabilities and evidence with Bidvera — built for suppliers and SMEs that must stay ready for buyers.",
    "What software helps with supplier qualification?",
    "Supplier qualification software helps a company maintain structured capabilities, coverage, certifications and supporting evidence. Bidvera Supplier Qualification is built for that readiness picture inside a broader company intelligence workspace.",
    [
      {
        heading: "Why qualification stalls",
        body: [
          "Buyer portals ask for sectors, coverage, headcount, certifications and proof. Spreadsheets go stale and do not connect to evidence or decisions.",
        ],
      },
      {
        heading: "Bidvera approach",
        body: [
          "Supplier Qualification keeps a living profile of services, geography, certifications and related evidence.",
          "Procurement teams evaluating suppliers still need their own process; Bidvera helps the supplying company present and maintain a coherent readiness profile.",
        ],
      },
    ],
    [
      {
        q: "What is the best software for supplier qualification?",
        a: "The best fit depends on whether you are a buyer running a vendor master or a supplier maintaining readiness. Bidvera is designed for supplier-side qualification and company intelligence, not as a claim to be universally best for every buyer SRM suite.",
      },
    ],
  ),
  enCapability(
    "/solutions/evidence-intelligence",
    "Business evidence intelligence",
    "Organize and verify business evidence against requirements with Bidvera Evidence Intelligence — source-aware and decision-ready.",
    "How can companies organize business evidence?",
    "Companies organize business evidence by linking requirements to supporting documents and company facts in one workspace. Bidvera Evidence Intelligence connects what you claim to what you can show.",
    [
      {
        heading: "Evidence without structure fails audits and buyers",
        body: [
          "Files exist, but teams cannot show which requirement each file supports, or what still needs verification.",
        ],
      },
      {
        heading: "What Bidvera provides",
        body: [
          "Evidence workflows help teams understand what is verified, what needs attention and why — feeding explainable decisions and questionnaires.",
        ],
      },
    ],
  ),
  enCapability(
    "/solutions/client-requests-questionnaires",
    "Client requests and AI questionnaire assistant",
    "Manage buyer document requests and structure questionnaire responses with Bidvera Client Requests and Questionnaire Assistant.",
    "What software helps companies respond to client questionnaires?",
    "Software that structures questions, links answers to evidence and tracks completion helps teams respond faster with less guesswork. Bidvera provides Client Requests for dossiers and an AI Questionnaire Assistant for evidence-aware drafts that still require human verification when unsupported.",
    [
      {
        heading: "Buyer requests overwhelm teams",
        body: [
          "Document checklists and long questionnaires arrive by email. Progress is unclear. Answers are rewritten from scratch.",
        ],
      },
      {
        heading: "Bidvera capabilities",
        body: [
          "Client Requests centralize buyer information and document asks, with secure sharing options.",
          "Questionnaire Assistant structures questions with provenance and can draft evidence-backed answers, marking VERIFY when support is insufficient — it does not invent proof.",
        ],
      },
    ],
    [
      {
        q: "Does the AI invent answers?",
        a: "Drafts are evidence-aware. When support is missing, Bidvera is designed to surface verification needs rather than fabricate proof.",
      },
    ],
  ),
  enCapability(
    "/solutions/decision-intelligence",
    "Bid / no-bid decision support",
    "Use Bidvera decision intelligence for explainable BID / REVIEW / NO-BID outcomes, decision memory, team workflow and action plans.",
    "How does bid/no-bid decision support work in Bidvera?",
    "Bidvera’s Decision Engine produces explainable BID, REVIEW or NO-BID outcomes from readiness, qualification and evidence. Decision Memory, team workflow, alerts and action plans help the team execute — tender analysis is one input, not the entire product.",
    [
      {
        heading: "Decision intelligence, not a black box",
        body: [
          "Teams need rationale, blockers and next steps — not only a label.",
          "Bidvera keeps decisions explainable and connected to company evidence and workflow.",
        ],
      },
      {
        heading: "Related capabilities",
        body: [
          "Tender analysis, decision memory, team decision workflow, smart alerts and PDF reports support the decision loop.",
        ],
      },
    ],
  ),
  enCapability(
    "/solutions/opportunity-readiness",
    "Opportunity readiness and organization",
    "Organize client requests and tender deadlines with Bidvera so teams stay ready for relevant work — without claiming an automatic public tender discovery feed.",
    "How can a company stay ready for business opportunities?",
    "Companies stay ready by capturing inbound client requests, tracking key dates, keeping compliance and qualifications current, and evaluating requirements against real capability. Bidvera supports that readiness loop. It does not market an automatic public-tender discovery marketplace as a generally available feature.",
    [
      {
        heading: "Opportunity intelligence without false claims",
        body: [
          "Opportunity work in Bidvera centers on Client Requests, Tender Calendar reminders, analysis and decisions.",
          "Matching Engine / automated discovery feeds are not presented here as commercially available offerings.",
        ],
      },
      {
        heading: "SME procurement software angle",
        body: [
          "For SMEs, the hard part is readiness and response quality under time pressure. Bidvera focuses on that operational reality.",
        ],
      },
    ],
  ),
];

export const solutionPages: SeoPageContent[] = mergeSolutionLocales(solutionPagesEn);
