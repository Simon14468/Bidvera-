import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlanLanguagesDraft,
  localizePlanMarketing,
  localizePlanMarketingBundle,
  mergePlanTranslations,
  parsePlanTranslations,
} from "@/services/billing/plan-i18n";

test("plan translations parse valid locale copy", () => {
  const parsed = parsePlanTranslations({
    ar: { name: "برو", features: ["دعم بالبريد"] },
    bad: "nope",
  });
  assert.equal(parsed.ar?.name, "برو");
  assert.deepEqual(parsed.ar?.features, ["دعم بالبريد"]);
});

test("localize prefers admin translations over built-in map", () => {
  const out = localizePlanMarketing({
    slug: "starter",
    name: "Starter",
    description: null,
    featureList: ["20 analyses / month", "Email support"],
    translations: {
      ar: {
        name: "مخصص",
        features: ["ميزة مخصصة ١", "ميزة مخصصة ٢"],
      },
    },
    locale: "ar",
  });
  assert.equal(out.name, "مخصص");
  assert.deepEqual(out.featureList, ["ميزة مخصصة ١", "ميزة مخصصة ٢"]);
});

test("monthly vs yearly features switch from Admin copy", () => {
  const bundle = localizePlanMarketingBundle({
    slug: "starter",
    name: "Starter",
    description: null,
    featureList: ["20 analyses / month"],
    translations: {
      ar: {
        monthly: {
          name: "المبتدئ",
          features: ["٢٠ تحليلًا / شهر", "دعم شهري"],
        },
        yearly: {
          name: "المبتدئ سنوي",
          features: ["٢٠ تحليلًا / شهر", "وفّر شهرين"],
        },
      },
    },
    locale: "ar",
  });
  assert.equal(bundle.month.name, "المبتدئ");
  assert.deepEqual(bundle.month.featureList, ["٢٠ تحليلًا / شهر", "دعم شهري"]);
  assert.equal(bundle.year.name, "المبتدئ سنوي");
  assert.deepEqual(bundle.year.featureList, ["٢٠ تحليلًا / شهر", "وفّر شهرين"]);
});

test("published locale with name only uses EN features not phantom map", () => {
  const out = localizePlanMarketing({
    slug: "trial",
    name: "Trial",
    description: null,
    featureList: ["3 free tender analyses", "Company profile"],
    translations: {
      ar: { name: "تجريبي" },
    },
    locale: "ar",
  });
  assert.equal(out.name, "تجريبي");
  assert.deepEqual(out.featureList, [
    "3 free tender analyses",
    "Company profile",
  ]);
});

test("unpublished locale uses temporary suggestions until Admin saves", () => {
  const out = localizePlanMarketing({
    slug: "starter",
    name: "Starter",
    description: null,
    featureList: ["Email support", "Company profile"],
    translations: null,
    locale: "ar",
  });
  assert.equal(out.featureList[0], "دعم بالبريد");
  assert.equal(out.featureList[1], "ملف الشركة");
});

test("localize keeps English canonical fields", () => {
  const out = localizePlanMarketing({
    slug: "pro",
    name: "Pro",
    description: "desc",
    featureList: ["Email support"],
    translations: { ar: { name: "برو" } },
    locale: "en",
  });
  assert.equal(out.name, "Pro");
  assert.equal(out.description, "desc");
  assert.deepEqual(out.featureList, ["Email support"]);
});

test("buildPlanLanguagesDraft fills monthly and yearly", () => {
  const draft = buildPlanLanguagesDraft({
    slug: "trial",
    name: "Trial",
    description: null,
    featureList: ["3 free tender analyses", "Full decision workspace"],
    translations: { ar: { name: "تجريبي" } },
  });
  assert.equal(draft.ar?.monthly?.name, "تجريبي");
  assert.ok((draft.ar?.monthly?.features?.length ?? 0) >= 2);
  assert.ok((draft.ar?.yearly?.features?.length ?? 0) >= 2);
  assert.ok(
    (draft.ar?.yearly?.features?.length ?? 0) >=
      (draft.ar?.monthly?.features?.length ?? 0),
  );
});

test("mergePlanTranslations keeps yearly when patching monthly", () => {
  const merged = mergePlanTranslations(
    {
      ar: {
        monthly: { name: "قديم", features: ["أ"] },
        yearly: { name: "سنوي", features: ["س"] },
      },
    },
    {
      ar: {
        monthly: { name: "جديد", features: ["ب"] },
      },
    },
  );
  assert.equal(merged?.ar?.monthly?.name, "جديد");
  assert.deepEqual(merged?.ar?.monthly?.features, ["ب"]);
  assert.equal(merged?.ar?.yearly?.name, "سنوي");
  assert.deepEqual(merged?.ar?.yearly?.features, ["س"]);
});

test("translateMarketingFeatureLine covers entitlement + dynamic limits", async () => {
  const { translateMarketingFeatureLine } = await import(
    "@/services/billing/plan-i18n"
  );
  assert.equal(
    translateMarketingFeatureLine("Full decision workspace", "ar"),
    "مساحة قرار كاملة",
  );
  assert.equal(
    translateMarketingFeatureLine("Decision Memory", "fr"),
    "Mémoire de décision",
  );
  assert.match(
    translateMarketingFeatureLine("20 analyses / month", "ar"),
    /تحليل/,
  );
  assert.match(
    translateMarketingFeatureLine("Up to 2 seats", "es"),
    /2 asientos/,
  );
  assert.match(
    translateMarketingFeatureLine("75 analyses / year", "zh"),
    /75/,
  );
});

test("buildPlanLanguagesDraft seeds from Plan Editor entitlement bullets", () => {
  const draft = buildPlanLanguagesDraft({
    slug: "starter",
    name: "Starter",
    description: "Grow",
    featureList: [
      "20 analyses / month",
      "Up to 2 seats",
      "Full decision workspace",
      "Company profile",
    ],
    yearlyFeatureList: [
      "240 analyses / year",
      "Up to 2 seats",
      "Full decision workspace",
    ],
    translations: null,
  });
  assert.ok(draft.ar?.monthly?.features?.some((f) => /تحليل/.test(f)));
  assert.ok(
    draft.ar?.yearly?.features?.some(
      (f) => f.includes("سنة") || /تحليل/.test(f),
    ),
  );
  assert.equal(draft.fr?.monthly?.name, "Starter");
});
