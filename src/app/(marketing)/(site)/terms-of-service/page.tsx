import { LegalDocument } from "@/components/marketing/legal-document";
import { getTermsOfServiceSections } from "@/content/legal";
import { LEGAL_DOCUMENTS_EFFECTIVE_DATE } from "@/content/legal/meta";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { buildPageMetadata } from "@/seo/metadata";
import { JsonLd, breadcrumbJsonLd, webPageJsonLd } from "@/seo/json-ld";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return buildPageMetadata({
    path: "/terms-of-service",
    title: t.legal.termsTitle,
    description: t.legal.termsMetaDescription,
  });
}

export default async function TermsOfServicePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <>
      <JsonLd
        data={webPageJsonLd({
          path: "/terms-of-service",
          name: t.legal.termsTitle,
          description: t.legal.termsMetaDescription,
          locale,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: t.legal.termsLink, path: "/terms-of-service" },
        ])}
      />
      <LegalDocument
        eyebrow={t.legal.termsEyebrow}
        title={t.legal.termsTitle}
        effectiveLabel={t.legal.effectiveDateLabel}
        lastUpdatedLabel={t.legal.lastUpdatedLabel}
        effectiveDate={LEGAL_DOCUMENTS_EFFECTIVE_DATE}
        onThisPageLabel={t.legal.onThisPage}
        sections={getTermsOfServiceSections(locale)}
        relatedHeading={t.legal.relatedDocuments}
        relatedLinks={[
          { href: "/privacy-policy", label: t.legal.privacyLink },
          { href: "/faq", label: t.nav.faq },
          { href: "/signup", label: t.nav.startFree },
        ]}
      />
    </>
  );
}
