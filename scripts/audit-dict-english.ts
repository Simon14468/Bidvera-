/**
 * One-off audit helper — finds likely English leftovers in non-en dictionaries.
 * Run: npx tsx scripts/audit-dict-english.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src/i18n/dictionaries.ts"), "utf8");

function extractBlock(name: string, nextName: string | null): string {
  const start = src.indexOf(`const ${name}: Dictionary`);
  if (start < 0) throw new Error(`missing ${name}`);
  const end = nextName
    ? src.indexOf(`const ${nextName}: Dictionary`)
    : src.indexOf("const dictionaries:");
  return src.slice(start, end);
}

const ALLOW = new Set([
  "Bidvera",
  "REVIEW",
  "PDF",
  "OCR",
  "API",
  "URL",
  "ID",
  "OK",
  "CTA",
  "KPI",
  "SSO",
  "SaaS",
  "MVP",
]);

function scan(label: string, block: string) {
  const re = /([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*"([^"]*)"/g;
  const hits: { key: string; value: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const key = m[1];
    const value = m[2];
    const latin = (value.match(/[A-Za-z]/g) || []).length;
    const nonLatin = (value.match(/[^\x00-\x7F]/g) || []).length;
    if (latin < 4) continue;
    if (nonLatin > 0) continue; // has translated script chars
    if (ALLOW.has(value.trim())) continue;
    if (/^[\w.-]+@[\w.-]+$/.test(value)) continue;
    if (/^https?:\/\//i.test(value)) continue;
    if (/\{[a-zA-Z0-9_]+\}/.test(value) && latin < 8) continue;
    hits.push({ key, value });
  }
  console.log(`\n=== ${label}: ${hits.length} candidates ===`);
  for (const h of hits) console.log(`  ${h.key}: ${JSON.stringify(h.value)}`);
}

scan("ar", extractBlock("ar", "fr"));
scan("es", extractBlock("es", "zh"));
scan("zh", extractBlock("zh", "ar"));
scan("fr", extractBlock("fr", null));
