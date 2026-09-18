import type { Locale } from "@/i18n/config";
import type { SeoPageContent } from "./types";

type LocaleBody = NonNullable<SeoPageContent["locales"][Locale]>;

/** Native FR/ES/AR/ZH overlays for solution landing pages (not mechanical EN translation). */
export const solutionLocaleOverlays: Record<
  string,
  Partial<Record<Exclude<Locale, "en">, LocaleBody>>
> = {
  "/solutions/company-intelligence": {
    fr: {
      title: "Plateforme d’intelligence d’entreprise",
      description:
        "Bidvera centralise le profil, la conformité, les qualifications, les preuves et les décisions explicables dans un espace d’intelligence d’entreprise.",
      h1: "Qu’est-ce qu’une plateforme d’intelligence d’entreprise ?",
      answer:
        "Une plateforme d’intelligence d’entreprise maintient une vision vivante de ce qu’une société peut prouver et livrer — profil, documents, qualifications, preuves et décisions. Bidvera est conçu pour ce rôle, pas seulement pour résumer des appels d’offres.",
      sections: [
        {
          heading: "Problèmes traités",
          body: [
            "Les équipes peinent à savoir si elles sont prêtes, quels certificats sont valides, et quelles preuves soutiennent une affirmation.",
            "Bidvera centralise le profil, la conformité documentaire, la qualification et les preuves pour rendre la préparation inspectable.",
          ],
        },
        {
          heading: "Quand Bidvera convient",
          body: [
            "Vous avez besoin d’un espace de préparation et de preuves — pas seulement d’un outil PDF.",
            "Vous répondez à des questionnaires et demandes documentaires avec une responsabilité partagée.",
          ],
        },
      ],
      faqs: [
        {
          q: "Bidvera n’est-il qu’un logiciel d’analyse d’appels d’offres ?",
          a: "Non. L’analyse d’appels d’offres est une capacité. Bidvera se positionne comme un espace d’intelligence d’entreprise plus large.",
        },
      ],
      relatedPaths: [
        "/solutions/document-compliance",
        "/solutions/supplier-qualification",
        "/resources/what-is-company-intelligence",
        "/solutions",
      ],
    },
    es: {
      title: "Plataforma de inteligencia empresarial",
      description:
        "Bidvera organiza perfil, cumplimiento, cualificaciones, evidencias y decisiones explicables en un espacio de inteligencia empresarial.",
      h1: "¿Qué es una plataforma de inteligencia empresarial?",
      answer:
        "Una plataforma de inteligencia empresarial mantiene una visión viva de lo que la empresa puede demostrar y entregar: perfil, documentos, cualificaciones, evidencias y decisiones. Bidvera está pensado para eso — no solo para resumir licitaciones.",
      sections: [
        {
          heading: "Problemas que aborda",
          body: [
            "Los equipos no saben con rapidez si están listos, qué certificados siguen vigentes o qué evidencia respalda una afirmación.",
          ],
        },
      ],
      faqs: [
        {
          q: "¿Bidvera es solo software de análisis de licitaciones?",
          a: "No. El análisis de licitaciones es una capacidad. Bidvera se posiciona como inteligencia empresarial más amplia.",
        },
      ],
      relatedPaths: [
        "/solutions/document-compliance",
        "/solutions/supplier-qualification",
        "/solutions",
      ],
    },
    ar: {
      title: "منصة ذكاء الشركة",
      description:
        "تجمع بيدفراء ملف الشركة والامتثال والتأهيل والأدلة والقرارات القابلة للتفسير في مساحة عمل لذكاء الشركة.",
      h1: "ما هي منصة ذكاء الشركة؟",
      answer:
        "منصة ذكاء الشركة تحافظ على صورة حية لما تستطيع الشركة إثباته وتقديمه: الملف والمستندات والتأهيلات والأدلة والقرارات. بيدفراء مبنية لهذا الدور، وليس فقط لتلخيص المناقصات.",
      sections: [
        {
          heading: "المشكلات التي تعالجها",
          body: [
            "غالباً لا تستطيع الفرق الإجابة بسرعة عن الجاهزية أو صلاحية الشهادات أو الأدلة الداعمة للمطالبات.",
          ],
        },
      ],
      faqs: [
        {
          q: "هل بيدفراء مجرد برنامج لتحليل المناقصات؟",
          a: "لا. تحليل المناقصات قدرة واحدة. بيدفراء مساحة أوسع لذكاء الشركة والجاهزية.",
        },
      ],
      relatedPaths: ["/solutions/document-compliance", "/solutions"],
    },
    zh: {
      title: "企业情报平台",
      description:
        "Bidvera 将公司资料、合规、资质、证据与可解释决策集中在同一企业情报工作区。",
      h1: "什么是企业情报平台？",
      answer:
        "企业情报平台帮助企业持续掌握可证明、可交付的能力图景：资料、文件、资质、证据与决策。Bidvera 为此而建，而不仅仅是标书摘要工具。",
      sections: [
        {
          heading: "要解决的问题",
          body: [
            "团队往往无法快速回答是否就绪、证书是否有效，以及哪些证据支撑某项主张。",
          ],
        },
      ],
      faqs: [
        {
          q: "Bidvera 是否只是招投标分析软件？",
          a: "不是。招投标分析只是能力之一。Bidvera 定位为更广泛的企业情报与就绪度工作区。",
        },
      ],
      relatedPaths: ["/solutions/document-compliance", "/solutions"],
    },
  },

  "/solutions/document-compliance": {
    fr: {
      title: "Conformité documentaire et suivi d’expiration",
      description:
        "Suivez les documents de conformité, les dates d’expiration et restez prêt pour les exigences acheteurs avec Bidvera.",
      h1: "Comment suivre les documents de conformité d’une entreprise ?",
      answer:
        "En centralisant licences, certificats et attestations dans un espace sécurisé avec visibilité des échéances et rappels — c’est le rôle de Bidvera Document Compliance.",
      sections: [
        {
          heading: "Défis de conformité documentaire",
          body: [
            "Les documents critiques sont dispersés dans les e-mails et lecteurs partagés. Les expirations sont manquées jusqu’à la demande acheteur.",
          ],
        },
        {
          heading: "Comment Bidvera aide",
          body: [
            "Document Compliance organise les documents, signale ce qui est valide ou bientôt expiré, et alimente la préparation aux exigences.",
          ],
        },
      ],
      faqs: [
        {
          q: "Comment gérer les certificats qui expirent ?",
          a: "Stockez-les dans Bidvera Document Compliance, surveillez le statut d’expiration et utilisez les rappels avant qu’une demande acheteur n’échoue.",
        },
      ],
      relatedPaths: [
        "/guides/track-compliance-documents",
        "/guides/manage-expiring-certificates",
        "/compare/spreadsheets",
        "/solutions",
      ],
    },
    es: {
      title: "Cumplimiento documental y caducidad",
      description:
        "Controla documentos de cumplimiento, fechas de caducidad y preparación ante requisitos del comprador con Bidvera.",
      h1: "¿Cómo puede una empresa controlar documentos de cumplimiento?",
      answer:
        "Centralizando licencias, certificados y declaraciones en un espacio seguro con visibilidad de caducidad y recordatorios — el enfoque de Bidvera Document Compliance.",
      sections: [
        {
          heading: "Retos habituales",
          body: [
            "Los documentos viven en el correo y unidades compartidas. Las caducidades se detectan tarde.",
          ],
        },
      ],
      faqs: [
        {
          q: "¿Cómo gestionar certificados que caducan?",
          a: "Guárdelos en Bidvera Document Compliance, supervise el estado de caducidad y use recordatorios antes de que falle una solicitud del comprador.",
        },
      ],
      relatedPaths: [
        "/guides/track-compliance-documents",
        "/compare/spreadsheets",
        "/solutions",
      ],
    },
    ar: {
      title: "امتثال المستندات وتتبع الانتهاء",
      description:
        "تتبع مستندات الامتثال وتواريخ انتهائها والبقاء جاهزاً لمتطلبات المشتري مع بيدفراء.",
      h1: "كيف تتابع الشركة مستندات الامتثال؟",
      answer:
        "بجمع التراخيص والشهادات والبيانات في مساحة آمنة مع رؤية تواريخ الانتهاء والتذكيرات — وهذا ما صُمم له امتثال المستندات في بيدفراء.",
      sections: [
        {
          heading: "تحديات الامتثال الوثائقي",
          body: [
            "المستندات الحرجة تتوزع على البريد ومحركات الأقراص المشتركة، فتُفوت تواريخ الانتهاء.",
          ],
        },
      ],
      faqs: [
        {
          q: "كيف تُدار الشهادات المنتهية؟",
          a: "احفظها في امتثال المستندات لدى بيدفراء، راقب حالة الانتهاء، واستخدم التذكيرات قبل فشل طلب المشتري.",
        },
      ],
      relatedPaths: ["/guides/track-compliance-documents", "/solutions"],
    },
    zh: {
      title: "文件合规与到期跟踪",
      description:
        "用 Bidvera 跟踪合规文件与到期日，在买方要求到来前保持就绪。",
      h1: "企业如何跟踪合规文件？",
      answer:
        "将许可证、证书与声明集中在安全工作区，并具备到期可见性与提醒——这正是 Bidvera 文件合规的设计目标。",
      sections: [
        {
          heading: "常见挑战",
          body: ["关键文件散落在邮件与网盘中，到期日往往在买方询问时才被发现。"],
        },
      ],
      faqs: [
        {
          q: "企业如何管理即将到期的证书？",
          a: "存放在 Bidvera 文件合规中，监控到期状态，并在买方请求失败前使用提醒。",
        },
      ],
      relatedPaths: ["/guides/manage-expiring-certificates", "/solutions"],
    },
  },

  "/solutions/supplier-qualification": {
    fr: {
      title: "Logiciel de qualification fournisseur",
      description:
        "Maintenez le profil de qualification, les capacités et les preuves avec Bidvera — côté fournisseur et PME.",
      h1: "Quel logiciel pour la qualification fournisseur ?",
      answer:
        "Un logiciel de qualification fournisseur structure capacités, couverture, certifications et preuves. Bidvera Qualification Fournisseur le fait dans un espace d’intelligence d’entreprise plus large.",
      sections: [
        {
          heading: "Pourquoi la qualification stagne",
          body: [
            "Les portails acheteurs demandent secteurs, couverture, effectifs et preuves. Les tableurs vieillissent et ne se relient pas aux preuves ni aux décisions.",
          ],
        },
      ],
      faqs: [
        {
          q: "Quel est le meilleur logiciel de qualification fournisseur ?",
          a: "Cela dépend si vous êtes acheteur (master fournisseur) ou fournisseur (préparation). Bidvera vise le côté fournisseur — sans prétendre être universellement le meilleur SRM acheteur.",
        },
      ],
      relatedPaths: [
        "/resources/supplier-qualification-guide",
        "/solutions/evidence-intelligence",
        "/solutions",
      ],
    },
    es: {
      title: "Software de calificación de proveedores",
      description:
        "Mantén perfiles de calificación, capacidades y evidencias con Bidvera — orientado a proveedores y pymes.",
      h1: "¿Qué software ayuda con la calificación de proveedores?",
      answer:
        "El software de calificación estructura capacidades, cobertura, certificaciones y evidencia. Bidvera lo hace dentro de un espacio de inteligencia empresarial más amplio.",
      sections: [
        {
          heading: "Por qué se atasca la calificación",
          body: [
            "Los portales del comprador piden sectores, cobertura y pruebas. Las hojas de cálculo se quedan obsoletas.",
          ],
        },
      ],
      faqs: [
        {
          q: "¿Cuál es el mejor software de calificación de proveedores?",
          a: "Depende de si eres comprador o proveedor. Bidvera está pensado para la preparación del proveedor, no como SRM universal del comprador.",
        },
      ],
      relatedPaths: ["/solutions/document-compliance", "/solutions"],
    },
    ar: {
      title: "برنامج تأهيل الموردين",
      description:
        "أدر ملف التأهيل والقدرات والأدلة مع بيدفراء — للموردين والمنشآت الصغيرة والمتوسطة.",
      h1: "ما البرنامج الذي يساعد في تأهيل الموردين؟",
      answer:
        "برامج تأهيل الموردين تحافظ على هيكل القدرات والتغطية والشهادات والأدلة. تأهيل الموردين في بيدفراء جزء من مساحة ذكاء الشركة الأوسع.",
      sections: [
        {
          heading: "لماذا يتعثر التأهيل",
          body: [
            "بوابات المشتري تطلب قطاعات وتغطية وشهادات وإثباتات، والجداول تتقادم بسرعة.",
          ],
        },
      ],
      faqs: [
        {
          q: "ما أفضل برنامج لتأهيل الموردين؟",
          a: "يعتمد على كونك مشترياً أو مورداً. بيدفراء موجهة لجاهزية المورد وليس كمنصة SRM شاملة للمشتري.",
        },
      ],
      relatedPaths: ["/solutions/document-compliance", "/solutions"],
    },
    zh: {
      title: "供应商资质管理软件",
      description:
        "用 Bidvera 维护资质档案、能力与证据——面向供应商与中小企业。",
      h1: "什么软件有助于供应商资质管理？",
      answer:
        "供应商资质软件帮助结构化能力、覆盖范围、认证与证明材料。Bidvera 供应商资质能力嵌入更广泛的企业情报工作区。",
      sections: [
        {
          heading: "资质为何停滞",
          body: ["买方门户要求行业、覆盖、人数与证明；表格很快过期且无法连接证据与决策。"],
        },
      ],
      faqs: [
        {
          q: "最好的供应商资质管理软件是什么？",
          a: "取决于你是买方还是供应商。Bidvera 面向供应商侧就绪度，不宣称取代所有买方 SRM。",
        },
      ],
      relatedPaths: ["/solutions/document-compliance", "/solutions"],
    },
  },

  "/solutions/evidence-intelligence": {
    fr: {
      title: "Intelligence des preuves métier",
      description:
        "Organisez et vérifiez les preuves métier face aux exigences avec Bidvera Evidence Intelligence.",
      h1: "Comment organiser les preuves métier ?",
      answer:
        "En reliant exigences, documents et faits d’entreprise dans un même espace. Bidvera Evidence Intelligence connecte ce que vous affirmez à ce que vous pouvez montrer.",
      sections: [
        {
          heading: "Preuves sans structure",
          body: [
            "Les fichiers existent, mais les équipes ne savent pas quelle exigence chaque fichier soutient.",
          ],
        },
      ],
      relatedPaths: [
        "/guides/organize-business-evidence",
        "/solutions/client-requests-questionnaires",
        "/solutions",
      ],
    },
    es: {
      title: "Inteligencia de evidencias empresariales",
      description:
        "Organiza y verifica evidencias frente a requisitos con Bidvera Evidence Intelligence.",
      h1: "¿Cómo organizar evidencias empresariales?",
      answer:
        "Vinculando requisitos con documentos y hechos de la empresa en un solo espacio. Bidvera conecta lo que afirmas con lo que puedes demostrar.",
      sections: [
        {
          heading: "Evidencia sin estructura",
          body: [
            "Los archivos existen, pero el equipo no sabe qué requisito respalda cada uno.",
          ],
        },
      ],
      relatedPaths: ["/guides/organize-business-evidence", "/solutions"],
    },
    ar: {
      title: "ذكاء أدلة الأعمال",
      description:
        "نظّم أدلة الأعمال وتحقق منها مقابل المتطلبات مع بيدفراء.",
      h1: "كيف تنظّم الشركات أدلة الأعمال؟",
      answer:
        "بربط المتطلبات بالمستندات وحقائق الشركة في مساحة واحدة. ذكاء الأدلة في بيدفراء يربط ما تدّعيه بما تستطيع إثباته.",
      sections: [
        {
          heading: "أدلة بلا هيكل",
          body: ["الملفات موجودة لكن الفرق لا تعرف أي متطلب يدعمه كل ملف."],
        },
      ],
      relatedPaths: ["/guides/organize-business-evidence", "/solutions"],
    },
    zh: {
      title: "业务证据情报",
      description: "用 Bidvera 证据情报对照需求组织并核验业务证据。",
      h1: "企业如何组织业务证据？",
      answer:
        "将需求与支撑文件、公司事实关联在同一工作区。Bidvera 证据情报连接“声称”与“可出示”的证据。",
      sections: [
        {
          heading: "无结构的证据会失败",
          body: ["文件存在，但团队无法说明每份文件支撑哪项要求。"],
        },
      ],
      relatedPaths: ["/guides/organize-business-evidence", "/solutions"],
    },
  },

  "/solutions/client-requests-questionnaires": {
    fr: {
      title: "Demandes clients et assistant questionnaire",
      description:
        "Gérez les dossiers documentaires acheteurs et structurez les réponses questionnaire avec Bidvera.",
      h1: "Quel logiciel pour répondre aux questionnaires clients ?",
      answer:
        "Un logiciel qui structure les questions, relie les réponses aux preuves et suit l’avancement. Bidvera propose Client Requests et un assistant questionnaire conscient des preuves, avec vérification humaine quand le support manque.",
      sections: [
        {
          heading: "Capacités Bidvera",
          body: [
            "Client Requests centralise les demandes. L’assistant structure et peut rédiger des brouillons sourcés — sans inventer de preuves.",
          ],
        },
      ],
      faqs: [
        {
          q: "L’IA invente-t-elle des réponses ?",
          a: "Les brouillons s’appuient sur les preuves. En cas de manque, Bidvera vise à signaler la vérification plutôt qu’à fabriquer une preuve.",
        },
      ],
      relatedPaths: [
        "/guides/respond-to-client-questionnaires",
        "/use-cases/responding-to-buyers",
        "/solutions",
      ],
    },
    es: {
      title: "Solicitudes de clientes y asistente de cuestionarios",
      description:
        "Gestiona solicitudes documentales y respuestas a cuestionarios con Bidvera.",
      h1: "¿Qué software ayuda a responder cuestionarios de clientes?",
      answer:
        "Software que estructura preguntas, vincula respuestas a evidencias y controla el avance. Bidvera ofrece Client Requests y un asistente consciente de evidencias, con verificación humana cuando falta soporte.",
      sections: [
        {
          heading: "Capacidades",
          body: [
            "Client Requests centraliza pedidos. El asistente puede redactar borradores con procedencia y marcar VERIFY si falta evidencia.",
          ],
        },
      ],
      relatedPaths: ["/guides/respond-to-client-questionnaires", "/solutions"],
    },
    ar: {
      title: "طلبات العملاء ومساعد الاستبيانات",
      description:
        "أدر طلبات مستندات المشترين وهيكل إجابات الاستبيانات مع بيدفراء.",
      h1: "ما البرنامج الذي يساعد في الرد على استبيانات العملاء؟",
      answer:
        "البرنامج الذي يهيكل الأسئلة ويربط الإجابات بالأدلة ويتتبع الإنجاز. بيدفراء توفر طلبات العملاء ومساعد استبيان واعٍ بالأدلة مع تحقق بشري عند نقص الدعم.",
      sections: [
        {
          heading: "قدرات بيدفراء",
          body: [
            "طلبات العملاء تجمع الطلبات. المساعد يمكنه صياغة مسودات مدعومة ويحدد الحاجة للتحقق دون اختلاق أدلة.",
          ],
        },
      ],
      relatedPaths: ["/guides/respond-to-client-questionnaires", "/solutions"],
    },
    zh: {
      title: "客户请求与问卷助手",
      description: "用 Bidvera 管理买方文件请求并结构化问卷答复。",
      h1: "什么软件帮助企业回复客户问卷？",
      answer:
        "能结构化问题、把答案关联到证据并跟踪完成度的软件。Bidvera 提供客户请求与证据感知的问卷助手；证据不足时需人工核实，不会编造证明。",
      sections: [
        {
          heading: "Bidvera 能力",
          body: ["客户请求集中管理买方材料；问卷助手可起草有出处的草稿，并在证据不足时标记核实。"],
        },
      ],
      relatedPaths: ["/guides/respond-to-client-questionnaires", "/solutions"],
    },
  },

  "/solutions/decision-intelligence": {
    fr: {
      title: "Aide à la décision soumissionner / ne pas soumissionner",
      description:
        "Décisions BID / REVIEW / NO-BID explicables, mémoire de décision, workflow d’équipe et plans d’action avec Bidvera.",
      h1: "Comment fonctionne l’aide à la décision d’appel d’offres ?",
      answer:
        "Le moteur de décision Bidvera produit des résultats BID, REVIEW ou NO-BID explicables à partir de la préparation, des qualifications et des preuves. La mémoire de décision, le workflow, les alertes et les plans d’action aident l’équipe — l’analyse d’AO n’est qu’un entrée.",
      sections: [
        {
          heading: "Décision explicable",
          body: [
            "Les équipes ont besoin de raisons, de bloqueurs et d’actions — pas seulement d’une étiquette.",
          ],
        },
      ],
      relatedPaths: [
        "/resources/bid-no-bid-decision-guide",
        "/solutions/opportunity-readiness",
        "/solutions",
      ],
    },
    es: {
      title: "Soporte de decisión ofertar / no ofertar",
      description:
        "Resultados BID / REVIEW / NO-BID explicables, memoria de decisión, flujo de equipo y planes de acción con Bidvera.",
      h1: "¿Cómo funciona el soporte de decisión de licitación?",
      answer:
        "El motor de decisión de Bidvera produce BID, REVIEW o NO-BID explicables a partir de preparación, cualificación y evidencias. Memoria, flujo, alertas y planes de acción ayudan al equipo; el análisis de licitación es una entrada, no todo el producto.",
      sections: [
        {
          heading: "Decisión explicable",
          body: ["Los equipos necesitan racional, bloqueos y siguientes pasos — no solo una etiqueta."],
        },
      ],
      relatedPaths: ["/resources/bid-no-bid-decision-guide", "/solutions"],
    },
    ar: {
      title: "دعم قرار التقديم أو عدم التقديم",
      description:
        "نتائج BID / REVIEW / NO-BID قابلة للتفسير، وذاكرة قرار، وسير عمل الفريق وخطط عمل مع بيدفراء.",
      h1: "كيف يعمل دعم قرار المناقصة في بيدفراء؟",
      answer:
        "ينتج محرك القرار في بيدفراء نتائج قابلة للتفسير من الجاهزية والتأهيل والأدلة. ذاكرة القرار وسير العمل والتنبيهات وخطط العمل تساعد الفريق — وتحليل المناقصة مدخل واحد وليس المنتج كله.",
      sections: [
        {
          heading: "قرار قابل للتفسير",
          body: ["تحتاج الفرق إلى مبررات وعوائق وخطوات تالية — وليس مجرد تسمية."],
        },
      ],
      relatedPaths: ["/solutions/opportunity-readiness", "/solutions"],
    },
    zh: {
      title: "投 / 不投决策支持",
      description:
        "用 Bidvera 获得可解释的 BID / REVIEW / NO-BID、决策记忆、团队工作流与行动计划。",
      h1: "Bidvera 的投标决策支持如何工作？",
      answer:
        "Bidvera 决策引擎基于就绪度、资质与证据给出可解释的 BID、REVIEW 或 NO-BID。决策记忆、团队流程、智能提醒与行动计划帮助执行——招投标分析只是输入之一，不是全部产品。",
      sections: [
        {
          heading: "可解释决策，而非黑箱",
          body: ["团队需要理由、阻碍与下一步，而不仅仅是一个标签。"],
        },
      ],
      relatedPaths: ["/resources/bid-no-bid-decision-guide", "/solutions"],
    },
  },

  "/solutions/opportunity-readiness": {
    fr: {
      title: "Préparation et organisation des opportunités",
      description:
        "Organisez demandes clients et échéances d’AO avec Bidvera — sans revendiquer un flux public de découverte automatique.",
      h1: "Comment rester prêt pour les opportunités business ?",
      answer:
        "En capturant les demandes entrantes, en suivant les dates clés, en maintenant conformité et qualifications, puis en évaluant les exigences face aux capacités réelles. Bidvera soutient cette boucle. Il ne commercialise pas ici un marketplace de découverte automatique d’appels d’offres publics.",
      sections: [
        {
          heading: "Sans fausses promesses",
          body: [
            "Le travail d’opportunité chez Bidvera s’appuie sur Client Requests, calendrier, analyse et décisions.",
            "Matching Engine / découverte automatisée ne sont pas présentés comme offres généralement disponibles.",
          ],
        },
      ],
      relatedPaths: [
        "/solutions/client-requests-questionnaires",
        "/use-cases/sme-suppliers",
        "/solutions",
      ],
    },
    es: {
      title: "Preparación y organización de oportunidades",
      description:
        "Organiza solicitudes de clientes y plazos de licitación con Bidvera — sin afirmar un feed público de descubrimiento automático.",
      h1: "¿Cómo mantenerse listo para oportunidades de negocio?",
      answer:
        "Capturando solicitudes entrantes, siguiendo fechas clave, manteniendo cumplimiento y cualificaciones, y evaluando requisitos frente a capacidades reales. Bidvera apoya ese ciclo. No comercializa aquí un marketplace de descubrimiento automático de licitaciones públicas.",
      sections: [
        {
          heading: "Sin afirmaciones falsas",
          body: [
            "El trabajo de oportunidades se centra en Client Requests, calendario, análisis y decisiones.",
          ],
        },
      ],
      relatedPaths: ["/use-cases/sme-suppliers", "/solutions"],
    },
    ar: {
      title: "جاهزية الفرص وتنظيمها",
      description:
        "نظّم طلبات العملاء ومواعيد المناقصات مع بيدفراء — دون الادعاء بوجود تغذية اكتشاف عام تلقائي.",
      h1: "كيف تبقى الشركة جاهزة لفرص الأعمال؟",
      answer:
        "بالتقاط الطلبات الواردة وتتبع التواريخ والحفاظ على الامتثال والتأهيل وتقييم المتطلبات مقابل القدرات الفعلية. بيدفراء تدعم هذه الدورة. ولا تُسوَّق هنا سوق اكتشاف تلقائي للمناقصات العامة كميزة متاحة عموماً.",
      sections: [
        {
          heading: "بدون ادعاءات زائفة",
          body: [
            "عمل الفرص في بيدفراء يرتكز على طلبات العملاء والتقويم والتحليل والقرارات.",
          ],
        },
      ],
      relatedPaths: ["/solutions/client-requests-questionnaires", "/solutions"],
    },
    zh: {
      title: "商机就绪与组织",
      description:
        "用 Bidvera 组织客户请求与标书截止日期——不宣称自动公开招标发现流。",
      h1: "企业如何为商机保持就绪？",
      answer:
        "捕获入站客户请求、跟踪关键日期、保持合规与资质最新，并根据真实能力评估需求。Bidvera 支持该就绪闭环。此处不将自动公开招标发现市场宣传为普遍可用功能。",
      sections: [
        {
          heading: "不做虚假声明",
          body: ["商机工作围绕客户请求、日历、分析与决策；Matching Engine / 自动发现不在此作为一般可用产品宣传。"],
        },
      ],
      relatedPaths: ["/use-cases/sme-suppliers", "/solutions"],
    },
  },
};

export function mergeSolutionLocales(pages: SeoPageContent[]): SeoPageContent[] {
  return pages.map((page) => {
    const overlay = solutionLocaleOverlays[page.path];
    if (!overlay) return page;
    return {
      ...page,
      locales: {
        ...page.locales,
        ...overlay,
      },
    };
  });
}
