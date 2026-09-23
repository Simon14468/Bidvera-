import { getLegalPendingCopy } from "./pending";
import type { LegalSection } from "./types";

const PENDING = getLegalPendingCopy("fr");

export const termsOfServiceSectionsFr: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introduction, accord et champ d’application",
    paragraphs: [
      "Les présentes Conditions d’utilisation (« Conditions ») régissent l’accès et l’usage des sites et de la plateforme logicielle Bidvera en tant que service (le « Service »).",
      "En créant un compte, en acceptant ces Conditions ou en utilisant le Service, vous acceptez ces Conditions et notre Politique de confidentialité. Si vous utilisez Bidvera pour le compte d’une entreprise, vous déclarez avoir le pouvoir de l’engager.",
      "Si vous n’êtes pas d’accord, n’utilisez pas le Service.",
      "Ces Conditions sont un résumé contractuel pour les utilisateurs de Bidvera. Elles ne remplacent pas l’avis d’un avocat qualifié.",
    ],
  },
  {
    id: "definitions",
    title: "2. Définitions",
    paragraphs: ["Dans ces Conditions :"],
    bullets: [
      PENDING.operatorIdentity,
      "« Plateforme » ou « Service » désigne l’application web Bidvera, les API associées et les sites connexes.",
      "« Utilisateur » désigne une personne qui accède au Service.",
      "« Client » désigne l’entreprise ou l’organisation qui possède ou administre un espace de travail et est responsable de ses Utilisateurs.",
      "« Entreprise » ou « espace de travail » désigne un compte d’organisation (locataire) dans Bidvera.",
      "« Contenu » désigne les données, textes, fichiers et matériels soumis ou générés dans le Service.",
      "« Documents » désigne les fichiers que vous téléversez (par exemple appels d’offres, certificats, questionnaires ou matériels de demandes clients).",
      "« Résultats » désigne les analyses, brouillons, scores, recommandations, rappels ou autres sorties produites par les fonctions Bidvera, y compris celles assistées par l’IA.",
      "« Abonnement » désigne un plan payant ou gratuit/d’essai qui contrôle l’accès aux modules et aux limites.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Éligibilité et pouvoir",
    paragraphs: [
      "Vous devez pouvoir conclure un contrat valable selon le droit applicable et n’utiliser Bidvera qu’à des fins professionnelles licites. Le Service est destiné à un usage organisationnel et professionnel, non aux enfants.",
      "Si vous invitez des collègues, vous confirmez être habilité à le faire pour votre organisation.",
    ],
  },
  {
    id: "accounts",
    title: "4. Comptes, inscription et sécurité",
    paragraphs: [
      "Vous devez fournir des informations de compte exactes et les tenir à jour. Vous êtes responsable de la protection des identifiants et de l’activité de votre compte.",
      "Signalez-nous rapidement tout accès non autorisé. Bidvera peut exiger une vérification d’e-mail, des contrôles anti-bot, des limites de débit et d’autres mesures de sécurité.",
      "Si vous utilisez la connexion Google, vous devez sécuriser votre compte Google ; Bidvera s’appuie sur les assertions d’authentification de Google pour cette méthode.",
    ],
  },
  {
    id: "workspaces",
    title: "5. Espaces de travail, rôles et administrateurs",
    paragraphs: [
      "Bidvera organise les données par espace de travail d’entreprise. Les propriétaires et administrateurs peuvent gérer les paramètres, les sièges, la facturation (lorsque cela est autorisé) et l’accès de leur espace.",
      "Le Client est responsable de la configuration appropriée des rôles, du respect de ces Conditions par les Utilisateurs et du Contenu soumis par ceux-ci.",
      "Les outils Super Admin ou d’opérateur utilisés par le personnel Bidvera (le cas échéant) sont distincts de l’administration de l’espace Client et sont régis par les contrôles internes de Bidvera.",
    ],
  },
  {
    id: "services",
    title: "6. Description du Service",
    paragraphs: [
      "Bidvera fournit un logiciel d’intelligence d’entreprise et de préparation aux marchés. Selon votre Abonnement et les indicateurs de fonctions, les modules peuvent inclure (sans limitation) : gestion du profil d’entreprise ; conformité documentaire et échéances ; qualification des fournisseurs ; outils de preuves ; gestion des demandes clients ; assistance aux questionnaires ; calendrier d’appels d’offres et rappels ; mémoire de décisions ; flux d’équipe ; alertes intelligentes ; facturation et plans ; et un assistant IA pour les questions relatives à Bidvera.",
      "Certaines capacités présentes dans le code peuvent être commercialement indisponibles, désactivées globalement ou limitées à des tests internes/administratifs. Bidvera ne promet pas que chaque module technique soit vendu ou activé pour chaque Client.",
      "Les capacités de mise en relation/opportunité ou de type analyse d’appels d’offres, si présentes dans votre environnement, ne sont fournies que lorsqu’elles sont activées pour votre compte et ne doivent pas être traitées comme une garantie de qualité d’opportunité ni d’attribution.",
    ],
  },
  {
    id: "ai-limitations",
    title: "7. Contenus générés par l’IA et limites",
    paragraphs: [
      "Des parties du Service utilisent l’intelligence artificielle et un traitement automatisé. Les Résultats peuvent être incomplets, inexacts, obsolètes, biaisés ou inadaptés à votre situation.",
      "Vous devez vérifier de manière indépendante les exigences d’appel d’offres, l’éligibilité, les délais, les calculs, les conditions juridiques et commerciales et toute décision d’achat. Bidvera n’est pas un cabinet d’avocats, une autorité de marchés, un auditeur ni un conseiller financier, et ne remplace pas un conseil professionnel.",
      "Vous restez seul responsable des offres, soumissions et décisions d’affaires prises à l’aide du Service.",
    ],
  },
  {
    id: "no-guarantee",
    title: "8. Absence de garantie de résultats",
    paragraphs: [
      "Bidvera ne garantit pas que vous remporterez des appels d’offres, serez qualifié, répondrez aux exigences d’un acheteur, obtiendrez un résultat commercial, ni que le Service sera exempt d’erreurs ou d’interruptions.",
      "La disponibilité, les fonctions et les limites de plan peuvent évoluer à mesure que nous améliorons le produit.",
    ],
  },
  {
    id: "user-content",
    title: "9. Contenu utilisateur et documents téléversés",
    paragraphs: [
      "Entre vous et Bidvera, vous (ou votre Client) conservez la propriété des Documents et autre Contenu que vous soumettez, dans la mesure où vous les détenez selon le droit applicable.",
      "Vous accordez à Bidvera une licence limitée, mondiale et non exclusive pour héberger, traiter, transmettre, afficher et créer des Résultats dérivés de votre Contenu uniquement dans la mesure nécessaire pour exploiter, sécuriser, maintenir, assister et fournir le Service (y compris via des sous-traitants tels que l’hébergement, l’e-mail, le paiement et l’IA).",
      "Bidvera ne revendique pas la propriété de vos documents d’appel d’offres ou d’entreprise téléversés.",
      "Vous déclarez disposer de tous les droits nécessaires pour soumettre du Contenu et que cela ne viole pas la loi ni les droits de tiers.",
    ],
  },
  {
    id: "prohibited",
    title: "10. Responsabilités et usages interdits",
    paragraphs: ["Vous vous engagez à ne pas :"],
    bullets: [
      "Utiliser le Service de manière illicite ou pour une activité frauduleuse de marchés.",
      "Porter atteinte aux droits de propriété intellectuelle ou à la vie privée.",
      "Téléverser des logiciels malveillants ou tenter de perturber ou de sonder le Service.",
      "Contourner l’authentification, les droits, les limites de débit ou les contrôles de sécurité.",
      "Moissonner, exporter en masse ou désosser le Service, sauf dans la mesure permise par une loi impérative.",
      "Partager des identifiants ou permettre un accès non autorisé à un espace de travail.",
      "Présenter des Résultats d’IA comme un conseil juridique ou de marchés vérifié.",
      "Soumettre un Contenu que vous n’êtes pas autorisé à partager (y compris des matériels confidentiels de tiers sans droits).",
    ],
  },
  {
    id: "ip",
    title: "11. Propriété intellectuelle",
    paragraphs: [
      "Bidvera et ses concédants détiennent le logiciel du Service, la marque, l’interface, la documentation et les matériels associés. Ces Conditions ne vous transfèrent pas la PI de Bidvera.",
      "Votre Contenu reste le vôtre comme indiqué ci-dessus. Les marques de tiers (par exemple Google ou des marques de paiement) appartiennent à leurs titulaires.",
    ],
  },
  {
    id: "privacy",
    title: "12. Confidentialité et traitement des données",
    paragraphs: [
      "Les données personnelles sont traitées comme décrit dans notre Politique de confidentialité (liée depuis cette page et le pied de site). Elle explique les catégories de données, les finalités, les cookies et les canaux de contact.",
      "Si vous avez besoin d’un accord de traitement des données ou d’une liste de sous-traitants pour un achat d’entreprise, demandez-le à Bidvera par écrit.",
    ],
  },
  {
    id: "billing",
    title: "13. Abonnements, essais et facturation",
    paragraphs: [
      "Bidvera propose des plans pouvant inclure un espace gratuit, un essai et des abonnements payants. Les droits (modules, sièges, limites d’analyse ou d’usage) sont contrôlés par votre plan actif et la configuration d’administration.",
      "Le paiement peut être traité par des prestataires tiers (tels que PayPal et, s’il est activé, Stripe). Leurs conditions s’appliquent également au traitement des paiements.",
      "Les prix, taxes, intervalles de renouvellement, délais de grâce et promotions sont ceux affichés au paiement ou dans l’interface de facturation au moment de l’achat, ou convenus par écrit. Ce document n’invente pas de prix ni de taux d’imposition fixes.",
      "Les échecs de paiement peuvent entraîner un retard, un accès restreint ou une suspension selon le cycle de facturation de votre compte.",
      "Les montées, descentes et résiliations se gèrent via les interfaces de facturation ou en contactant le support Bidvera, sous réserve des règles de plan alors en vigueur.",
    ],
  },
  {
    id: "refunds",
    title: "14. Remboursements et résiliation",
    paragraphs: [
      PENDING.refundPolicy,
      "Résilier un Abonnement arrête généralement les renouvellements futurs ; cela ne supprime pas automatiquement votre Contenu sauf demande et traitement distincts.",
    ],
  },
  {
    id: "availability",
    title: "15. Disponibilité, modifications, suspension et maintenance",
    paragraphs: [
      "Nous visons à maintenir le Service disponible sans garantir une disponibilité ininterrompue. Nous pouvons effectuer une maintenance, déployer des mises à jour ou modifier des fonctions.",
      "Nous pouvons suspendre ou limiter l’accès pour protéger la sécurité, traiter des abus, faire respecter ces Conditions, respecter la loi ou gérer des comptes impayés.",
    ],
  },
  {
    id: "termination",
    title: "16. Résiliation et effets",
    paragraphs: [
      "Vous pouvez cesser d’utiliser le Service à tout moment. Nous pouvons résilier ou suspendre l’accès en cas de manquement grave, d’usage illicite ou selon ce que permettent ces Conditions.",
      "Après résiliation, votre droit d’accès cesse. La conservation ou la suppression du Contenu suit notre Politique de confidentialité, les sauvegardes et les obligations légales. Nous ne promettons pas la suppression immédiate et irréversible de toutes les copies, sauf accord séparé et mise en œuvre technique.",
    ],
  },
  {
    id: "confidentiality",
    title: "17. Confidentialité",
    paragraphs: [
      "Chaque partie peut recevoir des informations commerciales confidentielles de l’autre. Le destinataire prendra un soin raisonnable pour les protéger et ne les utiliser que pour l’exécution de ces Conditions, sauf informations publiques, développées indépendamment ou dont la divulgation est exigée par la loi.",
      "Les Documents du Client sont traités comme des informations confidentielles du Client, sous réserve de la licence de traitement de l’article 9 et de la Politique de confidentialité.",
    ],
  },
  {
    id: "third-party",
    title: "18. Services de tiers",
    paragraphs: [
      "Le Service peut intégrer des tiers pour la connexion, les paiements, l’e-mail, l’hébergement, la protection anti-bot et l’inférence IA. Votre usage de ces services peut être soumis à leurs conditions. Bidvera n’est pas responsable des pannes ou changements de politique de tiers hors de notre contrôle.",
    ],
  },
  {
    id: "disclaimers",
    title: "19. Exclusions de garantie",
    paragraphs: [
      "DANS LA MESURE MAXIMALE PERMISE PAR LE DROIT APPLICABLE, LE SERVICE ET LES RÉSULTATS SONT FOURNIS « EN L’ÉTAT » ET « SELON DISPONIBILITÉ », SANS GARANTIE DE QUALITÉ MARCHANDE, D’ADÉQUATION À UN USAGE PARTICULIER OU DE NON-CONTREFAÇON, ET SANS GARANTIE QUE LES RÉSULTATS SOIENT EXACTS OU COMPLETS.",
      "Rien dans ces Conditions n’exclut une responsabilité qui ne peut l’être en vertu d’une loi impérative.",
    ],
  },
  {
    id: "liability",
    title: "20. Limitation de responsabilité",
    paragraphs: [
      "DANS LA MESURE MAXIMALE PERMISE PAR LE DROIT APPLICABLE, BIDVERA ET SES FOURNISSEURS NE SERONT PAS RESPONSABLES DES DOMMAGES INDIRECTS, ACCESSOIRES, SPÉCIAUX, CONSÉCUTIFS OU DU MANQUE À GAGNER, NI DES OFFRES PERDUES, AFFAIRES PERDUES OU RÉSULTATS DE MARCHÉS.",
      "DANS LA MESURE MAXIMALE PERMISE PAR LE DROIT APPLICABLE, LA RESPONSABILITÉ GLOBALE DE BIDVERA DÉCOULANT DE CES CONDITIONS OU DU SERVICE EST LIMITÉE AUX MONTANTS PAYÉS PAR LE CLIENT À BIDVERA POUR LE SERVICE AU COURS DES DOUZE (12) MOIS PRÉCÉDANT LA RÉCLAMATION (OU, À DÉFAUT, CENT DOLLARS US OU ÉQUIVALENT LOCAL).",
      PENDING.liabilityLimitsNote,
    ],
  },
  {
    id: "indemnity",
    title: "21. Indemnisation",
    paragraphs: [
      "Dans la mesure permise par la loi, le Client défendra et indemnisera Bidvera contre les réclamations de tiers découlant du Contenu du Client, d’un usage abusif du Service ou de la violation de ces Conditions ou du droit applicable, sauf dans la mesure causée par une faute intentionnelle de Bidvera.",
      PENDING.indemnityScopeNote,
    ],
  },
  {
    id: "governing-law",
    title: "22. Droit applicable et litiges",
    paragraphs: [
      PENDING.governingLaw,
      PENDING.governingLawProcess,
    ],
  },
  {
    id: "changes-terms",
    title: "23. Modifications des présentes Conditions",
    paragraphs: [
      "Nous pouvons mettre à jour ces Conditions. La date d’entrée en vigueur / de dernière mise à jour de cette page changera lors de la publication d’une nouvelle version. L’usage continu après cette date vaut acceptation des Conditions mises à jour, sauf si une loi impérative impose un autre processus.",
    ],
  },
  {
    id: "general",
    title: "24. Dispositions générales",
    paragraphs: [
      "Si une disposition est inapplicable, le reste demeure en vigueur. Le défaut d’appliquer une disposition n’est pas une renonciation. Ces Conditions, avec la Politique de confidentialité et tout bon de commande ou conditions de plan affichées au paiement, constituent l’intégralité de l’accord relatif au Service et remplacent les ententes antérieures contradictoires sur le même objet.",
      "Vous ne pouvez pas céder ces Conditions sans notre consentement ; nous pouvons les céder dans le cadre d’une réorganisation ou d’une cession d’actifs. Aucune partie n’est responsable des retards dus à des événements hors de son contrôle raisonnable (force majeure).",
    ],
  },
];
