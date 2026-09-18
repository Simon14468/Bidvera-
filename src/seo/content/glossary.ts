import type { GlossaryTerm, SeoPageContent } from "./types";

export const glossaryHub: SeoPageContent = {
  path: "/glossary",
  priority: 0.7,
  changeFrequency: "monthly",
  schemaType: "CollectionPage",
  locales: {
    en: {
      title: "Glossary of company intelligence terms",
      description:
        "Definitions for company intelligence, supplier qualification, document compliance, evidence intelligence, bid/no-bid decisions and related procurement readiness terms.",
      h1: "Glossary",
      answer:
        "This glossary defines terms used across Bidvera’s public resources. Definitions are practical and product-aligned — not legal advice.",
      sections: [
        {
          heading: "How to use this glossary",
          body: [
            "Use these definitions when comparing categories or reading Bidvera guides. Product names refer to Bidvera capabilities that are commercially described elsewhere on this site.",
          ],
        },
      ],
      relatedPaths: ["/resources", "/solutions", "/faq"],
    },
    fr: {
      title: "Glossaire d’intelligence d’entreprise",
      description:
        "Définitions pour l’intelligence d’entreprise, la qualification fournisseur, la conformité documentaire et les décisions d’appel d’offres.",
      h1: "Glossaire",
      answer:
        "Ce glossaire définit des termes utilisés dans les ressources Bidvera. Ce ne sont pas des conseils juridiques.",
      sections: [
        {
          heading: "Utilisation",
          body: [
            "Servez-vous de ces définitions pour comparer des catégories ou lire les guides Bidvera.",
          ],
        },
      ],
      relatedPaths: ["/resources", "/solutions"],
    },
    es: {
      title: "Glosario de inteligencia empresarial",
      description:
        "Definiciones de inteligencia empresarial, cualificación de proveedores, cumplimiento documental y decisiones de oferta.",
      h1: "Glosario",
      answer:
        "Este glosario define términos usados en los recursos de Bidvera. No constituye asesoramiento legal.",
      sections: [
        {
          heading: "Uso",
          body: [
            "Úsalo al comparar categorías o leer las guías de Bidvera.",
          ],
        },
      ],
      relatedPaths: ["/resources", "/solutions"],
    },
  },
};

export const glossaryTerms: GlossaryTerm[] = [
  {
    slug: "company-intelligence",
    locales: {
      en: {
        term: "Company intelligence",
        definition:
          "Operational knowledge of what a company can prove and deliver — profile, compliance, qualifications, evidence and decisions — oriented to buyer readiness rather than only analytics dashboards.",
      },
      fr: {
        term: "Intelligence d’entreprise",
        definition:
          "Connaissance opérationnelle de ce qu’une entreprise peut prouver et livrer — profil, conformité, qualifications, preuves et décisions — orientée préparation acheteur.",
      },
      es: {
        term: "Inteligencia empresarial",
        definition:
          "Conocimiento operativo de lo que una empresa puede demostrar y entregar — perfil, cumplimiento, cualificaciones, evidencias y decisiones.",
      },
    },
  },
  {
    slug: "supplier-qualification",
    locales: {
      en: {
        term: "Supplier qualification",
        definition:
          "Maintaining a structured profile of capabilities, coverage, certifications and evidence so a company can be evaluated by buyers and stay ready for requests.",
      },
    },
  },
  {
    slug: "document-compliance",
    locales: {
      en: {
        term: "Document compliance",
        definition:
          "Keeping required company documents organized, current and expiry-aware so readiness does not depend on last-minute file hunts.",
      },
    },
  },
  {
    slug: "evidence-intelligence",
    locales: {
      en: {
        term: "Evidence intelligence",
        definition:
          "Connecting requirements and claims to supporting documents and facts, with clear verified versus needs-verification states.",
      },
    },
  },
  {
    slug: "bid-no-bid",
    locales: {
      en: {
        term: "Bid / no-bid decision",
        definition:
          "A deliberate choose-to-pursue judgment (often bid, review/conditional, or no-bid) based on fit, readiness, evidence, risk and capacity, with recorded rationale.",
      },
    },
  },
  {
    slug: "client-request",
    locales: {
      en: {
        term: "Client request",
        definition:
          "A buyer ask for documents, information or clarifications — often tracked as a dossier with completion status.",
      },
    },
  },
  {
    slug: "questionnaire-assistant",
    locales: {
      en: {
        term: "Questionnaire assistant",
        definition:
          "Software that structures questionnaire items and helps draft answers from available evidence while marking gaps for human verification.",
      },
    },
  },
  {
    slug: "company-readiness",
    locales: {
      en: {
        term: "Company readiness",
        definition:
          "The degree to which profile, documents, qualifications and evidence support pursuing a given opportunity or buyer requirement.",
      },
    },
  },
  {
    slug: "procurement-intelligence",
    locales: {
      en: {
        term: "Procurement intelligence",
        definition:
          "Insight used to evaluate suppliers or opportunities. Buyer-side tools emphasize sourcing; Bidvera emphasizes supplier-side readiness intelligence.",
      },
    },
  },
  {
    slug: "decision-intelligence",
    locales: {
      en: {
        term: "Decision intelligence",
        definition:
          "Systems that produce explainable recommendations and next actions from structured company and opportunity inputs — not opaque scores alone.",
      },
    },
  },
];
