import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPANY_INDUSTRY_IDS,
  resolveCompanyIndustryId,
} from "@/config/company-industries";
import {
  formatCompanyIndustryLabel,
  getCompanyIndustryCopy,
  getCompanyIndustryOptions,
} from "@/i18n/company-industries";
import { locales } from "@/i18n/config";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("company industry taxonomy", () => {
  it("exposes exactly 33 stable industry ids", () => {
    assert.equal(COMPANY_INDUSTRY_IDS.length, 33);
    assert.equal(new Set(COMPANY_INDUSTRY_IDS).size, 33);
    assert.ok(COMPANY_INDUSTRY_IDS.includes("construction_engineering"));
    assert.ok(COMPANY_INDUSTRY_IDS.includes("scientific_research_services"));
    assert.ok(!COMPANY_INDUSTRY_IDS.includes("Other" as never));
  });

  it("maps legacy English onboarding labels to stable ids", () => {
    assert.equal(
      resolveCompanyIndustryId("Security & Facilities"),
      "security_facilities_management",
    );
    assert.equal(resolveCompanyIndustryId("Education"), "education_training");
    assert.equal(
      resolveCompanyIndustryId("Marketing & Creative"),
      "marketing_advertising",
    );
    assert.equal(
      resolveCompanyIndustryId("Finance & Insurance"),
      "finance_banking",
    );
    assert.equal(
      resolveCompanyIndustryId("information_technology"),
      "information_technology",
    );
    assert.equal(resolveCompanyIndustryId("Aerospace Widgets"), null);
  });

  it("provides translated labels for every locale and industry", () => {
    for (const locale of locales) {
      const copy = getCompanyIndustryCopy(locale);
      assert.ok(copy.placeholder.trim());
      assert.ok(copy.searchPlaceholder.trim());
      assert.ok(copy.empty.trim());
      const options = getCompanyIndustryOptions(locale);
      assert.equal(options.length, 33);
      for (const id of COMPANY_INDUSTRY_IDS) {
        assert.ok(copy.industries[id]?.trim(), `${locale}:${id}`);
      }
      if (locale !== "en") {
        assert.notEqual(
          copy.industries.construction_engineering,
          "Construction & Engineering",
        );
      }
    }
  });

  it("formats stored values for display without breaking legacy free text", () => {
    assert.equal(
      formatCompanyIndustryLabel("Healthcare", "en"),
      "Healthcare",
    );
    assert.equal(
      formatCompanyIndustryLabel("healthcare", "fr"),
      getCompanyIndustryCopy("fr").industries.healthcare,
    );
    assert.equal(
      formatCompanyIndustryLabel("Custom niche sector", "es"),
      "Custom niche sector",
    );
  });
});

describe("company industry UI wiring", () => {
  it("uses searchable combobox on onboarding and company profile", () => {
    const form = read("src/components/onboarding/company-form.tsx");
    const profile = read("src/app/(app)/company/company-profile-form.tsx");
    const page = read("src/app/(onboarding)/onboarding/company/page.tsx");
    assert.match(form, /SearchableCombobox/);
    assert.match(form, /getCompanyIndustryOptions/);
    assert.doesNotMatch(form, /INDUSTRY_OPTIONS\.map/);
    assert.doesNotMatch(form, /industryOther/);
    assert.match(profile, /SearchableCombobox/);
    assert.match(page, /locale=\{locale\}/);
  });

  it("keeps industry separate from services field", () => {
    const form = read("src/components/onboarding/company-form.tsx");
    assert.match(form, /copy\.services/);
    assert.match(form, /id="industry"/);
  });
});
