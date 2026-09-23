import { getLegalPendingCopy } from "./pending";
import type { LegalSection } from "./types";

const PENDING = getLegalPendingCopy("es");

export const privacyPolicySectionsEs: LegalSection[] = [
  {
    id: "introduction",
    title: "1. Introducción y ámbito",
    paragraphs: [
      "Esta Política de privacidad explica cómo Bidvera («Bidvera», «nosotros» o «nuestro») trata datos personales cuando visita getbidvera.com, crea una cuenta o usa la plataforma de software como servicio Bidvera.",
      "Bidvera ayuda a los equipos empresariales a gestionar la preparación de la empresa, el cumplimiento documental, la cualificación de proveedores, las evidencias, las solicitudes de clientes, los cuestionarios, los calendarios, el apoyo a decisiones y funciones relacionadas del espacio de trabajo. Algunos módulos aparecen solo si están habilitados para su suscripción u organización.",
      "Esta Política se aplica a los datos personales tratados a través de nuestros sitios web, la aplicación autenticada y los canales de soporte relacionados. No cubre sitios o servicios de terceros que no controlamos.",
      "Este documento es informativo y no constituye asesoramiento jurídico. El cumplimiento final de su organización debe ser revisado por un abogado cualificado.",
    ],
  },
  {
    id: "controller",
    title: "2. Responsable del tratamiento",
    paragraphs: [
      PENDING.controllerIdentity,
      PENDING.registeredAddress,
      PENDING.privacyContact,
      PENDING.dataProtectionContact,
    ],
  },
  {
    id: "categories",
    title: "3. Categorías de datos personales que tratamos",
    paragraphs: [
      "Según cómo use Bidvera, podemos tratar las siguientes categorías. Solo recopilamos lo necesario para prestar el servicio que solicita.",
    ],
    bullets: [
      "Datos de cuenta e identidad: nombre, correo electrónico, rol en un espacio de trabajo, estado de incorporación e información de perfil que usted facilita (incluidas imágenes de avatar opcionales).",
      "Datos de autenticación: credenciales de contraseña (almacenadas como hashes irreversibles si usa correo/contraseña), identificadores de sesión y huellas de dispositivo usadas por seguridad.",
      "Datos de inicio de sesión con Google (cuando está habilitado): identificador de cuenta de Google, correo verificado y nombre/foto que Google devuelve para autenticar. No recibimos ni almacenamos su contraseña de Google.",
      "Datos de empresa / espacio de trabajo: nombre de la empresa, campos de perfil, país, tamaño y otros atributos empresariales que introduce para las funciones de preparación y colaboración.",
      "Documentos y contenido de trabajo: paquetes de licitaciones, documentos de cumplimiento, evidencias de cualificación, materiales de cuestionarios, archivos de solicitudes de clientes y metadatos necesarios para las funciones que usa.",
      "Datos de facturación: metadatos de suscripción y plan, referencias del proveedor de pago, facturas/registros de pago que Bidvera mantiene y contexto de contacto de facturación. Los datos de tarjeta o credenciales de PayPal los gestiona el proveedor de pago; Bidvera no está diseñada para almacenar números completos de tarjeta.",
      "Comunicaciones de soporte y operación: mensajes y correos de verificación, restablecimiento de contraseña, alertas y atención al cliente.",
      "Datos técnicos y de seguridad: dirección IP (a menudo almacenada de forma cifrada/hash para seguridad/auditoría), agente de usuario, marcas de tiempo, señales de limitación de tasa y prevención de abusos, y registros de la aplicación.",
      "Cookies y tecnologías similares: cookies de sesión, cookies de idioma, cookies temporales de estado OAuth y almacenamiento local del navegador para el tema (véase Cookies).",
    ],
  },
  {
    id: "sources",
    title: "4. Fuentes de los datos",
    paragraphs: [
      "Obtenemos datos personales de: (a) usted o su organización al registrarse, completar la incorporación, cargar contenido o configurar ajustes; (b) proveedores de autenticación como Google si elige iniciar sesión con Google; (c) proveedores de pago para el estado de suscripción y eventos de pago; (d) sistemas automáticos que generan registros y señales de seguridad al usar la plataforma; y (e) proveedores de correo y protección antibot que envían mensajes o verifican interacciones humanas cuando están habilitados.",
    ],
  },
  {
    id: "purposes",
    title: "5. Finalidades del tratamiento",
    paragraphs: [
      "Tratamos datos personales para:",
    ],
    bullets: [
      "Crear y administrar cuentas, autenticar usuarios, mantener sesiones y completar la incorporación.",
      "Prestar las funciones de Bidvera a las que tiene derecho (por ejemplo, cumplimiento documental, cualificación de proveedores, calendario de licitaciones, solicitudes de clientes, asistencia de cuestionarios, memoria de decisiones, flujo de trabajo en equipo, alertas inteligentes, perfil de empresa y herramientas relacionadas).",
      "Procesar documentos cargados y datos estructurados para generar los análisis, listas, borradores, recordatorios u otras salidas que solicita.",
      "Operar facturación, pruebas, derechos de plan e integraciones de pago.",
      "Enviar correo transaccional (verificación, restablecimiento de contraseña, alertas) y responder a solicitudes de soporte.",
      "Proteger el servicio: prevenir abusos, aplicar límites de tasa, detectar fraude o acceso no autorizado y mantener pistas de auditoría.",
      "Mejorar la fiabilidad y la experiencia mediante métricas operativas y comentarios, sin afirmar usos secundarios no verificados.",
      "Cumplir obligaciones legales aplicables y responder a solicitudes lícitas.",
    ],
  },
  {
    id: "legal-bases",
    title: "6. Bases jurídicas",
    paragraphs: [
      "Cuando las leyes de protección de datos exigen una base jurídica, solemos basarnos en una o varias de las siguientes, según la actividad y su ubicación:",
    ],
    bullets: [
      "Ejecución de un contrato — para prestar el servicio Bidvera que usted o su organización solicitan.",
      "Intereses legítimos — por ejemplo, asegurar la plataforma, prevenir abusos y mejorar la fiabilidad, ponderados frente a sus derechos.",
      "Consentimiento — cuando se requiera (por ejemplo, ciertos tratamientos opcionales o marketing, si se ofrecen y se consienten).",
      "Obligaciones legales — cuando el tratamiento sea necesario para cumplir la ley aplicable.",
    ],
  },
  {
    id: "ai-documents",
    title: "7. Tratamiento con IA y documentos cargados",
    paragraphs: [
      "Bidvera incluye funciones que usan inteligencia artificial y tratamiento automatizado para ayudarle a revisar documentos, extraer información, redactar respuestas de cuestionarios, apoyar decisiones o asistir en flujos relacionados.",
      "Cuando carga documentos de licitación, contratación, cumplimiento o de negocio, ese contenido se trata para prestar la función solicitada (por ejemplo, análisis, seguimiento de cumplimiento, asistencia de cuestionarios o colaboración). Las salidas pueden ser incompletas, inexactas o inadecuadas para una decisión concreta de contratación; usted sigue siendo responsable de verificarlas de forma independiente.",
      "Esta Política no afirma que los documentos del cliente nunca se usen para entrenar modelos, nunca sean revisados por personas o se eliminen automáticamente tras un plazo fijo, salvo que exista un compromiso escrito distinto o un control técnico verificado para su cuenta. Consulte a su contacto de Bidvera o a un abogado si necesita condiciones contractuales de tratamiento adicionales.",
      "Los proveedores que impulsan las funciones de IA pueden tratar indicaciones, documentos o texto derivado para generar respuestas, sujetos a nuestros acuerdos con esos proveedores y a la ley aplicable.",
    ],
  },
  {
    id: "google-oauth",
    title: "8. Inicio de sesión con Google",
    paragraphs: [
      "Si el inicio de sesión con Google está habilitado en Bidvera y usted lo elige, recibimos información de identidad de Google (como un identificador estable de usuario de Google, correo verificado y nombre) únicamente para autenticarle y crear o vincular su cuenta Bidvera según nuestras reglas de cuenta.",
      "El uso de Google también se rige por los términos y la política de privacidad de Google. Bidvera no recibe su contraseña de Google ni expone secretos de cliente de Google a los navegadores.",
      "Puede desconectar el acceso de Google en la configuración de aplicaciones de terceros de su cuenta de Google; después puede necesitar otro método de acceso a Bidvera si está disponible.",
    ],
  },
  {
    id: "sharing",
    title: "9. Compartir datos y proveedores de servicios",
    paragraphs: [
      "No vendemos datos personales. Solo los compartimos con categorías de destinatarios necesarias para operar Bidvera, entre ellas:",
    ],
    bullets: [
      "Proveedores de alojamiento e infraestructura (alojamiento de la aplicación, bases de datos, almacenamiento de archivos).",
      "Proveedores de envío de correo transaccional.",
      "Proveedores de autenticación y protección antibot (por ejemplo, Google OAuth y Cloudflare Turnstile cuando están habilitados).",
      "Procesadores de pago para suscripciones y facturas (por ejemplo, PayPal y, si está habilitado, Stripe).",
      "Proveedores de IA / modelos usados para generar las salidas solicitadas.",
      "Asesores profesionales o autoridades cuando lo exija la ley o para proteger derechos y seguridad.",
    ],
  },
  {
    id: "transfers",
    title: "10. Transferencias internacionales y alojamiento",
    paragraphs: [
      PENDING.hostingRegions,
      PENDING.transferSafeguards,
    ],
  },
  {
    id: "retention",
    title: "11. Conservación",
    paragraphs: [
      "Conservamos los datos personales el tiempo necesario para prestar el servicio, mantener cuentas y suscripciones, cubrir necesidades de seguridad y auditoría, resolver disputas y cumplir obligaciones legales.",
      "Los plazos exactos dependen de la categoría de datos, el estado de la cuenta y los requisitos legales. Bidvera no publica en esta Política un calendario único de eliminación. Si cierra una cuenta o solicita la eliminación, trataremos la solicitud conforme a la ley aplicable y a nuestros procedimientos operativos vigentes, lo que puede incluir la conservación de registros limitados cuando sea legalmente obligatorio.",
      "Las copias de seguridad y de recuperación ante desastres pueden persistir un tiempo limitado después de la eliminación principal.",
    ],
  },
  {
    id: "security",
    title: "12. Seguridad",
    paragraphs: [
      "Aplicamos medidas administrativas, técnicas y organizativas diseñadas para proteger los datos personales, incluido el transporte cifrado cuando está configurado, credenciales con hash, controles de acceso, gestión de sesiones, limitación de tasa y registro de auditoría.",
      "Ningún método de transmisión o almacenamiento es completamente seguro. No publicamos en esta Política diagramas de infraestructura interna, valores secretos, rutas de administración ni otros detalles sensibles de implementación.",
    ],
  },
  {
    id: "rights",
    title: "13. Sus derechos",
    paragraphs: [
      "Según la ley aplicable (incluida, cuando proceda, la Ley marroquí 09-08 relativa a la protección de las personas físicas frente al tratamiento de datos de carácter personal, y potencialmente otros regímenes como el RGPD si se aplican a su situación), puede tener derecho a:",
    ],
    bullets: [
      "Acceder a los datos personales que conservamos sobre usted.",
      "Solicitar la corrección de datos inexactos.",
      "Solicitar la eliminación, limitación u oposición, cuando proceda.",
      "La portabilidad de los datos, cuando proceda.",
      "Retirar el consentimiento cuando el tratamiento se base en el consentimiento.",
      "Presentar una reclamación ante una autoridad de control competente.",
    ],
  },
  {
    id: "morocco-cndp",
    title: "14. Marruecos (Ley 09-08) y CNDP",
    paragraphs: [
      "Si Bidvera trata datos personales en circunstancias sujetas a la Ley marroquí 09-08, pueden aplicarse requisitos adicionales, incluidos los principios de limitación de finalidad, proporcionalidad, seguridad y derechos de acceso y rectificación, así como posibles formalidades de notificación o autorización ante la Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP).",
      PENDING.cndpStatus,
    ],
  },
  {
    id: "cookies",
    title: "15. Cookies y tecnologías similares",
    paragraphs: [
      "Bidvera usa cookies esenciales y tecnologías similares necesarias para que el servicio funcione:",
    ],
    bullets: [
      "Cookies de autenticación/sesión (por ejemplo, la cookie de sesión de Bidvera) para mantenerle conectado de forma segura.",
      "Cookies temporales de estado OAuth durante el inicio de sesión con Google para proteger frente a CSRF y completar el flujo de acceso.",
      "Cookies de preferencia de idioma para que la interfaz recuerde su idioma.",
      "Cookies de sesión de Super Admin en superficies administrativas (no se usan en la navegación ordinaria del cliente).",
    ],
  },
  {
    id: "cookies-other",
    title: "15.1 Otro almacenamiento local y retos de terceros",
    paragraphs: [
      "La preferencia de tema puede guardarse en el almacenamiento local del navegador (no es una cookie).",
      "Cuando la protección antibot está habilitada, Cloudflare Turnstile puede establecer o leer tecnologías controladas por Cloudflare para verificar que una solicitud es humana.",
      "No afirmamos que Bidvera opere actualmente un conjunto de cookies de analítica de marketing ni un banner de consentimiento de cookies. Si se introducen cookies no esenciales de analítica o publicidad, se actualizarán esta Política y la interfaz de consentimiento requerida.",
    ],
  },
  {
    id: "children",
    title: "16. Privacidad de los menores",
    paragraphs: [
      "Bidvera es un servicio empresarial dirigido a organizaciones y profesionales. No está destinado a menores. No recopilamos a sabiendas datos personales de menores. Si cree que un menor ha facilitado datos, contáctenos para que podamos adoptar las medidas adecuadas.",
    ],
  },
  {
    id: "third-parties",
    title: "17. Enlaces y servicios de terceros",
    paragraphs: [
      "El sitio o la aplicación pueden enlazar a sitios de terceros o incrustar servicios de terceros (por ejemplo, vídeos o páginas de pago). Sus prácticas de privacidad se rigen por sus propias políticas. Bidvera no es responsable del contenido o las prácticas de terceros que no controlamos.",
    ],
  },
  {
    id: "changes",
    title: "18. Cambios de esta Política",
    paragraphs: [
      "Podemos actualizar esta Política de privacidad periódicamente. La fecha de entrada en vigor / última actualización de esta página cambiará cuando se publique una nueva versión. Los cambios materiales también pueden comunicarse a través del producto o por correo cuando proceda.",
    ],
  },
];
