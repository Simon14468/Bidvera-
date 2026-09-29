import type { Locale } from "@/i18n/config";
import {
  COMPANY_INDUSTRY_IDS,
  type CompanyIndustryId,
  resolveCompanyIndustryId,
} from "@/config/company-industries";

export type CompanyIndustryLabels = Record<CompanyIndustryId, string>;

export type CompanyIndustryCopy = {
  placeholder: string;
  searchPlaceholder: string;
  empty: string;
  required: string;
  industries: CompanyIndustryLabels;
};

const enIndustries: CompanyIndustryLabels = {
  information_technology: "Information Technology",
  software_saas: "Software & SaaS",
  telecommunications: "Telecommunications",
  cybersecurity: "Cybersecurity",
  construction_engineering: "Construction & Engineering",
  architecture_design: "Architecture & Design",
  manufacturing: "Manufacturing",
  automotive: "Automotive",
  logistics_transportation: "Logistics & Transportation",
  energy_utilities: "Energy & Utilities",
  oil_gas_mining: "Oil, Gas & Mining",
  environmental_services: "Environmental Services",
  healthcare: "Healthcare",
  pharmaceuticals_biotechnology: "Pharmaceuticals & Biotechnology",
  agriculture_agribusiness: "Agriculture & Agribusiness",
  food_beverage: "Food & Beverage",
  retail_ecommerce: "Retail & E-commerce",
  real_estate_property: "Real Estate & Property",
  hospitality_tourism: "Hospitality & Tourism",
  finance_banking: "Finance & Banking",
  insurance: "Insurance",
  consulting_professional_services: "Consulting & Professional Services",
  legal_services: "Legal Services",
  marketing_advertising: "Marketing & Advertising",
  media_entertainment: "Media & Entertainment",
  education_training: "Education & Training",
  security_facilities_management: "Security & Facilities Management",
  government_public_sector: "Government & Public Sector",
  nonprofit_ngos: "Nonprofit & NGOs",
  wholesale_distribution: "Wholesale & Distribution",
  consumer_goods: "Consumer Goods",
  utilities_infrastructure: "Utilities & Infrastructure",
  scientific_research_services: "Scientific & Research Services",
};

const esIndustries: CompanyIndustryLabels = {
  information_technology: "Tecnologías de la información",
  software_saas: "Software y SaaS",
  telecommunications: "Telecomunicaciones",
  cybersecurity: "Ciberseguridad",
  construction_engineering: "Construcción e ingeniería",
  architecture_design: "Arquitectura y diseño",
  manufacturing: "Manufactura",
  automotive: "Automoción",
  logistics_transportation: "Logística y transporte",
  energy_utilities: "Energía y servicios públicos",
  oil_gas_mining: "Petróleo, gas y minería",
  environmental_services: "Servicios ambientales",
  healthcare: "Salud",
  pharmaceuticals_biotechnology: "Farmacéutica y biotecnología",
  agriculture_agribusiness: "Agricultura y agroindustria",
  food_beverage: "Alimentos y bebidas",
  retail_ecommerce: "Comercio minorista y comercio electrónico",
  real_estate_property: "Bienes raíces y propiedad",
  hospitality_tourism: "Hostelería y turismo",
  finance_banking: "Finanzas y banca",
  insurance: "Seguros",
  consulting_professional_services: "Consultoría y servicios profesionales",
  legal_services: "Servicios jurídicos",
  marketing_advertising: "Marketing y publicidad",
  media_entertainment: "Medios y entretenimiento",
  education_training: "Educación y formación",
  security_facilities_management: "Seguridad y gestión de instalaciones",
  government_public_sector: "Gobierno y sector público",
  nonprofit_ngos: "Sin fines de lucro y ONG",
  wholesale_distribution: "Mayoristas y distribución",
  consumer_goods: "Bienes de consumo",
  utilities_infrastructure: "Servicios públicos e infraestructura",
  scientific_research_services: "Servicios científicos e investigación",
};

const zhIndustries: CompanyIndustryLabels = {
  information_technology: "信息技术",
  software_saas: "软件与 SaaS",
  telecommunications: "电信",
  cybersecurity: "网络安全",
  construction_engineering: "建筑与工程",
  architecture_design: "建筑与设计",
  manufacturing: "制造业",
  automotive: "汽车",
  logistics_transportation: "物流与运输",
  energy_utilities: "能源与公用事业",
  oil_gas_mining: "石油、天然气与采矿",
  environmental_services: "环境服务",
  healthcare: "医疗健康",
  pharmaceuticals_biotechnology: "制药与生物技术",
  agriculture_agribusiness: "农业与涉农产业",
  food_beverage: "食品与饮料",
  retail_ecommerce: "零售与电子商务",
  real_estate_property: "房地产与物业",
  hospitality_tourism: "酒店与旅游",
  finance_banking: "金融与银行",
  insurance: "保险",
  consulting_professional_services: "咨询与专业服务",
  legal_services: "法律服务",
  marketing_advertising: "营销与广告",
  media_entertainment: "媒体与娱乐",
  education_training: "教育与培训",
  security_facilities_management: "安保与设施管理",
  government_public_sector: "政府与公共部门",
  nonprofit_ngos: "非营利组织与非政府组织",
  wholesale_distribution: "批发与分销",
  consumer_goods: "消费品",
  utilities_infrastructure: "公用事业与基础设施",
  scientific_research_services: "科研服务",
};

const arIndustries: CompanyIndustryLabels = {
  information_technology: "تقنية المعلومات",
  software_saas: "البرمجيات وSaaS",
  telecommunications: "الاتصالات",
  cybersecurity: "الأمن السيبراني",
  construction_engineering: "البناء والهندسة",
  architecture_design: "الهندسة المعمارية والتصميم",
  manufacturing: "التصنيع",
  automotive: "السيارات",
  logistics_transportation: "اللوجستيات والنقل",
  energy_utilities: "الطاقة والمرافق",
  oil_gas_mining: "النفط والغاز والتعدين",
  environmental_services: "الخدمات البيئية",
  healthcare: "الرعاية الصحية",
  pharmaceuticals_biotechnology: "الأدوية والتكنولوجيا الحيوية",
  agriculture_agribusiness: "الزراعة والأعمال الزراعية",
  food_beverage: "الأغذية والمشروبات",
  retail_ecommerce: "التجزئة والتجارة الإلكترونية",
  real_estate_property: "العقارات والممتلكات",
  hospitality_tourism: "الضيافة والسياحة",
  finance_banking: "المالية والمصارف",
  insurance: "التأمين",
  consulting_professional_services: "الاستشارات والخدمات المهنية",
  legal_services: "الخدمات القانونية",
  marketing_advertising: "التسويق والإعلان",
  media_entertainment: "الإعلام والترفيه",
  education_training: "التعليم والتدريب",
  security_facilities_management: "الأمن وإدارة المرافق",
  government_public_sector: "الحكومة والقطاع العام",
  nonprofit_ngos: "المنظمات غير الربحية والمنظمات غير الحكومية",
  wholesale_distribution: "الجملة والتوزيع",
  consumer_goods: "السلع الاستهلاكية",
  utilities_infrastructure: "المرافق والبنية التحتية",
  scientific_research_services: "الخدمات العلمية والبحثية",
};

const frIndustries: CompanyIndustryLabels = {
  information_technology: "Technologies de l’information",
  software_saas: "Logiciels et SaaS",
  telecommunications: "Télécommunications",
  cybersecurity: "Cybersécurité",
  construction_engineering: "Construction et ingénierie",
  architecture_design: "Architecture et design",
  manufacturing: "Industrie manufacturière",
  automotive: "Automobile",
  logistics_transportation: "Logistique et transport",
  energy_utilities: "Énergie et services publics",
  oil_gas_mining: "Pétrole, gaz et mines",
  environmental_services: "Services environnementaux",
  healthcare: "Santé",
  pharmaceuticals_biotechnology: "Pharmaceutique et biotechnologie",
  agriculture_agribusiness: "Agriculture et agroalimentaire",
  food_beverage: "Alimentation et boissons",
  retail_ecommerce: "Commerce de détail et e-commerce",
  real_estate_property: "Immobilier et propriété",
  hospitality_tourism: "Hôtellerie et tourisme",
  finance_banking: "Finance et banque",
  insurance: "Assurance",
  consulting_professional_services: "Conseil et services professionnels",
  legal_services: "Services juridiques",
  marketing_advertising: "Marketing et publicité",
  media_entertainment: "Médias et divertissement",
  education_training: "Éducation et formation",
  security_facilities_management: "Sécurité et gestion des installations",
  government_public_sector: "Gouvernement et secteur public",
  nonprofit_ngos: "Organisations à but non lucratif et ONG",
  wholesale_distribution: "Commerce de gros et distribution",
  consumer_goods: "Biens de consommation",
  utilities_infrastructure: "Services publics et infrastructures",
  scientific_research_services: "Services scientifiques et de recherche",
};

const byLocale: Record<Locale, CompanyIndustryCopy> = {
  en: {
    placeholder: "Select an industry / sector",
    searchPlaceholder: "Search industries…",
    empty: "No industries found.",
    required: "Select an industry / sector.",
    industries: enIndustries,
  },
  es: {
    placeholder: "Seleccione una industria / sector",
    searchPlaceholder: "Buscar industrias…",
    empty: "No se encontraron industrias.",
    required: "Seleccione una industria / sector.",
    industries: esIndustries,
  },
  zh: {
    placeholder: "选择行业 / 领域",
    searchPlaceholder: "搜索行业…",
    empty: "未找到相关行业。",
    required: "请选择行业 / 领域。",
    industries: zhIndustries,
  },
  ar: {
    placeholder: "اختر قطاعًا / مجالًا",
    searchPlaceholder: "ابحث عن القطاعات…",
    empty: "لم يتم العثور على قطاعات.",
    required: "يرجى اختيار قطاع / مجال.",
    industries: arIndustries,
  },
  fr: {
    placeholder: "Sélectionnez un secteur d’activité",
    searchPlaceholder: "Rechercher un secteur…",
    empty: "Aucun secteur trouvé.",
    required: "Sélectionnez un secteur d’activité.",
    industries: frIndustries,
  },
};

export function getCompanyIndustryCopy(locale: Locale): CompanyIndustryCopy {
  return byLocale[locale] ?? byLocale.en;
}

export function getCompanyIndustryOptions(locale: Locale): {
  value: CompanyIndustryId;
  label: string;
}[] {
  const copy = getCompanyIndustryCopy(locale);
  return COMPANY_INDUSTRY_IDS.map((id) => ({
    value: id,
    label: copy.industries[id],
  }));
}

/** Resolve a stored industry (slug, legacy label, or custom) for display. */
export function formatCompanyIndustryLabel(
  stored: string | null | undefined,
  locale: Locale,
): string {
  if (!stored?.trim()) return "";
  const id = resolveCompanyIndustryId(stored);
  if (id) return getCompanyIndustryCopy(locale).industries[id];
  return stored.trim();
}
