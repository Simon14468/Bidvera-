import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commercialKeywords,
  keywordRegistry,
  keywordToPageMap,
  keywordsByCapability,
  keywordsByLanguage,
  keywordsWithoutVolume,
  keywordsWithVerifiedDemand,
  questionKeywords,
  registrySummary,
  scoreKeyword,
} from "@/seo/keywords";
import { getSeoPageByPath } from "@/seo/content";
import { siteEntity } from "@/seo/site-entity";

describe("keyword intelligence registry", () => {
  it("covers five languages with native entries", () => {
    for (const lang of ["en", "fr", "es", "ar", "zh"] as const) {
      assert.ok(keywordsByLanguage(lang).length >= 5, lang);
    }
  });

  it("never invents search volumes", () => {
    assert.equal(keywordsWithoutVolume().length, keywordRegistry.length);
    for (const row of keywordToPageMap()) {
      assert.equal(row.search_volume, "UNKNOWN");
    }
  });

  it("maps active keywords to existing indexable pages", () => {
    for (const k of keywordRegistry) {
      if (k.status === "blocked_off_feature") continue;
      const page = getSeoPageByPath(k.targetUrl);
      assert.ok(page, `${k.id} → ${k.targetUrl}`);
    }
  });

  it("blocks Matching Engine commercial marketing keywords", () => {
    const blocked = keywordRegistry.filter((k) => k.status === "blocked_off_feature");
    assert.ok(blocked.length >= 1);
    assert.ok(blocked.every((k) => k.topic.includes("matching") || k.notes?.includes("Matching")));
  });

  it("covers major Bidvera capability clusters", () => {
    const required = [
      "company_intelligence",
      "document_compliance",
      "supplier_qualification",
      "client_requests_questionnaires",
      "evidence_intelligence",
      "decision_intelligence",
      "opportunity_readiness",
      "tender_analysis",
    ] as const;
    for (const cap of required) {
      assert.ok(keywordsByCapability(cap).length >= 1, cap);
    }
  });

  it("includes commercial and question/GEO intents", () => {
    assert.ok(commercialKeywords().length >= 10);
    assert.ok(questionKeywords().length >= 10);
  });

  it("records verified demand only where evidence ledger allows", () => {
    const verified = keywordsWithVerifiedDemand();
    assert.ok(verified.length >= 5);
    for (const k of verified) {
      assert.ok(
        k.demandEvidence === "web_category_presence" ||
          k.demandEvidence === "native_vendor_terminology",
      );
    }
  });

  it("priority scoring is bounded and not a ranking claim", () => {
    const p = scoreKeyword({
      commercialIntent: 10,
      relevance: 10,
      demandEvidenceStrength: 10,
      competition: 0,
      conversionPotential: 10,
      contentOpportunity: 10,
      geographicOpportunity: 10,
    });
    assert.ok(p >= 1 && p <= 100);
    for (const k of keywordRegistry) {
      assert.ok(k.priority >= 1 && k.priority <= 100, k.id);
    }
  });

  it("entity positioning is company intelligence first", () => {
    assert.match(siteEntity.description, /Company Intelligence/i);
    assert.match(siteEntity.description, /Tender analysis is one capability/i);
    assert.ok(siteEntity.entityChain.includes("company intelligence"));
    assert.ok(siteEntity.notCommerciallyClaimed.some((x) => /Matching Engine/i.test(x)));
  });

  it("registry summary exposes audit counts", () => {
    const s = registrySummary();
    assert.ok(s.total >= 40);
    assert.equal(s.unknownVolume, s.total);
    assert.ok(s.byLanguage.fr >= 5);
  });
});
