import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local inspect / scratch scripts — not product source
    ".data/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/modules/tender-analysis/**",
      "src/modules/document-compliance/**",
      "src/modules/supplier-qualification/**",
      "src/modules/tender-calendar/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/tender-analysis/internal",
                "@/modules/tender-analysis/internal/*",
                "@/modules/tender-analysis/internal/**",
              ],
              message:
                "Tender Analysis internals are module-private. Import only from @/modules/tender-analysis.",
            },
            {
              group: [
                "@/modules/document-compliance/internal",
                "@/modules/document-compliance/internal/*",
                "@/modules/document-compliance/internal/**",
              ],
              message:
                "Document Compliance internals are module-private. Import only from @/modules/document-compliance.",
            },
            {
              group: [
                "@/modules/supplier-qualification/internal",
                "@/modules/supplier-qualification/internal/*",
                "@/modules/supplier-qualification/internal/**",
              ],
              message:
                "Supplier Qualification internals are module-private. Import only from @/modules/supplier-qualification.",
            },
            {
              group: [
                "@/modules/tender-calendar/internal",
                "@/modules/tender-calendar/internal/*",
                "@/modules/tender-calendar/internal/**",
              ],
              message:
                "Tender Calendar internals are module-private. Import only from @/modules/tender-calendar.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
