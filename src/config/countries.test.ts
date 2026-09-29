import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasFlag } from "country-flag-icons";
import {
  COMPANY_COUNTRY_CODES,
  resolveCountryCode,
} from "@/config/countries";
import {
  formatCountryLabel,
  getCountryOptions,
  getCountryUiCopy,
} from "@/i18n/countries";
import { locales } from "@/i18n/config";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("company country taxonomy", () => {
  it("exposes ~195 ISO alpha-2 countries without Morocco first", () => {
    assert.equal(COMPANY_COUNTRY_CODES.length, 195);
    assert.equal(new Set(COMPANY_COUNTRY_CODES).size, 195);
    assert.notEqual(COMPANY_COUNTRY_CODES[0], "MA");
    assert.ok(COMPANY_COUNTRY_CODES.includes("MA"));
    assert.ok(COMPANY_COUNTRY_CODES.includes("FR"));
    assert.ok(COMPANY_COUNTRY_CODES.includes("US"));
    assert.ok(COMPANY_COUNTRY_CODES.includes("GB"));
  });

  it("maps legacy English names and codes to ISO alpha-2", () => {
    assert.equal(resolveCountryCode("Morocco"), "MA");
    assert.equal(resolveCountryCode("ma"), "MA");
    assert.equal(resolveCountryCode("United Kingdom"), "GB");
    assert.equal(resolveCountryCode("United States"), "US");
    assert.equal(resolveCountryCode("Other"), null);
    assert.equal(resolveCountryCode("Narnia"), null);
  });

  it("builds alphabetical localized options with SVG flag assets", () => {
    for (const locale of locales) {
      const options = getCountryOptions(locale);
      assert.equal(options.length, 195);
      assert.ok(getCountryUiCopy(locale).placeholder.trim());
      assert.notEqual(options[0]?.value, "MA");
      for (let i = 1; i < options.length; i++) {
        assert.ok(
          options[i - 1]!.label.localeCompare(options[i]!.label, locale, {
            sensitivity: "base",
          }) <= 0,
          `${locale}: ${options[i - 1]!.label} before ${options[i]!.label}`,
        );
      }
      const morocco = options.find((o) => o.value === "MA");
      assert.ok(morocco);
      assert.match(morocco!.searchText.toLowerCase(), /ma|mar/);
      assert.equal(morocco!.hasFlagAsset, true);
      assert.equal(hasFlag("MA"), true);
      assert.equal(hasFlag("FR"), true);
      assert.equal(hasFlag("US"), true);
      assert.equal(hasFlag("GB"), true);
    }
  });

  it("formats stored values without breaking legacy free text", () => {
    assert.equal(formatCountryLabel("Morocco", "en"), "Morocco");
    assert.equal(formatCountryLabel("MA", "fr"), "Maroc");
    assert.equal(formatCountryLabel("Custom Freeport", "es"), "Custom Freeport");
  });

  it("search supports name and ISO codes for Morocco / France", () => {
    const options = getCountryOptions("en");
    const by = (q: string) =>
      options.filter((o) =>
        [o.label, o.value, o.searchText].join(" ").toLowerCase().includes(q),
      );
    assert.ok(by("mor").some((o) => o.value === "MA"));
    assert.ok(by("ma").some((o) => o.value === "MA"));
    assert.ok(by("united").some((o) => o.value === "US"));
    assert.ok(by("united").some((o) => o.value === "GB"));
    assert.ok(by("fr").some((o) => o.value === "FR"));
  });
});

describe("company country UI wiring", () => {
  it("uses SVG flag graphics and never emoji flags", () => {
    const form = read("src/components/onboarding/company-form.tsx");
    const flag = read("src/components/ui/country-flag.tsx");
    const countries = read("src/config/countries.ts");
    assert.match(form, /getCountryOptions/);
    assert.match(form, /CountryFlag/);
    assert.match(form, /id="country"/);
    assert.doesNotMatch(form, /COUNTRY_OPTIONS\.map/);
    assert.doesNotMatch(form, /geolocation|navigator\.geolocation|ip.?geo/i);
    assert.match(flag, /country-flag-icons\/3x2\/flags\.css/);
    assert.doesNotMatch(flag, /flagEmoji|flagcdn|fromCodePoint|1f1e6|String\.fromCodePoint/i);
    assert.doesNotMatch(countries, /countryFlagEmoji|flagcdn|fromCodePoint|1f1e6/);
    assert.doesNotMatch(flag, /[\u{1F1E6}-\u{1F1FF}]/u);
  });
});
