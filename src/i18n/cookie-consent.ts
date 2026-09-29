import type { Locale } from "@/i18n/config";

export type CookieConsentCopy = {
  title: string;
  description: string;
  acceptAll: string;
  rejectAll: string;
  cookiesSettings: string;
  savePreferences: string;
  closeLabel: string;
  privacyPolicy: string;
  necessaryTitle: string;
  necessaryBody: string;
  necessaryAlwaysActive: string;
  analyticsTitle: string;
  analyticsBody: string;
  marketingTitle: string;
  marketingBody: string;
  settingsTitle: string;
  settingsDescription: string;
  manageCookies: string;
};

const en: CookieConsentCopy = {
  title: "We value your privacy",
  description:
    "We use cookies to enhance your browsing experience and analyze our traffic. By clicking “Accept All Cookies”, you consent to our use of cookies.",
  acceptAll: "Accept All Cookies",
  rejectAll: "Reject All",
  cookiesSettings: "Cookies Settings",
  savePreferences: "Save Preferences",
  closeLabel: "Close cookie notice",
  privacyPolicy: "Privacy Policy",
  necessaryTitle: "Necessary Cookies",
  necessaryBody:
    "These cookies are required for Bidvera to work — for example signing you in, securing the session, remembering your language, and completing OAuth login. They cannot be switched off.",
  necessaryAlwaysActive: "Always Active",
  analyticsTitle: "Analytics Cookies",
  analyticsBody:
    "These cookies help us understand how Bidvera is used so we can improve the product. They are only used if you turn them on.",
  marketingTitle: "Marketing Cookies",
  marketingBody:
    "These cookies may be used to measure campaigns or show relevant messages about Bidvera. They are only used if you turn them on.",
  settingsTitle: "Cookie settings",
  settingsDescription:
    "Choose which optional cookies Bidvera may use. Necessary cookies stay on so the service can function securely.",
  manageCookies: "Cookie settings",
};

const es: CookieConsentCopy = {
  title: "Valoramos su privacidad",
  description:
    "Usamos cookies para mejorar su experiencia y analizar el tráfico. Al hacer clic en “Aceptar todas las cookies”, consiente el uso de cookies.",
  acceptAll: "Aceptar todas las cookies",
  rejectAll: "Rechazar todas",
  cookiesSettings: "Configuración de cookies",
  savePreferences: "Guardar preferencias",
  closeLabel: "Cerrar aviso de cookies",
  privacyPolicy: "Política de privacidad",
  necessaryTitle: "Cookies necesarias",
  necessaryBody:
    "Estas cookies son imprescindibles para que Bidvera funcione: inicio de sesión, sesión segura, idioma y OAuth. No se pueden desactivar.",
  necessaryAlwaysActive: "Siempre activas",
  analyticsTitle: "Cookies de analítica",
  analyticsBody:
    "Nos ayudan a entender cómo se usa Bidvera para mejorar el producto. Solo se usan si las activa.",
  marketingTitle: "Cookies de marketing",
  marketingBody:
    "Pueden usarse para medir campañas o mostrar mensajes relevantes sobre Bidvera. Solo se usan si las activa.",
  settingsTitle: "Configuración de cookies",
  settingsDescription:
    "Elija qué cookies opcionales puede usar Bidvera. Las necesarias permanecen activas para que el servicio funcione de forma segura.",
  manageCookies: "Configuración de cookies",
};

const zh: CookieConsentCopy = {
  title: "我们重视您的隐私",
  description:
    "我们使用 Cookie 以改善浏览体验并分析流量。点击“接受全部 Cookie”，即表示您同意我们使用 Cookie。",
  acceptAll: "接受全部 Cookie",
  rejectAll: "全部拒绝",
  cookiesSettings: "Cookie 设置",
  savePreferences: "保存偏好",
  closeLabel: "关闭 Cookie 提示",
  privacyPolicy: "隐私政策",
  necessaryTitle: "必要 Cookie",
  necessaryBody:
    "这些 Cookie 是 Bidvera 运行所必需的，例如登录、安全会话、语言偏好以及 OAuth 登录。无法关闭。",
  necessaryAlwaysActive: "始终开启",
  analyticsTitle: "分析 Cookie",
  analyticsBody:
    "帮助我们了解 Bidvera 的使用情况以改进产品。仅在您开启后才会使用。",
  marketingTitle: "营销 Cookie",
  marketingBody:
    "可能用于衡量活动或展示与 Bidvera 相关的信息。仅在您开启后才会使用。",
  settingsTitle: "Cookie 设置",
  settingsDescription:
    "选择 Bidvera 可以使用的可选 Cookie。必要 Cookie 会保持开启，以确保服务安全运行。",
  manageCookies: "Cookie 设置",
};

const ar: CookieConsentCopy = {
  title: "نحن نقدّر خصوصيتك",
  description:
    "نستخدم ملفات تعريف الارتباط لتحسين تجربة التصفح وتحليل الزيارات. بالنقر على «قبول كل ملفات تعريف الارتباط»، فإنك توافق على استخدامها.",
  acceptAll: "قبول كل ملفات تعريف الارتباط",
  rejectAll: "رفض الكل",
  cookiesSettings: "إعدادات ملفات تعريف الارتباط",
  savePreferences: "حفظ التفضيلات",
  closeLabel: "إغلاق إشعار ملفات تعريف الارتباط",
  privacyPolicy: "سياسة الخصوصية",
  necessaryTitle: "ملفات تعريف الارتباط الضرورية",
  necessaryBody:
    "هذه الملفات ضرورية لعمل Bidvera — مثل تسجيل الدخول، وتأمين الجلسة، وتذكّر اللغة، وإكمال تسجيل الدخول عبر OAuth. لا يمكن إيقافها.",
  necessaryAlwaysActive: "نشطة دائمًا",
  analyticsTitle: "ملفات تعريف الارتباط التحليلية",
  analyticsBody:
    "تساعدنا على فهم كيفية استخدام Bidvera لتحسين المنتج. تُستخدم فقط إذا فعّلتها.",
  marketingTitle: "ملفات تعريف الارتباط التسويقية",
  marketingBody:
    "قد تُستخدم لقياس الحملات أو عرض رسائل ذات صلة بـ Bidvera. تُستخدم فقط إذا فعّلتها.",
  settingsTitle: "إعدادات ملفات تعريف الارتباط",
  settingsDescription:
    "اختر ملفات تعريف الارتباط الاختيارية التي قد يستخدمها Bidvera. تبقى الملفات الضرورية مفعّلة ليؤدي الخدمة عملها بأمان.",
  manageCookies: "إعدادات ملفات تعريف الارتباط",
};

const fr: CookieConsentCopy = {
  title: "Nous respectons votre vie privée",
  description:
    "Nous utilisons des cookies pour améliorer votre navigation et analyser notre trafic. En cliquant sur « Accepter tous les cookies », vous consentez à leur utilisation.",
  acceptAll: "Accepter tous les cookies",
  rejectAll: "Tout refuser",
  cookiesSettings: "Paramètres des cookies",
  savePreferences: "Enregistrer les préférences",
  closeLabel: "Fermer l’avis sur les cookies",
  privacyPolicy: "Politique de confidentialité",
  necessaryTitle: "Cookies nécessaires",
  necessaryBody:
    "Ces cookies sont indispensables au fonctionnement de Bidvera — connexion, session sécurisée, langue et OAuth. Ils ne peuvent pas être désactivés.",
  necessaryAlwaysActive: "Toujours actifs",
  analyticsTitle: "Cookies analytiques",
  analyticsBody:
    "Ils nous aident à comprendre l’usage de Bidvera pour améliorer le produit. Ils ne sont utilisés que si vous les activez.",
  marketingTitle: "Cookies marketing",
  marketingBody:
    "Ils peuvent servir à mesurer des campagnes ou afficher des messages pertinents sur Bidvera. Ils ne sont utilisés que si vous les activez.",
  settingsTitle: "Paramètres des cookies",
  settingsDescription:
    "Choisissez les cookies optionnels que Bidvera peut utiliser. Les cookies nécessaires restent actifs pour que le service fonctionne en toute sécurité.",
  manageCookies: "Paramètres des cookies",
};

const byLocale: Record<Locale, CookieConsentCopy> = {
  en,
  es,
  zh,
  ar,
  fr,
};

export function getCookieConsentCopy(locale: Locale): CookieConsentCopy {
  return byLocale[locale] ?? en;
}
