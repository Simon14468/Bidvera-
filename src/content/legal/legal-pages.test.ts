import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  getPrivacyPolicySections,
  getTermsOfServiceSections,
} from "@/content/legal";
import {
  LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  LEGAL_PLACEHOLDERS,
  UNPUBLISHED_LEGAL_TOKEN_RE,
} from "@/content/legal/meta";
import { LEGAL_PENDING_COPY } from "@/content/legal/pending";
import { locales, type Locale } from "@/i18n/config";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function flatten(sections: { paragraphs: string[]; bullets?: string[] }[]) {
  return sections
    .map((s) => [...s.paragraphs, ...(s.bullets ?? [])].join(" "))
    .join("\n");
}

describe("legal pages", () => {
  it("registers privacy and terms routes and footer links", () => {
    assert.match(
      read("src/app/(marketing)/(site)/privacy-policy/page.tsx"),
      /getPrivacyPolicySections/,
    );
    assert.match(
      read("src/app/(marketing)/(site)/terms-of-service/page.tsx"),
      /getTermsOfServiceSections/,
    );
    const footer = read("src/components/marketing/site-chrome.tsx");
    assert.match(footer, /\/privacy-policy/);
    assert.match(footer, /\/terms-of-service/);
    assert.match(footer, /footerHeading/);
  });

  it("keeps unresolved tokens private and does not invent entity facts", () => {
    assert.match(LEGAL_PLACEHOLDERS.legalEntityName, /LEGAL_ENTITY_NAME/);
    assert.match(LEGAL_PLACEHOLDERS.cndpReference, /CNDP/);
    assert.match(LEGAL_PLACEHOLDERS.legalContactEmail, /LEGAL_CONTACT_EMAIL/);
    const checklist = read("docs/legal-review-checklist.md");
    for (const token of Object.values(LEGAL_PLACEHOLDERS)) {
      assert.match(checklist, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const locale of locales) {
      const privacy = flatten(getPrivacyPolicySections(locale));
      assert.doesNotMatch(privacy, /we are GDPR certified|CNDP receipt number \d/i);
      assert.doesNotMatch(privacy, /never used for training/i);
    }
  });

  it("does not render raw placeholder tokens in public legal copy", () => {
    for (const locale of locales) {
      const privacy = flatten(getPrivacyPolicySections(locale));
      const terms = flatten(getTermsOfServiceSections(locale));
      assert.doesNotMatch(privacy, UNPUBLISHED_LEGAL_TOKEN_RE, `privacy ${locale}`);
      assert.doesNotMatch(terms, UNPUBLISHED_LEGAL_TOKEN_RE, `terms ${locale}`);
      assert.doesNotMatch(privacy, /\[[A-Z][A-Z0-9_ /,—-]+\]/);
      assert.doesNotMatch(terms, /\[[A-Z][A-Z0-9_ /,—-]+\]/);
    }
    for (const [locale, copy] of Object.entries(LEGAL_PENDING_COPY)) {
      for (const [key, value] of Object.entries(copy)) {
        assert.doesNotMatch(value, UNPUBLISHED_LEGAL_TOKEN_RE, `${locale}.${key}`);
        assert.ok(value.trim().length > 8, `${locale}.${key} too short`);
      }
    }
  });

  it("omits published contact sections until entity details exist", () => {
    for (const locale of locales) {
      const privacy = getPrivacyPolicySections(locale);
      const terms = getTermsOfServiceSections(locale);
      assert.equal(privacy.some((s) => s.id === "contact"), false, `privacy contact ${locale}`);
      assert.equal(terms.some((s) => s.id === "contact"), false, `terms contact ${locale}`);
      assert.doesNotMatch(flatten(terms), /LEGAL_CONTACT_EMAIL/);
    }
  });

  it("does not claim matching engine or tender analysis as generally sold", () => {
    const terms = flatten(getTermsOfServiceSections("en"));
    assert.match(terms, /commercially unavailable|not promise that every technical module is sold/i);
  });

  it("uses a configured effective date", () => {
    assert.match(LEGAL_DOCUMENTS_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("indexes legal paths in SEO registry", () => {
    const seo = read("src/seo/content/index.ts");
    assert.match(seo, /path:\s*"\/privacy-policy"/);
    assert.match(seo, /path:\s*"\/terms-of-service"/);
  });

  it("serves localized legal bodies with matching section ids", () => {
    const privacyEn = getPrivacyPolicySections("en");
    const termsEn = getTermsOfServiceSections("en");
    const privacyIds = privacyEn.map((s) => s.id);
    const termsIds = termsEn.map((s) => s.id);

    for (const locale of locales) {
      const privacy = getPrivacyPolicySections(locale);
      const terms = getTermsOfServiceSections(locale);
      assert.deepEqual(privacy.map((s) => s.id), privacyIds, `privacy ids ${locale}`);
      assert.deepEqual(terms.map((s) => s.id), termsIds, `terms ids ${locale}`);
      assert.ok(privacy.every((s) => s.title.trim() && s.paragraphs.length > 0));
      assert.ok(terms.every((s) => s.title.trim() && s.paragraphs.length > 0));
    }

    const localized: Locale[] = ["es", "zh", "ar", "fr"];
    for (const locale of localized) {
      assert.notEqual(
        getPrivacyPolicySections(locale)[0].title,
        privacyEn[0].title,
        `privacy title ${locale}`,
      );
      assert.notEqual(
        getTermsOfServiceSections(locale)[0].title,
        termsEn[0].title,
        `terms title ${locale}`,
      );
      assert.notEqual(
        LEGAL_PENDING_COPY[locale].controllerIdentity,
        LEGAL_PENDING_COPY.en.controllerIdentity,
      );
    }
  });

  it("localizes the on-this-page chrome instead of an English-only banner", () => {
    const doc = read("src/components/marketing/legal-document.tsx");
    assert.match(doc, /onThisPageLabel/);
    assert.doesNotMatch(doc, /englishNotice|englishBindingNotice|On this page/);
    const dict = read("src/i18n/dictionaries.ts");
    assert.match(dict, /onThisPage:/);
    assert.doesNotMatch(dict, /englishBindingNotice/);
  });
});
