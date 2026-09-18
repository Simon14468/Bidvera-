/**
 * Localized extraction gate messages for UI display.
 */

import {
  messageForExtractionGateReason,
  type ExtractionGateReason,
} from "@/domain/decision/extraction-gate";
import type { Locale } from "@/i18n/config";

const LOCALIZED: Partial<
  Record<Locale, Partial<Record<ExtractionGateReason, string>>>
> = {
  en: {
    NOT_A_TENDER_DOCUMENT:
      "This file does not appear to be a valid tender or procurement document (RFP, ITT, RFQ, CPS, or tender pack). Bidvera did not analyze it as a bid opportunity.",
  },
  fr: {
    NOT_A_TENDER_DOCUMENT:
      "Ce fichier ne semble pas être un document d'appel d'offres ou de marché valide (RFP, ITT, RFQ, CPS ou dossier complet). Bidvera ne l'a pas analysé comme une opportunité d'offre.",
  },
  es: {
    NOT_A_TENDER_DOCUMENT:
      "Este archivo no parece ser un documento de licitación o contratación válido (RFP, ITT, RFQ, CPS o paquete completo). Bidvera no lo analizó como una oportunidad de oferta.",
  },
  zh: {
    NOT_A_TENDER_DOCUMENT:
      "该文件似乎不是有效的招标或采购文件（RFP、ITT、RFQ、CPS 或完整标书包）。Bidvera 未将其作为投标机会进行分析。",
  },
  ar: {
    NOT_A_TENDER_DOCUMENT:
      "يبدو أن هذا الملف ليس مستندًا صالحًا للمناقصة أو المشتريات (RFP أو ITT أو RFQ أو CPS أو حزمة كاملة). لم يُحلّل Bidvera الملف كفرصة تقديم عرض.",
  },
};

export function resolveExtractionGateMessage(
  reason: ExtractionGateReason,
  locale: Locale,
): string {
  return (
    LOCALIZED[locale]?.[reason] ??
    LOCALIZED.en?.[reason] ??
    messageForExtractionGateReason(reason)
  );
}
