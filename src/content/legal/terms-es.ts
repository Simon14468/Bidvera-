import { getLegalPendingCopy } from "./pending";
import type { LegalSection } from "./types";

const PENDING = getLegalPendingCopy("es");

export const termsOfServiceSectionsEs: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introducción, acuerdo y ámbito",
    paragraphs: [
      "Estos Términos del servicio («Términos») rigen el acceso y el uso de los sitios web y la plataforma de software como servicio de Bidvera (el «Servicio»).",
      "Al crear una cuenta, aceptar estos Términos o usar el Servicio, usted acepta estos Términos y nuestra Política de privacidad. Si usa Bidvera en nombre de una empresa, declara que tiene autoridad para vincular a esa empresa.",
      "Si no está de acuerdo, no use el Servicio.",
      "Estos Términos son un resumen contractual para usuarios de Bidvera. No sustituyen el asesoramiento de un abogado cualificado.",
    ],
  },
  {
    id: "definitions",
    title: "2. Definiciones",
    paragraphs: ["En estos Términos:"],
    bullets: [
      PENDING.operatorIdentity,
      "«Plataforma» o «Servicio» significa la aplicación web Bidvera, las API relacionadas y los sitios asociados.",
      "«Usuario» significa una persona que accede al Servicio.",
      "«Cliente» significa la empresa u organización que posee o administra un espacio de trabajo y es responsable de sus Usuarios.",
      "«Empresa» o «espacio de trabajo» significa una cuenta de organización (inquilino) en Bidvera.",
      "«Contenido» significa datos, textos, archivos y materiales enviados o generados en el Servicio.",
      "«Documentos» significa archivos que usted carga (por ejemplo, licitaciones, certificados, cuestionarios o materiales de solicitudes de clientes).",
      "«Salidas» significa análisis, borradores, puntuaciones, recomendaciones, recordatorios u otros resultados producidos por las funciones de Bidvera, incluidas las asistidas por IA.",
      "«Suscripción» significa un plan de pago o gratuito/de prueba que controla el acceso a módulos y límites.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Elegibilidad y autoridad",
    paragraphs: [
      "Debe poder celebrar un contrato vinculante conforme a la ley aplicable y usar Bidvera solo con fines empresariales lícitos. El Servicio está destinado a uso organizativo y profesional, no a menores.",
      "Si invita a compañeros, confirma que está autorizado a hacerlo en nombre de su organización.",
    ],
  },
  {
    id: "accounts",
    title: "4. Cuentas, registro y seguridad",
    paragraphs: [
      "Debe facilitar información de cuenta precisa y mantenerla actualizada. Es responsable de proteger las credenciales y de la actividad de su cuenta.",
      "Notifíquenos de inmediato cualquier acceso no autorizado. Bidvera puede exigir verificación de correo, comprobaciones antibot, límites de tasa y otros controles de seguridad.",
      "Si usa el inicio de sesión con Google, debe mantener segura su cuenta de Google; Bidvera se basa en las afirmaciones de autenticación de Google para ese método.",
    ],
  },
  {
    id: "workspaces",
    title: "5. Espacios de trabajo, roles y administradores",
    paragraphs: [
      "Bidvera organiza los datos por espacio de trabajo de empresa. Los propietarios y administradores pueden gestionar ajustes, plazas, facturación (cuando esté permitido) y el acceso de su espacio.",
      "El Cliente es responsable de configurar los roles adecuadamente, del cumplimiento de estos Términos por parte de los Usuarios y del Contenido que envíen.",
      "Las herramientas de Super Admin u operador usadas por el personal de Bidvera (si las hay) son distintas de la administración del espacio del Cliente y se rigen por controles internos de Bidvera.",
    ],
  },
  {
    id: "services",
    title: "6. Descripción del Servicio",
    paragraphs: [
      "Bidvera ofrece software de inteligencia empresarial y preparación para la contratación. Según su Suscripción y los indicadores de funciones, los módulos pueden incluir (sin limitación): gestión de perfil de empresa; cumplimiento documental y caducidades; cualificación de proveedores; herramientas de evidencia; gestión de solicitudes de clientes; asistencia de cuestionarios; calendario de licitaciones y recordatorios; memoria de decisiones; flujo de trabajo de equipo; alertas inteligentes; facturación y planes; y un asistente de IA para preguntas sobre Bidvera.",
      "Algunas capacidades que existen en el código pueden no estar disponibles comercialmente, estar desactivadas de forma global o limitarse a pruebas internas/administrativas. Bidvera no promete que cada módulo técnico se venda o se habilite para todos los Clientes.",
      "Las capacidades de emparejamiento/oportunidad o de estilo análisis de licitaciones, si están presentes en su entorno, se prestan solo cuando están habilitadas para su cuenta y no deben tratarse como garantía de calidad de la oportunidad ni de adjudicación.",
    ],
  },
  {
    id: "ai-limitations",
    title: "7. Contenido generado por IA y limitaciones",
    paragraphs: [
      "Partes del Servicio usan inteligencia artificial y tratamiento automatizado. Las Salidas pueden ser incompletas, inexactas, desactualizadas, sesgadas o inadecuadas para su situación.",
      "Debe verificar de forma independiente los requisitos de licitación, la elegibilidad, los plazos, los cálculos, las condiciones jurídicas y comerciales y cualquier decisión de contratación. Bidvera no es un despacho de abogados, autoridad de contratación, auditor ni asesor financiero, y no sustituye el asesoramiento profesional.",
      "Usted es el único responsable de las ofertas, presentaciones y decisiones empresariales tomadas usando el Servicio.",
    ],
  },
  {
    id: "no-guarantee",
    title: "8. Sin garantía de resultados",
    paragraphs: [
      "Bidvera no garantiza que gane licitaciones, se cualifique para oportunidades, cumpla requisitos del comprador, obtenga un resultado comercial, ni que el Servicio esté libre de errores o interrupciones.",
      "La disponibilidad, el conjunto de funciones y los límites de plan pueden cambiar a medida que mejoramos el producto.",
    ],
  },
  {
    id: "user-content",
    title: "9. Contenido del usuario y documentos cargados",
    paragraphs: [
      "Entre usted y Bidvera, usted (o su Cliente) conserva la titularidad de los Documentos y demás Contenido que envíe, en la medida en que los posea conforme a la ley aplicable.",
      "Concede a Bidvera una licencia limitada, mundial y no exclusiva para alojar, tratar, transmitir, mostrar y crear Salidas derivadas de su Contenido únicamente en la medida necesaria para operar, asegurar, mantener, dar soporte y prestar el Servicio (incluidos subencargados como alojamiento, correo, pago e IA).",
      "Bidvera no reclama la titularidad de sus documentos de licitación o de negocio cargados.",
      "Declara que tiene todos los derechos necesarios para enviar Contenido y que ello no infringe la ley ni derechos de terceros.",
    ],
  },
  {
    id: "prohibited",
    title: "10. Responsabilidades y usos prohibidos",
    paragraphs: ["Usted se compromete a no:"],
    bullets: [
      "Usar el Servicio de forma ilícita o para actividad fraudulenta de contratación.",
      "Infringir derechos de propiedad intelectual o de privacidad.",
      "Cargar malware o intentar interrumpir o sondear el Servicio.",
      "Eludir autenticación, derechos, límites de tasa o controles de seguridad.",
      "Hacer scraping, exportar masivamente o aplicar ingeniería inversa al Servicio salvo lo permitido por ley imperativa.",
      "Compartir credenciales o permitir acceso no autorizado a un espacio de trabajo.",
      "Presentar Salidas de IA como asesoramiento jurídico o de contratación verificado.",
      "Enviar Contenido que no esté autorizado a compartir (incluidos materiales confidenciales de terceros sin derechos).",
    ],
  },
  {
    id: "ip",
    title: "11. Propiedad intelectual",
    paragraphs: [
      "Bidvera y sus licenciantes son titulares del software del Servicio, la marca, la interfaz, la documentación y materiales relacionados. Estos Términos no le ceden la PI de Bidvera.",
      "Su Contenido sigue siendo suyo según lo anterior. Las marcas de terceros (por ejemplo, Google o marcas de pago) pertenecen a sus titulares.",
    ],
  },
  {
    id: "privacy",
    title: "12. Privacidad y tratamiento de datos",
    paragraphs: [
      "Los datos personales se tratan según nuestra Política de privacidad (enlazada desde esta página y el pie del sitio). La Política explica categorías de datos, finalidades, cookies y canales de contacto.",
      "Si necesita un acuerdo de tratamiento de datos o una lista de subencargados para contratación empresarial, solicítelo a Bidvera por escrito.",
    ],
  },
  {
    id: "billing",
    title: "13. Suscripciones, pruebas y facturación",
    paragraphs: [
      "Bidvera ofrece planes que pueden incluir espacio de trabajo gratuito, prueba y suscripciones de pago. Los derechos (módulos, plazas, límites de análisis o uso) los controlan su plan activo y la configuración de administración.",
      "El pago puede procesarlo un proveedor tercero (como PayPal y, si está habilitado, Stripe). Sus términos también se aplican al procesamiento de pagos.",
      "Los precios, impuestos, intervalos de renovación, periodos de gracia y promociones son los mostrados en el pago o en la interfaz de facturación en el momento de la compra, o los acordados por escrito. Este documento no inventa precios ni tipos impositivos fijos.",
      "Los pagos fallidos pueden dar lugar a impago, acceso restringido o suspensión según el ciclo de facturación de su cuenta.",
      "Las mejoras, degradaciones y cancelaciones se gestionan en las interfaces de facturación o contactando con el soporte de Bidvera, sujeto a las reglas de plan entonces vigentes.",
    ],
  },
  {
    id: "refunds",
    title: "14. Reembolsos y cancelación",
    paragraphs: [
      PENDING.refundPolicy,
      "Cancelar una Suscripción suele detener renovaciones futuras; no elimina automáticamente su Contenido salvo solicitud y tramitación aparte.",
    ],
  },
  {
    id: "availability",
    title: "15. Disponibilidad, cambios, suspensión y mantenimiento",
    paragraphs: [
      "Procuramos mantener el Servicio disponible, pero no garantizamos un tiempo de actividad ininterrumpido. Podemos realizar mantenimiento, desplegar actualizaciones o modificar funciones.",
      "Podemos suspender o limitar el acceso para proteger la seguridad, afrontar abusos, hacer cumplir estos Términos, cumplir la ley o gestionar cuentas impagadas.",
    ],
  },
  {
    id: "termination",
    title: "16. Terminación y efectos",
    paragraphs: [
      "Puede dejar de usar el Servicio en cualquier momento. Podemos terminar o suspender el acceso por incumplimiento grave, uso ilícito o según lo permitido por estos Términos.",
      "Tras la terminación, cesa su derecho de acceso. La conservación o eliminación del Contenido sigue nuestra Política de privacidad, las copias de seguridad y las obligaciones legales. No prometemos la eliminación inmediata e irreversible de todas las copias salvo acuerdo separado e implementación técnica.",
    ],
  },
  {
    id: "confidentiality",
    title: "17. Confidencialidad",
    paragraphs: [
      "Cada parte puede recibir información empresarial confidencial de la otra. El receptor usará un cuidado razonable para protegerla y usarla solo para cumplir estos Términos, salvo información pública, desarrollada de forma independiente o cuya revelación exija la ley.",
      "Los Documentos del Cliente se tratan como información confidencial del Cliente, sujeta a la licencia de tratamiento de la sección 9 y a la Política de privacidad.",
    ],
  },
  {
    id: "third-party",
    title: "18. Servicios de terceros",
    paragraphs: [
      "El Servicio puede integrar terceros para inicio de sesión, pagos, correo, alojamiento, protección antibot e inferencia de IA. Su uso de esos servicios puede estar sujeto a sus términos. Bidvera no es responsable de interrupciones o cambios de política de terceros fuera de nuestro control.",
    ],
  },
  {
    id: "disclaimers",
    title: "19. Exenciones de garantía",
    paragraphs: [
      "EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY APLICABLE, EL SERVICIO Y LAS SALIDAS SE PROPORCIONAN «TAL CUAL» Y «SEGÚN DISPONIBILIDAD», SIN GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN PARTICULAR O NO INFRACCIÓN, Y SIN GARANTÍA DE QUE LAS SALIDAS SEAN CORRECTAS O COMPLETAS.",
      "Nada de estos Términos excluye responsabilidad que no pueda excluirse por ley imperativa.",
    ],
  },
  {
    id: "liability",
    title: "20. Limitación de responsabilidad",
    paragraphs: [
      "EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY APLICABLE, BIDVERA Y SUS PROVEEDORES NO SERÁN RESPONSABLES DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENCIALES O LUCRO CESANTE, NI DE OFERTAS PERDIDAS, NEGOCIO PERDIDO O RESULTADOS DE CONTRATACIÓN.",
      "EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY APLICABLE, LA RESPONSABILIDAD AGREGADA DE BIDVERA DERIVADA DE ESTOS TÉRMINOS O DEL SERVICIO SE LIMITA A LOS IMPORTES PAGADOS POR EL CLIENTE A BIDVERA POR EL SERVICIO EN LOS DOCE (12) MESES ANTERIORES A LA RECLAMACIÓN (O, SI NO HUBIERA, CIEN DÓLARES ESTADOUNIDENSES O EQUIVALENTE LOCAL).",
      PENDING.liabilityLimitsNote,
    ],
  },
  {
    id: "indemnity",
    title: "21. Indemnización",
    paragraphs: [
      "En la medida permitida por la ley, el Cliente defenderá e indemnizará a Bidvera frente a reclamaciones de terceros derivadas del Contenido del Cliente, del uso indebido del Servicio o de la violación de estos Términos o de la ley aplicable, salvo en la medida causada por dolo de Bidvera.",
      PENDING.indemnityScopeNote,
    ],
  },
  {
    id: "governing-law",
    title: "22. Ley aplicable y controversias",
    paragraphs: [
      PENDING.governingLaw,
      PENDING.governingLawProcess,
    ],
  },
  {
    id: "changes-terms",
    title: "23. Cambios de estos Términos",
    paragraphs: [
      "Podemos actualizar estos Términos periódicamente. La fecha de entrada en vigor / última actualización de esta página cambiará cuando se publique una nueva versión. El uso continuado tras esa fecha constituye aceptación de los Términos actualizados, salvo que la ley imperativa exija otro procedimiento.",
    ],
  },
  {
    id: "general",
    title: "24. General",
    paragraphs: [
      "Si una disposición es inaplicable, el resto permanece vigente. No exigir una disposición no es una renuncia. Estos Términos, junto con la Política de privacidad y cualquier pedido o términos de plan mostrados en el pago, constituyen el acuerdo íntegro sobre el Servicio y sustituyen entendimientos previos contradictorios sobre el mismo objeto.",
      "No puede ceder estos Términos sin nuestro consentimiento; nosotros podemos cederlos en una reorganización societaria o venta de activos. Ninguna parte es responsable de retrasos causados por eventos fuera de un control razonable (fuerza mayor).",
    ],
  },
];
