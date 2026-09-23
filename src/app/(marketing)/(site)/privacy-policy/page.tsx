import { LegalDocument } from "@/components/marketing/legal-document";
import { getPrivacyPolicySections } from "@/content/legal";
import { LEGAL_DOCUMENTS_EFFECTIVE_DATE } from "@/content/legal/meta";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { buildPageMetadata } from "@/seo/metadata";
import { JsonLd, breadcrumbJsonLd, webPageJsonLd } from "@/seo/json-ld";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return buildPageMetadata({
    path: "/privacy-policy",
    title: t.legal.privacyTitle,
    description: t.legal.privacyMetaDescription,
  });
}

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <>
      <JsonLd
        data={webPageJsonLd({
          path: "/privacy-policy",
          name: t.legal.privacyTitle,
          description: t.legal.privacyMetaDescription,
          locale,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: t.legal.privacyLink, path: "/privacy-policy" },
        ])}
      />
      <LegalDocument
        eyebrow={t.legal.privacyEyebrow}
        title={t.legal.privacyTitle}
        effectiveLabel={t.legal.effectiveDateLabel}
        lastUpdatedLabel={t.legal.lastUpdatedLabel}
        effectiveDate={LEGAL_DOCUMENTS_EFFECTIVE_DATE}
        onThisPageLabel={t.legal.onThisPage}
        sections={getPrivacyPolicySections(locale)}
        relatedHeading={t.legal.relatedDocuments}
        relatedLinks={[
          { href: "/terms-of-service", label: t.legal.termsLink },
          { href: "/faq", label: t.nav.faq },
          { href: "/signup", label: t.nav.startFree },
        ]}
      />
    </>
  );
}
