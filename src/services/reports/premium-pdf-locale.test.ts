import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolvePdfLocale,
  sanitizePdfText,
} from "@/services/reports/premium-pdf-locale";

describe("PDF locale policy", () => {
  it("maps Arabic UI to English PDF", () => {
    assert.equal(resolvePdfLocale("ar"), "en");
  });

  it("keeps Latin-script locales", () => {
    assert.equal(resolvePdfLocale("en"), "en");
    assert.equal(resolvePdfLocale("fr"), "fr");
    assert.equal(resolvePdfLocale("es"), "es");
  });

  it("falls back Chinese UI to English PDF chrome", () => {
    assert.equal(resolvePdfLocale("zh"), "en");
  });

  it("strips Arabic script while preserving French and English", () => {
    const mixed =
      "Fourniture et installation — équipement / توريد وتركيب";
    const clean = sanitizePdfText(mixed);
    assert.ok(clean.includes("équipement"));
    assert.ok(clean.includes("Fourniture"));
    assert.ok(!/[\u0600-\u06FF]/.test(clean));
  });
});
