/**
 * Patch known English leftovers in es/zh/ar/fr core dictionaries.
 * Run: npx tsx scripts/patch-dict-leftovers.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "src/i18n/dictionaries.ts");
let src = readFileSync(path, "utf8");

type Patch = { from: string; to: Record<"es" | "zh" | "ar" | "fr", string> };

const patches: Patch[] = [
  {
    from: 'sectionCapabilities: "Capabilities"',
    to: {
      es: 'sectionCapabilities: "Capacidades"',
      zh: 'sectionCapabilities: "能力"',
      ar: 'sectionCapabilities: "القدرات"',
      fr: 'sectionCapabilities: "Capacités"',
    },
  },
  {
    from: 'sectionWorkspace: "Workspace"',
    to: {
      es: 'sectionWorkspace: "Espacio de trabajo"',
      zh: 'sectionWorkspace: "工作区"',
      ar: 'sectionWorkspace: "مساحة العمل"',
      fr: 'sectionWorkspace: "Espace de travail"',
    },
  },
  {
    from: 'sectionAccount: "Account"',
    to: {
      es: 'sectionAccount: "Cuenta"',
      zh: 'sectionAccount: "账户"',
      ar: 'sectionAccount: "الحساب"',
      fr: 'sectionAccount: "Compte"',
    },
  },
  {
    from: 'upcomingCalendarDeadlines: "Upcoming deadlines"',
    to: {
      es: 'upcomingCalendarDeadlines: "Próximos plazos"',
      zh: 'upcomingCalendarDeadlines: "即将到来的截止日期"',
      ar: 'upcomingCalendarDeadlines: "المواعيد القادمة"',
      fr: 'upcomingCalendarDeadlines: "Échéances à venir"',
    },
  },
  {
    from: 'upcomingCalendarEmpty: "No upcoming calendar deadlines yet."',
    to: {
      es: 'upcomingCalendarEmpty: "Aún no hay plazos próximos en el calendario."',
      zh: 'upcomingCalendarEmpty: "暂无即将到来的日历截止日期。"',
      ar: 'upcomingCalendarEmpty: "لا مواعيد تقويم قادمة بعد."',
      fr: 'upcomingCalendarEmpty: "Aucune échéance calendrier à venir pour le moment."',
    },
  },
  {
    from: 'addCalendarTender: "Add a calendar tender"',
    to: {
      es: 'addCalendarTender: "Añadir una licitación al calendario"',
      zh: 'addCalendarTender: "添加日历招标"',
      ar: 'addCalendarTender: "إضافة مناقصة إلى التقويم"',
      fr: 'addCalendarTender: "Ajouter un appel d’offres au calendrier"',
    },
  },
  {
    from: 'platformTitle: "What you can do in Bidvera"',
    to: {
      es: 'platformTitle: "Qué puedes hacer en Bidvera"',
      zh: 'platformTitle: "您可以在 Bidvera 中做什么"',
      ar: 'platformTitle: "ما يمكنك فعله في بيدفراء"',
      fr: 'platformTitle: "Ce que vous pouvez faire dans Bidvera"',
    },
  },
  {
    from: 'capabilityAnalysisDesc: "Upload packages and get go / no-go decisions."',
    to: {
      es: 'capabilityAnalysisDesc: "Sube paquetes y obtén decisiones go / no-go."',
      zh: 'capabilityAnalysisDesc: "上传标书包并获得继续/不继续的决策。"',
      ar: 'capabilityAnalysisDesc: "ارفع الحزم واحصل على قرارات متابعة / عدم متابعة."',
      fr: 'capabilityAnalysisDesc: "Téléversez des dossiers et obtenez des décisions go / no-go."',
    },
  },
  {
    from: 'capabilityComplianceDesc: "Track business documents and expiry reminders."',
    to: {
      es: 'capabilityComplianceDesc: "Controla documentos empresariales y recordatorios de caducidad."',
      zh: 'capabilityComplianceDesc: "跟踪业务文档与到期提醒。"',
      ar: 'capabilityComplianceDesc: "تتبّع مستندات العمل وتذكيرات انتهاء الصلاحية."',
      fr: 'capabilityComplianceDesc: "Suivez les documents métier et les rappels d’expiration."',
    },
  },
  {
    from: 'capabilityCalendarDesc: "Track opportunity deadlines and reminders."',
    to: {
      es: 'capabilityCalendarDesc: "Sigue plazos de oportunidades y recordatorios."',
      zh: 'capabilityCalendarDesc: "跟踪机会截止日期与提醒。"',
      ar: 'capabilityCalendarDesc: "تتبّع مواعيد الفرص والتذكيرات."',
      fr: 'capabilityCalendarDesc: "Suivez les échéances d’opportunités et les rappels."',
    },
  },
  {
    from: 'capabilityOpen: "Open"',
    to: {
      es: 'capabilityOpen: "Abrir"',
      zh: 'capabilityOpen: "打开"',
      ar: 'capabilityOpen: "فتح"',
      fr: 'capabilityOpen: "Ouvrir"',
    },
  },
  {
    from: 'capabilityGetStarted: "Get started"',
    to: {
      es: 'capabilityGetStarted: "Empezar"',
      zh: 'capabilityGetStarted: "开始"',
      ar: 'capabilityGetStarted: "ابدأ"',
      fr: 'capabilityGetStarted: "Commencer"',
    },
  },
  {
    from: 'capabilityUpgrade: "Upgrade to unlock"',
    to: {
      es: 'capabilityUpgrade: "Mejora el plan para desbloquear"',
      zh: 'capabilityUpgrade: "升级以解锁"',
      ar: 'capabilityUpgrade: "رقِّ الخطة لإلغاء القفل"',
      fr: 'capabilityUpgrade: "Passez à une offre supérieure pour débloquer"',
    },
  },
  {
    from: 'statusAnalyses: "{count} analyses"',
    to: {
      es: 'statusAnalyses: "{count} análisis"',
      zh: 'statusAnalyses: "{count} 次分析"',
      ar: 'statusAnalyses: "{count} تحليلات"',
      fr: 'statusAnalyses: "{count} analyses"',
    },
  },
  {
    from: 'statusDocuments: "{count} documents"',
    to: {
      es: 'statusDocuments: "{count} documentos"',
      zh: 'statusDocuments: "{count} 份文档"',
      ar: 'statusDocuments: "{count} مستندات"',
      fr: 'statusDocuments: "{count} documents"',
    },
  },
  {
    from: 'statusCompleteness: "{percent}% complete"',
    to: {
      es: 'statusCompleteness: "{percent}% completo"',
      zh: 'statusCompleteness: "完整度 {percent}%"',
      ar: 'statusCompleteness: "مكتمل بنسبة {percent}%"',
      fr: 'statusCompleteness: "{percent}% complété"',
    },
  },
  {
    from: 'statusDeadlines: "{count} upcoming"',
    to: {
      es: 'statusDeadlines: "{count} próximos"',
      zh: 'statusDeadlines: "{count} 个即将到来"',
      ar: 'statusDeadlines: "{count} قادمة"',
      fr: 'statusDeadlines: "{count} à venir"',
    },
  },
  {
    from: 'statusLocked: "Not on your current plan"',
    to: {
      es: 'statusLocked: "No incluido en tu plan actual"',
      zh: 'statusLocked: "不在当前套餐内"',
      ar: 'statusLocked: "غير مدرج في خطتك الحالية"',
      fr: 'statusLocked: "Non inclus dans votre offre actuelle"',
    },
  },
  {
    from: 'gettingStartedTitle: "Suggested next steps"',
    to: {
      es: 'gettingStartedTitle: "Próximos pasos sugeridos"',
      zh: 'gettingStartedTitle: "建议的下一步"',
      ar: 'gettingStartedTitle: "الخطوات التالية المقترحة"',
      fr: 'gettingStartedTitle: "Prochaines étapes suggérées"',
    },
  },
  {
    from: 'moduleRemindersTitle: "Module reminder schedules"',
    to: {
      es: 'moduleRemindersTitle: "Programas de recordatorios por módulo"',
      zh: 'moduleRemindersTitle: "模块提醒计划"',
      ar: 'moduleRemindersTitle: "جداول تذكير الوحدات"',
      fr: 'moduleRemindersTitle: "Planifications de rappels par module"',
    },
  },
  {
    from: 'moduleRemindersBody: "Document Compliance and Tender Calendar have their own reminder offsets."',
    to: {
      es: 'moduleRemindersBody: "Cumplimiento documental y Calendario tienen sus propios plazos de recordatorio."',
      zh: 'moduleRemindersBody: "文档合规与招标日历各自有提醒提前量。"',
      ar: 'moduleRemindersBody: "امتثال المستندات وتقويم المناقصات لهما إزاحات تذكير خاصة."',
      fr: 'moduleRemindersBody: "La conformité documentaire et le calendrier ont leurs propres décalages de rappel."',
    },
  },
  {
    from: 'complianceRemindersLink: "Document Compliance reminders"',
    to: {
      es: 'complianceRemindersLink: "Recordatorios de cumplimiento documental"',
      zh: 'complianceRemindersLink: "文档合规提醒"',
      ar: 'complianceRemindersLink: "تذكيرات امتثال المستندات"',
      fr: 'complianceRemindersLink: "Rappels de conformité documentaire"',
    },
  },
  {
    from: 'calendarRemindersLink: "Tender Calendar reminders"',
    to: {
      es: 'calendarRemindersLink: "Recordatorios del calendario"',
      zh: 'calendarRemindersLink: "招标日历提醒"',
      ar: 'calendarRemindersLink: "تذكيرات تقويم المناقصات"',
      fr: 'calendarRemindersLink: "Rappels du calendrier"',
    },
  },
];

function sliceLocale(name: string, next: string | null): { start: number; end: number } {
  const start = src.indexOf(`const ${name}: Dictionary`);
  if (start < 0) throw new Error(`missing ${name}`);
  const end = next
    ? src.indexOf(`const ${next}: Dictionary`)
    : src.indexOf("const dictionaries:");
  return { start, end };
}

const blocks: Array<{ locale: "es" | "zh" | "ar" | "fr"; next: string | null }> = [
  { locale: "es", next: "zh" },
  { locale: "zh", next: "ar" },
  { locale: "ar", next: "fr" },
  { locale: "fr", next: null },
];

let changed = 0;
for (const { locale, next } of blocks) {
  const { start, end } = sliceLocale(locale, next);
  let block = src.slice(start, end);
  for (const p of patches) {
    if (!block.includes(p.from)) continue;
    block = block.split(p.from).join(p.to[locale]);
    changed += 1;
  }
  src = src.slice(0, start) + block + src.slice(end);
}

writeFileSync(path, src);
console.log(JSON.stringify({ ok: true, replacements: changed }));
