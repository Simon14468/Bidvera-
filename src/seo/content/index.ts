import { solutionPages } from "./solutions";
import {
  comparePages,
  guidePages,
  resourcePages,
  useCasePages,
} from "./resources-compare-guides";
import { glossaryHub } from "./glossary";
import type { SeoPageContent } from "./types";

/** Core marketing pages that already existed — registered for sitemap/hreflang. */
export const coreMarketingPages: SeoPageContent[] = [
  {
    path: "/",
    priority: 1,
    changeFrequency: "weekly",
    schemaType: "WebPage",
    locales: {
      en: {
        title: "Company Intelligence + Compliance + Evidence platform",
        description:
          "Bidvera is a Company Intelligence + Compliance + Evidence + Opportunity Intelligence platform for readiness, supplier qualification, questionnaires and explainable decisions.",
        h1: "Know What to Pursue. Know What You’re Ready For.",
        answer:
          "Bidvera is a Company Intelligence + Compliance + Evidence + Opportunity Intelligence platform. Tender analysis is one capability — not the whole product.",
        sections: [],
      },
      fr: {
        title: "Intelligence d’entreprise, conformité et preuves",
        description:
          "Bidvera est une plateforme d’intelligence d’entreprise, de conformité, de preuves et de préparation aux opportunités.",
        h1: "Savoir quoi poursuivre. Savoir pour quoi vous êtes prêts.",
        answer:
          "Bidvera combine intelligence d’entreprise, conformité, preuves et préparation aux opportunités. L’analyse d’appels d’offres n’est qu’une capacité.",
        sections: [],
      },
      es: {
        title: "Inteligencia empresarial, cumplimiento y evidencias",
        description:
          "Bidvera es una plataforma de inteligencia empresarial, cumplimiento, evidencias y preparación de oportunidades.",
        h1: "Saber qué perseguir. Saber para qué estás listo.",
        answer:
          "Bidvera combina inteligencia empresarial, cumplimiento, evidencias y preparación de oportunidades. El análisis de licitaciones es solo una capacidad.",
        sections: [],
      },
      ar: {
        title: "ذكاء الشركة والامتثال والأدلة",
        description:
          "بيدفراء منصة لذكاء الشركة والامتثال والأدلة وجاهزية الفرص للموردين والفرق.",
        h1: "اعرف ماذا تتابع. اعرف بماذا أنت جاهز.",
        answer:
          "بيدفراء منصة لذكاء الشركة والامتثال والأدلة وجاهزية الفرص. تحليل المناقصات قدرة واحدة وليس المنتج كله.",
        sections: [],
      },
      zh: {
        title: "企业情报 · 合规 · 证据平台",
        description:
          "Bidvera 是企业情报、合规、证据与商机就绪度平台，覆盖资质、问卷与可解释决策。",
        h1: "知道该追求什么。知道你已准备好什么。",
        answer:
          "Bidvera 是企业情报 + 合规 + 证据 + 商机就绪平台。招投标分析只是能力之一，不是全部产品。",
        sections: [],
      },
    },
  },
  {
    path: "/product",
    priority: 0.9,
    changeFrequency: "monthly",
    schemaType: "WebPage",
    locales: {
      en: {
        title: "Product — company intelligence capabilities",
        description:
          "Bidvera product: company profile, document compliance, supplier qualification, evidence, client requests, questionnaires, calendar, decisions and alerts.",
        h1: "Product",
        answer:
          "Bidvera product capabilities cover company intelligence, compliance, qualification, evidence, opportunity organization and explainable decisions.",
        sections: [],
      },
      fr: {
        title: "Produit — capacités d’intelligence d’entreprise",
        description:
          "Produit Bidvera : profil, conformité documentaire, qualification, preuves, demandes clients, questionnaires, calendrier, décisions et alertes.",
        h1: "Produit",
        answer:
          "Les capacités produit Bidvera couvrent l’intelligence d’entreprise, la conformité, la qualification, les preuves et les décisions explicables.",
        sections: [],
      },
      es: {
        title: "Producto — capacidades de inteligencia empresarial",
        description:
          "Producto Bidvera: perfil, cumplimiento documental, cualificación, evidencias, solicitudes, cuestionarios, calendario, decisiones y alertas.",
        h1: "Producto",
        answer:
          "Las capacidades de Bidvera cubren inteligencia empresarial, cumplimiento, cualificación, evidencias y decisiones explicables.",
        sections: [],
      },
      ar: {
        title: "المنتج — قدرات ذكاء الشركة",
        description:
          "منتج بيدفراء: الملف والامتثال والتأهيل والأدلة وطلبات العملاء والاستبيانات والتقويم والقرارات والتنبيهات.",
        h1: "المنتج",
        answer:
          "تغطي قدرات بيدفراء ذكاء الشركة والامتثال والتأهيل والأدلة وتنظيم الفرص والقرارات القابلة للتفسير.",
        sections: [],
      },
      zh: {
        title: "产品 — 企业情报能力",
        description:
          "Bidvera 产品：公司资料、文件合规、供应商资质、证据、客户请求、问卷、日历、决策与提醒。",
        h1: "产品",
        answer:
          "Bidvera 产品能力覆盖企业情报、合规、资质、证据、商机组织与可解释决策。",
        sections: [],
      },
    },
  },
  {
    path: "/pricing",
    priority: 0.85,
    changeFrequency: "weekly",
    schemaType: "WebPage",
    locales: {
      en: {
        title: "Pricing",
        description:
          "Bidvera pricing for Free Workspace and paid plans. Live prices come from published Bidvera plans.",
        h1: "Pricing",
        answer: "Bidvera publishes Free Workspace and paid plan pricing.",
        sections: [],
      },
    },
  },
  {
    path: "/faq",
    priority: 0.8,
    changeFrequency: "monthly",
    schemaType: "FAQPage",
    locales: {
      en: {
        title: "FAQ — company intelligence and readiness",
        description:
          "Frequently asked questions about Bidvera company intelligence, compliance, evidence, opportunities, questionnaires and security.",
        h1: "FAQ",
        answer:
          "Bidvera is a Company Intelligence + Compliance + Evidence + Opportunity Intelligence platform. Answers below cover how it helps teams stay ready.",
        sections: [],
        faqs: [
          {
            q: "What is Bidvera?",
            a: "Bidvera is a Company Intelligence + Compliance + Evidence + Opportunity Intelligence platform for readiness, supplier qualification, client requests, questionnaires and explainable decisions. Tender analysis is one capability.",
          },
          {
            q: "Is Bidvera only tender analysis software?",
            a: "No. Tender analysis is one capability inside a broader company intelligence workspace.",
          },
          {
            q: "Does Bidvera include automatic public tender discovery?",
            a: "Matching Engine / automated public tender discovery is not marketed as a generally available commercial feature. Opportunity readiness focuses on client requests, calendar and analysis workflows that are available.",
          },
        ],
      },
      fr: {
        title: "FAQ — intelligence d’entreprise et préparation",
        description:
          "Questions fréquentes sur Bidvera : intelligence d’entreprise, conformité, preuves, opportunités et sécurité.",
        h1: "FAQ",
        answer:
          "Bidvera est une plateforme d’intelligence d’entreprise, de conformité, de preuves et de préparation aux opportunités.",
        sections: [],
        faqs: [
          {
            q: "Qu’est-ce que Bidvera ?",
            a: "Bidvera est une plateforme d’intelligence d’entreprise + conformité + preuves + préparation aux opportunités. L’analyse d’appels d’offres n’est qu’une capacité.",
          },
          {
            q: "Bidvera n’est-il qu’un outil d’analyse d’AO ?",
            a: "Non. L’analyse d’AO est une capacité dans un espace plus large d’intelligence d’entreprise.",
          },
        ],
      },
      es: {
        title: "FAQ — inteligencia empresarial y preparación",
        description:
          "Preguntas frecuentes sobre Bidvera: inteligencia empresarial, cumplimiento, evidencias, oportunidades y seguridad.",
        h1: "FAQ",
        answer:
          "Bidvera es una plataforma de inteligencia empresarial, cumplimiento, evidencias y preparación de oportunidades.",
        sections: [],
        faqs: [
          {
            q: "¿Qué es Bidvera?",
            a: "Bidvera es una plataforma de inteligencia empresarial + cumplimiento + evidencias + preparación de oportunidades. El análisis de licitaciones es solo una capacidad.",
          },
        ],
      },
      ar: {
        title: "الأسئلة الشائعة — ذكاء الشركة والجاهزية",
        description:
          "أسئلة شائعة حول بيدفراء: ذكاء الشركة والامتثال والأدلة والفرص والأمان.",
        h1: "الأسئلة الشائعة",
        answer:
          "بيدفراء منصة لذكاء الشركة والامتثال والأدلة وجاهزية الفرص.",
        sections: [],
        faqs: [
          {
            q: "ما هي بيدفراء؟",
            a: "بيدفراء منصة لذكاء الشركة + الامتثال + الأدلة + جاهزية الفرص. تحليل المناقصات قدرة واحدة.",
          },
        ],
      },
      zh: {
        title: "常见问题 — 企业情报与就绪度",
        description:
          "关于 Bidvera 企业情报、合规、证据、商机与安全的常见问题。",
        h1: "常见问题",
        answer:
          "Bidvera 是企业情报 + 合规 + 证据 + 商机就绪平台。",
        sections: [],
        faqs: [
          {
            q: "Bidvera 是什么？",
            a: "Bidvera 是企业情报 + 合规 + 证据 + 商机就绪平台。招投标分析只是能力之一。",
          },
        ],
      },
    },
  },
];

export const allSeoPages: SeoPageContent[] = [
  ...coreMarketingPages,
  ...solutionPages,
  ...useCasePages,
  ...comparePages,
  ...resourcePages,
  ...guidePages,
  glossaryHub,
];

export function getSeoPageByPath(path: string): SeoPageContent | undefined {
  const normalized = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  return allSeoPages.find((p) => p.path === normalized);
}

export function listIndexablePaths(): string[] {
  return allSeoPages.map((p) => p.path);
}
