import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { listIndexablePaths, getSeoPageByPath } from "@/seo/content";
import { robotsAllowPaths, robotsDisallowPaths } from "@/seo/robots-policy";
import { absoluteUrl, localeHref } from "@/seo/site-entity";
import { organizationJsonLd, softwareApplicationJsonLd } from "@/seo/json-ld";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("SEO foundation", () => {
  it("indexes a focused set of public SEO pages without thin spam volume", () => {
    const paths = listIndexablePaths();
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("/solutions/document-compliance"));
    assert.ok(paths.includes("/compare/spreadsheets"));
    assert.ok(paths.includes("/guides/track-compliance-documents"));
    assert.ok(paths.includes("/glossary"));
    assert.ok(paths.length >= 20 && paths.length <= 40);
  });

  it("does not market Matching Engine or Tender Discovery as available", () => {
    const solutions = readSrc("src/seo/content/solutions.ts");
    assert.match(solutions, /not commercially available|not marketed|not claimed/i);
    assert.doesNotMatch(solutions, /Matching Engine is available/);
    assert.doesNotMatch(solutions, /Tender Discovery surfaces/);
  });

  it("robots policy separates public and private surfaces", () => {
    assert.ok(robotsAllowPaths.includes("/solutions"));
    assert.ok(robotsDisallowPaths.includes("/dashboard"));
    assert.ok(robotsDisallowPaths.includes("/billing"));
    assert.ok(robotsDisallowPaths.includes("/login"));
    assert.ok(robotsDisallowPaths.some((p) => p.startsWith("/share")));
  });

  it("hreflang helpers produce lang query alternates", () => {
    assert.ok(absoluteUrl("/faq").endsWith("/faq"));
    assert.match(localeHref("/product", "fr"), /[?&]lang=fr/);
    assert.match(localeHref("/product", "ar"), /[?&]lang=ar/);
    assert.match(localeHref("/product", "zh"), /[?&]lang=zh/);
  });

  it("entity JSON-LD is truthful SoftwareApplication without fake ratings", () => {
    const org = organizationJsonLd();
    const app = softwareApplicationJsonLd();
    assert.equal(org["@type"], "Organization");
    assert.equal(app["@type"], "SoftwareApplication");
    assert.equal("aggregateRating" in app, false);
    assert.equal("review" in app, false);
    assert.ok(Array.isArray(app.featureList));
    assert.ok(Array.isArray(app.knowsAbout));
    assert.ok((app.knowsAbout as string[]).includes("company intelligence"));
  });

  it("solution pages include FR/ES/AR/ZH metadata for primary capabilities", () => {
    for (const pathKey of [
      "/solutions/company-intelligence",
      "/solutions/document-compliance",
      "/solutions/supplier-qualification",
    ]) {
      const page = getSeoPageByPath(pathKey);
      assert.ok(page, pathKey);
      for (const loc of ["fr", "es", "ar", "zh"] as const) {
        assert.ok(page!.locales[loc]?.title, `${pathKey} ${loc}`);
        assert.ok(page!.locales[loc]?.answer, `${pathKey} ${loc}`);
        assert.ok(page!.locales[loc]?.h1, `${pathKey} ${loc}`);
      }
    }
  });

  it("app and auth layouts set noindex", () => {
    assert.match(readSrc("src/app/(app)/layout.tsx"), /index:\s*false/);
    assert.match(readSrc("src/app/(marketing)/(auth)/layout.tsx"), /index:\s*false/);
    assert.match(readSrc("src/app/(onboarding)/layout.tsx"), /index:\s*false/);
    assert.match(readSrc("src/app/share/layout.tsx"), /index:\s*false/);
  });

  it("every SEO page has EN title description and direct answer", () => {
    for (const pathKey of listIndexablePaths()) {
      if (["/", "/product", "/pricing", "/faq"].includes(pathKey)) continue;
      const page = getSeoPageByPath(pathKey);
      assert.ok(page, pathKey);
      const en = page!.locales.en;
      assert.ok(en?.title, pathKey);
      assert.ok(en?.description, pathKey);
      assert.ok(en?.answer, pathKey);
      assert.ok(en?.h1, pathKey);
    }
  });
});
