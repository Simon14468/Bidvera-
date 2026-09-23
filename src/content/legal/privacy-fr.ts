import { getLegalPendingCopy } from "./pending";
import type { LegalSection } from "./types";

const PENDING = getLegalPendingCopy("fr");

export const privacyPolicySectionsFr: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introduction et champ d’application",
    paragraphs: [
      "La présente Politique de confidentialité explique comment Bidvera (« Bidvera », « nous » ou « notre ») traite les données personnelles lorsque vous visitez getbidvera.com, créez un compte ou utilisez la plateforme logicielle Bidvera en tant que service.",
      "Bidvera aide les équipes à gérer la préparation de l’entreprise, la conformité documentaire, la qualification des fournisseurs, les preuves, les demandes clients, les questionnaires, les calendriers, l’aide à la décision et des fonctions d’espace de travail associées. Certains modules n’apparaissent que s’ils sont activés pour votre abonnement ou votre organisation.",
      "Cette Politique s’applique aux données personnelles traitées via nos sites, l’application authentifiée et les canaux d’assistance associés. Elle ne couvre pas les sites ou services de tiers que nous ne contrôlons pas.",
      "Ce document est informatif et ne constitue pas un conseil juridique. La conformité définitive de votre organisation doit être examinée par un conseil qualifié.",
    ],
  },
  {
    id: "controller",
    title: "2. Responsable du traitement",
    paragraphs: [
      PENDING.controllerIdentity,
      PENDING.registeredAddress,
      PENDING.privacyContact,
      PENDING.dataProtectionContact,
    ],
  },
  {
    id: "categories",
    title: "3. Catégories de données personnelles traitées",
    paragraphs: [
      "Selon votre usage de Bidvera, nous pouvons traiter les catégories suivantes. Nous ne collectons que ce qui est nécessaire pour fournir le service demandé.",
    ],
    bullets: [
      "Données de compte et d’identité : nom, e-mail, rôle dans un espace de travail, statut d’onboarding et informations de profil que vous fournissez (y compris une photo de profil facultative).",
      "Données d’authentification : identifiants mot de passe (stockés sous forme de hachages irréversibles si vous utilisez e-mail/mot de passe), identifiants de session et empreintes d’appareil utilisées pour la sécurité.",
      "Données de connexion Google (lorsqu’elle est activée) : identifiant de compte Google, e-mail vérifié et nom/photo renvoyés par Google pour l’authentification. Nous ne recevons ni ne stockons votre mot de passe Google.",
      "Données d’entreprise / d’espace de travail : nom de l’entreprise, champs de profil, pays, taille et autres attributs professionnels saisis pour les fonctions de préparation et de collaboration.",
      "Documents et contenus de travail : dossiers d’appels d’offres, documents de conformité, preuves de qualification, matériels de questionnaires, fichiers de demandes clients et métadonnées nécessaires aux fonctions utilisées.",
      "Données de facturation : métadonnées d’abonnement et de plan, références du prestataire de paiement, factures/enregistrements de paiement tenus par Bidvera et contexte de contact de facturation. Les données de carte ou identifiants PayPal sont gérés par le prestataire de paiement ; Bidvera n’est pas conçue pour stocker des numéros de carte complets.",
      "Communications d’assistance et d’exploitation : messages et e-mails liés à la vérification, à la réinitialisation du mot de passe, aux alertes et au support.",
      "Données techniques et de sécurité : adresse IP (souvent stockée sous forme hachée pour la sécurité/l’audit), user-agent, horodatages, signaux de limitation de débit et de prévention des abus, et journaux d’application.",
      "Cookies et technologies similaires : cookies de session, cookies de langue, cookies temporaires d’état OAuth et stockage local du navigateur pour le thème (voir Cookies).",
    ],
  },
  {
    id: "sources",
    title: "4. Sources des données",
    paragraphs: [
      "Nous obtenons des données personnelles : (a) de vous ou de votre organisation lors de l’inscription, de l’onboarding, du téléversement de contenus ou de la configuration ; (b) de prestataires d’authentification tels que Google si vous choisissez la connexion Google ; (c) de prestataires de paiement pour le statut d’abonnement et les événements de paiement ; (d) de systèmes automatisés qui génèrent journaux et signaux de sécurité ; et (e) de prestataires d’e-mail et de protection anti-bot lorsque ces fonctions sont activées.",
    ],
  },
  {
    id: "purposes",
    title: "5. Finalités du traitement",
    paragraphs: [
      "Nous traitons des données personnelles afin de :",
    ],
    bullets: [
      "Créer et administrer les comptes, authentifier les utilisateurs, maintenir les sessions et finaliser l’onboarding.",
      "Fournir les fonctions Bidvera auxquelles vous avez droit (par exemple conformité documentaire, qualification fournisseurs, calendrier d’appels d’offres, demandes clients, assistance aux questionnaires, mémoire de décisions, flux d’équipe, alertes intelligentes, profil d’entreprise et outils associés).",
      "Traiter les documents téléversés et les données structurées pour produire les analyses, listes, brouillons, rappels ou autres résultats demandés.",
      "Assurer la facturation, les essais, les droits de plan et les intégrations de paiement.",
      "Envoyer des e-mails transactionnels (vérification, réinitialisation, alertes) et répondre au support.",
      "Protéger le service : prévenir les abus, appliquer les limites de débit, détecter la fraude ou l’accès non autorisé et tenir des journaux d’audit.",
      "Améliorer la fiabilité et l’expérience à partir de métriques opérationnelles et de retours, sans affirmer d’usages secondaires non vérifiés.",
      "Respecter les obligations légales applicables et répondre aux demandes licites.",
    ],
  },
  {
    id: "legal-bases",
    title: "6. Bases juridiques",
    paragraphs: [
      "Lorsque les lois sur la protection des données exigent une base juridique, nous nous appuyons généralement sur l’une ou plusieurs des bases suivantes, selon l’activité et votre localisation :",
    ],
    bullets: [
      "Exécution d’un contrat — pour fournir le service Bidvera que vous ou votre organisation demandez.",
      "Intérêts légitimes — par exemple sécuriser la plateforme, prévenir les abus et améliorer la fiabilité, mis en balance avec vos droits.",
      "Consentement — lorsque requis (par exemple certains traitements optionnels ou le marketing, s’ils sont proposés et consentis).",
      "Obligations légales — lorsque le traitement est nécessaire pour respecter le droit applicable.",
    ],
  },
  {
    id: "ai-documents",
    title: "7. Traitement par IA et documents téléversés",
    paragraphs: [
      "Bidvera inclut des fonctions d’intelligence artificielle et de traitement automatisé pour vous aider à examiner des documents, extraire des informations, rédiger des réponses de questionnaire, étayer des décisions ou assister des flux associés.",
      "Lorsque vous téléversez des documents d’appel d’offres, de marchés, de conformité ou d’entreprise, ce contenu est traité pour fournir la fonction demandée (analyse, suivi de conformité, assistance aux questionnaires ou collaboration). Les résultats peuvent être incomplets, inexacts ou inadaptés à une décision d’achat ; vous restez responsable de leur vérification indépendante.",
      "Cette Politique n’affirme pas que les documents clients ne sont jamais utilisés pour l’entraînement de modèles, jamais examinés par des humains, ni automatiquement supprimés après une durée fixe, sauf engagement écrit distinct ou contrôle technique vérifié applicable à votre compte. Contactez Bidvera ou un conseil si vous avez besoin de conditions contractuelles de traitement supplémentaires.",
      "Les prestataires qui alimentent les fonctions d’IA peuvent traiter des invites, documents ou textes dérivés pour générer des réponses, sous réserve de nos accords avec ces prestataires et du droit applicable.",
    ],
  },
  {
    id: "google-oauth",
    title: "8. Connexion Google",
    paragraphs: [
      "Si la connexion Google est activée pour Bidvera et que vous l’utilisez, nous recevons de Google des informations d’identité (identifiant Google stable, e-mail vérifié et nom) uniquement pour vous authentifier et créer ou lier votre compte Bidvera selon nos règles de compte.",
      "Votre usage de Google est également régi par les conditions et la politique de confidentialité de Google. Bidvera ne reçoit pas votre mot de passe Google et n’expose pas les secrets client Google aux navigateurs.",
      "Vous pouvez révoquer l’accès Google dans les paramètres des applications tierces de votre compte Google ; un autre mode de connexion à Bidvera pourra alors être nécessaire s’il est disponible.",
    ],
  },
  {
    id: "sharing",
    title: "9. Partage et prestataires",
    paragraphs: [
      "Nous ne vendons pas de données personnelles. Nous les partageons uniquement avec les catégories de destinataires nécessaires pour exploiter Bidvera, notamment :",
    ],
    bullets: [
      "Prestataires d’hébergement et d’infrastructure (application, bases de données, stockage de fichiers).",
      "Prestataires d’envoi d’e-mails transactionnels.",
      "Prestataires d’authentification et de protection anti-bot (par exemple Google OAuth et Cloudflare Turnstile lorsqu’ils sont activés).",
      "Processeurs de paiement pour les abonnements et factures (par exemple PayPal et, si activé, Stripe).",
      "Prestataires d’IA / de modèles utilisés pour générer les résultats demandés.",
      "Conseillers professionnels ou autorités lorsque la loi l’exige ou pour protéger les droits et la sécurité.",
    ],
  },
  {
    id: "transfers",
    title: "10. Transferts internationaux et hébergement",
    paragraphs: [
      PENDING.hostingRegions,
      PENDING.transferSafeguards,
    ],
  },
  {
    id: "retention",
    title: "11. Conservation",
    paragraphs: [
      "Nous conservons les données personnelles aussi longtemps que nécessaire pour fournir le service, maintenir les comptes et abonnements, répondre aux besoins de sécurité et d’audit, résoudre les litiges et respecter les obligations légales.",
      "Les durées exactes dépendent de la catégorie de données, du statut du compte et des exigences légales. Bidvera ne publie pas dans cette Politique un calendrier unique de suppression. En cas de clôture de compte ou de demande de suppression, nous traiterons la demande conformément au droit applicable et à nos procédures opérationnelles alors en vigueur — ce qui peut inclure la conservation de certains enregistrements lorsque la loi l’exige.",
      "Les sauvegardes et copies de reprise après sinistre peuvent subsister pendant une période limitée après la suppression principale.",
    ],
  },
  {
    id: "security",
    title: "12. Sécurité",
    paragraphs: [
      "Nous appliquons des mesures administratives, techniques et organisationnelles destinées à protéger les données personnelles, notamment le transport chiffré lorsqu’il est configuré, des identifiants hachés, des contrôles d’accès, la gestion des sessions, la limitation de débit et la journalisation d’audit.",
      "Aucun mode de transmission ou de stockage n’est totalement sûr. Nous ne publions pas dans cette Politique de schémas d’infrastructure interne, de secrets, de chemins d’administration ni d’autres détails d’implémentation sensibles.",
    ],
  },
  {
    id: "rights",
    title: "13. Vos droits",
    paragraphs: [
      "Selon le droit applicable (y compris, le cas échéant, la loi marocaine 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel, et éventuellement d’autres régimes tels que le RGPD s’ils s’appliquent à votre situation), vous pouvez disposer de droits pour :",
    ],
    bullets: [
      "Accéder aux données personnelles que nous détenons à votre sujet.",
      "Demander la correction de données inexactes.",
      "Demander l’effacement, la limitation ou l’opposition, le cas échéant.",
      "La portabilité des données, le cas échéant.",
      "Retirer votre consentement lorsque le traitement est fondé sur le consentement.",
      "Introduire une réclamation auprès d’une autorité de contrôle compétente.",
    ],
  },
  {
    id: "morocco-cndp",
    title: "14. Maroc (loi 09-08) et CNDP",
    paragraphs: [
      "Si Bidvera traite des données personnelles dans des circonstances soumises à la loi marocaine 09-08, des exigences supplémentaires peuvent s’appliquer, notamment les principes de finalité, de proportionnalité, de sécurité et les droits d’accès et de rectification, ainsi que d’éventuelles formalités de notification ou d’autorisation auprès de la Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP).",
      PENDING.cndpStatus,
    ],
  },
  {
    id: "cookies",
    title: "15. Cookies et technologies similaires",
    paragraphs: [
      "Bidvera utilise des cookies essentiels et des technologies similaires nécessaires au fonctionnement du service :",
    ],
    bullets: [
      "Cookies d’authentification/session (par exemple le cookie de session Bidvera) pour vous maintenir connecté de façon sécurisée.",
      "Cookies temporaires d’état OAuth pendant la connexion Google pour se protéger contre le CSRF et terminer le flux de connexion.",
      "Cookies de préférence de langue pour que l’interface mémorise votre choix.",
      "Cookies de session Super Admin sur les surfaces d’administration (non utilisés pour la navigation client ordinaire).",
    ],
  },
  {
    id: "cookies-other",
    title: "15.1 Autre stockage local et défis de tiers",
    paragraphs: [
      "La préférence de thème peut être stockée dans le stockage local du navigateur (ce n’est pas un cookie).",
      "Lorsque la protection anti-bot est activée, Cloudflare Turnstile peut définir ou lire des technologies contrôlées par Cloudflare pour vérifier qu’une requête est humaine.",
      "Nous n’affirmons pas que Bidvera exploite actuellement une suite de cookies d’analytique marketing ni une bannière de consentement. Si des cookies non essentiels d’analytique ou de publicité sont introduits plus tard, cette Politique et l’interface de consentement requise seront mises à jour.",
    ],
  },
  {
    id: "children",
    title: "16. Vie privée des mineurs",
    paragraphs: [
      "Bidvera est un service professionnel destiné aux organisations. Il n’est pas destiné aux enfants. Nous ne collectons pas sciemment de données personnelles d’enfants. Si vous pensez qu’un enfant a fourni des données, contactez-nous afin que nous prenions les mesures appropriées.",
    ],
  },
  {
    id: "third-parties",
    title: "17. Liens et services de tiers",
    paragraphs: [
      "Le site ou l’application peuvent renvoyer vers des sites tiers ou intégrer des services tiers (par exemple des vidéos ou des pages de paiement). Leurs pratiques de confidentialité sont régies par leurs propres politiques. Bidvera n’est pas responsable des contenus ou pratiques de tiers que nous ne contrôlons pas.",
    ],
  },
  {
    id: "changes",
    title: "18. Modifications de la présente Politique",
    paragraphs: [
      "Nous pouvons mettre à jour cette Politique de confidentialité. La date d’entrée en vigueur / de dernière mise à jour en haut de page changera lors de la publication d’une nouvelle version. Les changements importants peuvent aussi être communiqués via le produit ou par e-mail le cas échéant.",
    ],
  },
];
