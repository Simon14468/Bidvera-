import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSISTANT_BRAND_RULES,
  ASSISTANT_SAFETY_RULES,
  BIDVERA_CAPABILITY_PILLARS,
  DEFAULT_KNOWLEDGE_BY_LOCALE,
  DEFAULT_KNOWLEDGE_EN,
  detectAssistantLanguage,
  polishAssistantAnswer,
  resolveAssistantSystemPrompt,
  routeQuestionToCapability,
} from "@/services/ai/assistant-knowledge";

describe("assistant knowledge — eight capability pillars", () => {
  it("defines exactly eight capability pillars", () => {
    assert.equal(BIDVERA_CAPABILITY_PILLARS.length, 8);
  });

  it("EN default knowledge centers company intelligence — not tender-first identity", () => {
    assert.match(DEFAULT_KNOWLEDGE_EN, /Company Intelligence/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Document Compliance/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Supplier Qualification/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Client Requests/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Evidence Intelligence/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Decision Intelligence/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Opportunity/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /Team Decision Workflow|Business Readiness/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /secondary capability/i);
    assert.doesNotMatch(
      DEFAULT_KNOWLEDGE_EN,
      /tender go \/ no-go decision workspace \(not a generic PDF chatbot\)/i,
    );
  });

  it("blocks Matching Engine as generally available in knowledge and safety", () => {
    assert.match(DEFAULT_KNOWLEDGE_EN, /Matching Engine/i);
    assert.match(DEFAULT_KNOWLEDGE_EN, /not marketed as generally available|NOT Matching Engine|Do NOT claim Matching Engine/i);
    assert.match(ASSISTANT_SAFETY_RULES, /Matching Engine/i);
    assert.match(ASSISTANT_BRAND_RULES, /Matching Engine/i);
  });

  it("forbids inventing customers, stats, and OFF features", () => {
    assert.match(ASSISTANT_SAFETY_RULES, /Never invent customers, statistics/i);
    assert.match(ASSISTANT_BRAND_RULES, /Never invent specific company names/i);
    assert.doesNotMatch(ASSISTANT_BRAND_RULES, /used by a number of companies/i);
  });

  it("every locale default mentions eight-capability framing or equivalent paths", () => {
    for (const loc of ["en", "es", "zh", "ar", "fr"] as const) {
      const text = DEFAULT_KNOWLEDGE_BY_LOCALE[loc];
      assert.ok(text.includes("/solutions/company-intelligence"), loc);
      assert.ok(text.includes("/solutions/document-compliance"), loc);
      assert.ok(text.includes("/solutions/decision-intelligence"), loc);
      assert.ok(text.includes("/solutions/opportunity-readiness"), loc);
    }
  });

  it("routes questions to the most relevant capability", () => {
    assert.equal(
      routeQuestionToCapability("How do I track expiring certificates?"),
      "document_compliance",
    );
    assert.equal(
      routeQuestionToCapability("best software for supplier qualification"),
      "supplier_qualification",
    );
    assert.equal(
      routeQuestionToCapability("How can suppliers respond to questionnaires?"),
      "client_requests_questionnaires",
    );
    assert.equal(
      routeQuestionToCapability("How can companies organize business evidence?"),
      "evidence_intelligence",
    );
    assert.equal(
      routeQuestionToCapability("What is bid no-bid decision support?"),
      "decision_intelligence",
    );
    assert.equal(
      routeQuestionToCapability("How can companies discover relevant opportunities?"),
      "opportunity_intelligence",
    );
    assert.equal(
      routeQuestionToCapability("What is a company intelligence platform?"),
      "company_intelligence",
    );
  });

  it("detects answer language from the question", () => {
    assert.equal(detectAssistantLanguage("كيف أتابع مستندات الامتثال؟", "en"), "ar");
    assert.equal(detectAssistantLanguage("What is document compliance?", "ar"), "en");
  });

  it("system prompt includes knowledge, safety, brand, and language lock", async () => {
    const { system, answerLocale } = await resolveAssistantSystemPrompt({
      question: "What is Bidvera?",
      uiLocale: "en",
    });
    assert.equal(answerLocale, "en");
    assert.match(system, /Company Intelligence/i);
    assert.match(system, /Safety rules/i);
    assert.match(system, /BRAND \+ ROUTING RULE/i);
    assert.match(system, /LANGUAGE RULE/i);
  });

  it("polishes Arabic answers to use بيدفراء", () => {
    const out = polishAssistantAnswer("Bidvera helps with BID decisions.", "ar");
    assert.match(out, /بيدفراء/);
    assert.doesNotMatch(out, /Bidvera/);
    assert.match(out, /متوافق/);
  });
});
