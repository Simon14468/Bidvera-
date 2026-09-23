import type { Locale } from "@/i18n/config";

/**
 * Customer-facing wording used while LEGAL_PLACEHOLDERS remain unresolved.
 * Do not put raw tokens or internal counsel notes in these strings.
 */
export type LegalPendingCopy = {
  controllerIdentity: string;
  registeredAddress: string;
  privacyContact: string;
  dataProtectionContact: string;
  hostingRegions: string;
  transferSafeguards: string;
  cndpStatus: string;
  operatorIdentity: string;
  refundPolicy: string;
  governingLaw: string;
  governingLawProcess: string;
  liabilityLimitsNote: string;
  indemnityScopeNote: string;
};

export const LEGAL_PENDING_COPY: Record<Locale, LegalPendingCopy> = {
  en: {
    controllerIdentity:
      "The registered legal entity that acts as Bidvera’s data controller has not yet been published. Until that confirmation, “Bidvera” refers to the operator of the getbidvera.com service.",
    registeredAddress:
      "A registered office address has not yet been published. We will update this Policy when a registered address is confirmed.",
    privacyContact:
      "A dedicated privacy contact email has not yet been published. Until one is confirmed, privacy requests may be sent through Bidvera’s in-product support or the contact options shown on getbidvera.com.",
    dataProtectionContact:
      "A dedicated data-protection contact has not been designated or published. If one is designated later, we will update this Policy.",
    hostingRegions:
      "Bidvera uses third-party infrastructure providers and may process and store data in more than one country. The specific hosting and processing regions have not yet been published. We will update this Policy when those regions are confirmed.",
    transferSafeguards:
      "If you access Bidvera from Morocco, the EU/EEA, or other regions, your data may be transferred to or accessed from countries with different data-protection rules. Where required by applicable law, we will use appropriate transfer mechanisms. This Policy does not claim that a specific transfer safeguard (for example a named set of standard contractual clauses) is already in place.",
    cndpStatus:
      "Bidvera has not published a CNDP notification, authorization, or receipt reference. This Policy does not claim that any CNDP filing has been obtained. We will update this Policy if and when a filing or authorization applies and has been confirmed.",
    operatorIdentity:
      "“Bidvera”, “we”, “us” means the operator of the getbidvera.com Service. The operator’s final registered legal entity name has not yet been published and will be added when confirmed.",
    refundPolicy:
      "A final refund and cancellation policy has not yet been published. Until a final policy is published here or in your order form, refund eligibility is determined by Bidvera’s then-current commercial practice and any mandatory consumer or commercial law that applies to you.",
    governingLaw:
      "Governing law and venue have not yet been confirmed or published.",
    governingLawProcess:
      "Until governing law and venue are published in these Terms, disputes should first be addressed in good faith through Bidvera’s support channels. These Terms do not designate a specific court or jurisdiction.",
    liabilityLimitsNote:
      "These limits may not apply where prohibited by mandatory law.",
    indemnityScopeNote:
      "This obligation applies only to the extent permitted by applicable law.",
  },
  es: {
    controllerIdentity:
      "La entidad jurídica registrada que actúa como responsable del tratamiento de Bidvera aún no se ha publicado. Hasta esa confirmación, «Bidvera» designa al operador del servicio getbidvera.com.",
    registeredAddress:
      "Aún no se ha publicado un domicilio social. Actualizaremos esta Política cuando se confirme una dirección registrada.",
    privacyContact:
      "Aún no se ha publicado un correo de contacto de privacidad. Hasta que se confirme, las solicitudes de privacidad pueden enviarse a través del soporte en el producto Bidvera o de las opciones de contacto mostradas en getbidvera.com.",
    dataProtectionContact:
      "No se ha designado ni publicado un contacto específico de protección de datos. Si se designa más adelante, actualizaremos esta Política.",
    hostingRegions:
      "Bidvera utiliza proveedores de infraestructura de terceros y puede tratar y almacenar datos en más de un país. Las regiones concretas de alojamiento y tratamiento aún no se han publicado. Actualizaremos esta Política cuando esas regiones se confirmen.",
    transferSafeguards:
      "Si accede a Bidvera desde Marruecos, la UE/EEE u otras regiones, sus datos pueden transferirse o consultarse desde países con normas distintas de protección de datos. Cuando lo exija la ley aplicable, usaremos mecanismos de transferencia adecuados. Esta Política no afirma que ya exista una salvaguarda concreta de transferencia (por ejemplo, un conjunto nominado de cláusulas contractuales tipo).",
    cndpStatus:
      "Bidvera no ha publicado una referencia de notificación, autorización o acuse de la CNDP. Esta Política no afirma que se haya obtenido ningún trámite ante la CNDP. Actualizaremos esta Política si y cuando un trámite o autorización resulte aplicable y haya sido confirmado.",
    operatorIdentity:
      "«Bidvera», «nosotros» significa el operador del Servicio getbidvera.com. El nombre jurídico registrado definitivo del operador aún no se ha publicado y se añadirá cuando se confirme.",
    refundPolicy:
      "Aún no se ha publicado una política definitiva de reembolsos y cancelación. Hasta que se publique aquí o en su pedido, la elegibilidad se determina por la práctica comercial vigente de Bidvera y por cualquier ley imperativa de consumo o mercantil que le resulte aplicable.",
    governingLaw:
      "La ley aplicable y el fuero aún no se han confirmado ni publicado.",
    governingLawProcess:
      "Hasta que la ley aplicable y el fuero se publiquen en estos Términos, las controversias deben abordarse primero de buena fe a través de los canales de soporte de Bidvera. Estos Términos no designan un tribunal ni una jurisdicción concretos.",
    liabilityLimitsNote:
      "Estos límites pueden no aplicarse cuando lo prohíba la ley imperativa.",
    indemnityScopeNote:
      "Esta obligación se aplica únicamente en la medida permitida por la ley aplicable.",
  },
  fr: {
    controllerIdentity:
      "L’entité juridique enregistrée qui agit comme responsable du traitement de Bidvera n’a pas encore été publiée. Jusqu’à cette confirmation, « Bidvera » désigne l’opérateur du service getbidvera.com.",
    registeredAddress:
      "Aucune adresse de siège n’a encore été publiée. Nous mettrons à jour cette Politique lorsqu’une adresse enregistrée sera confirmée.",
    privacyContact:
      "Aucune adresse e-mail dédiée à la confidentialité n’a encore été publiée. Jusqu’à confirmation, les demandes relatives à la confidentialité peuvent être envoyées via le support intégré à Bidvera ou les options de contact affichées sur getbidvera.com.",
    dataProtectionContact:
      "Aucun contact dédié à la protection des données n’a été désigné ni publié. S’il l’est ultérieurement, nous mettrons à jour cette Politique.",
    hostingRegions:
      "Bidvera utilise des prestataires d’infrastructure tiers et peut traiter et stocker des données dans plus d’un pays. Les régions précises d’hébergement et de traitement n’ont pas encore été publiées. Nous mettrons à jour cette Politique lorsque ces régions seront confirmées.",
    transferSafeguards:
      "Si vous accédez à Bidvera depuis le Maroc, l’UE/EEE ou d’autres régions, vos données peuvent être transférées ou consultées depuis des pays aux règles différentes. Lorsque le droit applicable l’exige, nous utiliserons des mécanismes de transfert appropriés. Cette Politique n’affirme pas qu’une sauvegarde de transfert précise (par exemple un jeu nommé de clauses contractuelles types) est déjà en place.",
    cndpStatus:
      "Bidvera n’a pas publié de référence de notification, d’autorisation ou de récépissé CNDP. Cette Politique n’affirme pas qu’une formalité CNDP a déjà été obtenue. Nous mettrons à jour cette Politique si et lorsqu’une formalité ou une autorisation s’applique et a été confirmée.",
    operatorIdentity:
      "« Bidvera », « nous » désigne l’opérateur du Service getbidvera.com. Le nom juridique enregistré définitif de l’opérateur n’a pas encore été publié et sera ajouté lorsqu’il sera confirmé.",
    refundPolicy:
      "Aucune politique définitive de remboursement et d’annulation n’a encore été publiée. Tant qu’une politique définitive n’est pas publiée ici ou dans votre bon de commande, l’éligibilité est déterminée par la pratique commerciale alors en vigueur de Bidvera et par toute loi impérative de consommation ou commerciale qui vous est applicable.",
    governingLaw:
      "Le droit applicable et le for n’ont pas encore été confirmés ni publiés.",
    governingLawProcess:
      "Tant que le droit applicable et le for ne sont pas publiés dans ces Conditions, les litiges doivent d’abord être traités de bonne foi via les canaux d’assistance de Bidvera. Ces Conditions ne désignent aucun tribunal ni aucune juridiction particulière.",
    liabilityLimitsNote:
      "Ces limites peuvent ne pas s’appliquer lorsqu’une loi impérative les interdit.",
    indemnityScopeNote:
      "Cette obligation s’applique uniquement dans la mesure permise par le droit applicable.",
  },
  ar: {
    controllerIdentity:
      "لم يُنشر بعد الكيان القانوني المسجّل الذي يعمل كمسؤول عن معالجة البيانات لدى بيدفراء. إلى حين ذلك التأكيد، تشير «بيدفراء» إلى مشغّل خدمة getbidvera.com.",
    registeredAddress:
      "لم يُنشر بعد عنوان مكتب مسجّل. سنحدّث هذه السياسة عند تأكيد عنوان مسجّل.",
    privacyContact:
      "لم يُنشر بعد بريد إلكتروني مخصص لطلبات الخصوصية. إلى حين تأكيده، يمكن إرسال طلبات الخصوصية عبر دعم بيدفراء داخل المنتج أو خيارات الاتصال المعروضة على getbidvera.com.",
    dataProtectionContact:
      "لم يُعيَّن أو يُنشر جهة اتصال مخصصة لحماية البيانات. إذا عُيِّنت لاحقاً، سنحدّث هذه السياسة.",
    hostingRegions:
      "تستخدم بيدفراء مزوّدي بنية تحتية من أطراف ثالثة وقد تعالج البيانات وتخزّنها في أكثر من بلد. لم تُنشر بعد مناطق الاستضافة والمعالجة المحددة. سنحدّث هذه السياسة عند تأكيد تلك المناطق.",
    transferSafeguards:
      "إذا دخلت إلى بيدفراء من المغرب أو الاتحاد الأوروبي/المنطقة الاقتصادية الأوروبية أو مناطق أخرى، فقد تُنقل بياناتك أو يُطَّلع عليها من دول بقواعد حماية بيانات مختلفة. عند اقتضاء القانون المعمول به سنستخدم آليات نقل مناسبة. لا تدّعي هذه السياسة أن ضمانة نقل محددة (مثل مجموعة بنود تعاقدية قياسية معيّنة) قائمة بالفعل.",
    cndpStatus:
      "لم تنشر بيدفراء مرجعاً لإشعار أو ترخيص أو وصل من اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي (CNDP). لا تدّعي هذه السياسة أنه تم الحصول على أي إجراء لدى اللجنة. سنحدّث هذه السياسة إذا ومتى انطبق إشعار أو ترخيص وتم تأكيده.",
    operatorIdentity:
      "«بيدفراء» أو «نحن» تعني مشغّل خدمة getbidvera.com. لم يُنشر بعد الاسم القانوني المسجّل النهائي للمشغّل وسيُضاف عند تأكيده.",
    refundPolicy:
      "لم تُنشر بعد سياسة نهائية للاسترداد والإلغاء. إلى أن تُنشر سياسة نهائية هنا أو في نموذج طلبك، تُحدَّد أهلية الاسترداد وفق الممارسة التجارية السارية لبيدفراء وأي قانون إلزامي للمستهلك أو التجارة ينطبق عليك.",
    governingLaw:
      "لم يُؤكَّد أو يُنشر بعد القانون الحاكم والاختصاص.",
    governingLawProcess:
      "إلى أن يُنشر القانون الحاكم والاختصاص في هذه الشروط، ينبغي معالجة النزاعات أولاً بحسن نية عبر قنوات دعم بيدفراء. لا تعيّن هذه الشروط محكمة أو ولاية قضائية محددة.",
    liabilityLimitsNote:
      "قد لا تنطبق هذه الحدود حيث يحظرها قانون إلزامي.",
    indemnityScopeNote:
      "يسري هذا الالتزام فقط بالقدر الذي يسمح به القانون المعمول به.",
  },
  zh: {
    controllerIdentity:
      "作为 Bidvera 数据控制者的已登记法律实体尚未公布。在确认之前，「Bidvera」指 getbidvera.com 服务的运营方。",
    registeredAddress:
      "注册办公地址尚未公布。确认注册地址后，我们将更新本政策。",
    privacyContact:
      "专用隐私联系邮箱尚未公布。在确认之前，隐私请求可通过 Bidvera 产品内支持或 getbidvera.com 上显示的联系方式提交。",
    dataProtectionContact:
      "尚未指定或公布专门的数据保护联系人。若日后指定，我们将更新本政策。",
    hostingRegions:
      "Bidvera 使用第三方基础设施提供商，并可能在一个以上的国家处理与存储数据。具体托管与处理地区尚未公布。确认这些地区后，我们将更新本政策。",
    transferSafeguards:
      "若您从摩洛哥、欧盟/欧洲经济区或其他地区访问 Bidvera，您的数据可能被传输至或从数据保护规则不同的国家访问。在适用法律要求时，我们将使用适当的传输机制。本政策不主张已具备特定传输保障（例如某一套具名标准合同条款）。",
    cndpStatus:
      "Bidvera 尚未公布 CNDP 通知、授权或回执编号。本政策不主张已完成任何 CNDP 备案。若日后适用并经确认存在备案或授权，我们将更新本政策。",
    operatorIdentity:
      "「Bidvera」「我们」指 getbidvera.com 服务的运营方。运营方最终登记的法律实体名称尚未公布，确认后将予补充。",
    refundPolicy:
      "最终退款与取消政策尚未公布。在最终政策于此处或您的订单中公布之前，退款资格由 Bidvera 当时的商业惯例以及适用于您的强制性消费者或商事法律决定。",
    governingLaw:
      "适用法律与管辖地尚未确认或公布。确认后将写入本条款。",
    governingLawProcess:
      "在本条款公布适用法律与管辖地之前，争议应首先通过 Bidvera 支持渠道善意处理。本条款不指定特定法院或司法辖区。",
    liabilityLimitsNote:
      "在强制性法律禁止的情况下，这些限制可能不适用。",
    indemnityScopeNote:
      "本义务仅在适用法律允许的范围内适用。",
  },
};

export function getLegalPendingCopy(locale: Locale): LegalPendingCopy {
  return LEGAL_PENDING_COPY[locale] ?? LEGAL_PENDING_COPY.en;
}
