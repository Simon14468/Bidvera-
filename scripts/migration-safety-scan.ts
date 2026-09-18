/**
 * Cross-platform migration safety scan for CI / deploy gates.
 * Blocks destructive or non-rolling-compatible SQL; allows FK/index recreates.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Patterns that must not ship via automatic deploy. */
const DENY_PATTERNS: RegExp[] = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bTRUNCATE\s+(TABLE\s+)?/i,
  /\bALTER\s+COLUMN\b[\s\S]{0,120}\bSET\s+NOT\s+NULL\b/i,
  /\bRENAME\s+COLUMN\b/i,
  /\bALTER\s+TABLE\b[\s\S]{0,120}\bRENAME\s+TO\b/i,
  /\bDELETE\s+FROM\b(?![\s\S]{0,80}\bWHERE\b)/i,
];

function walkSql(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkSql(p, out);
    else if (name.endsWith(".sql")) out.push(p);
  }
  return out;
}

export function scanMigrationSql(root = process.cwd()): string[] {
  const mig = join(root, "prisma", "migrations");
  const hits: string[] = [];
  for (const file of walkSql(mig)) {
    const text = readFileSync(file, "utf8");
    if (DENY_PATTERNS.some((re) => re.test(text))) {
      hits.push(file.replace(/\\/g, "/"));
    }
  }
  return hits;
}

export function scanDeployScriptsForDanger(root = process.cwd()): string[] {
  const hits: string[] = [];
  const paths = [
    join(root, "deploy", "scripts"),
    join(root, ".github", "workflows"),
  ];
  const danger =
    /migrate\s+reset|db\s+push\s+--force-reset|DROP\s+DATABASE|prisma\s+db\s+push\s+--accept-data-loss/i;
  for (const dir of paths) {
    try {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (!statSync(p).isFile()) continue;
        if (danger.test(readFileSync(p, "utf8"))) hits.push(p.replace(/\\/g, "/"));
      }
    } catch {
      /* optional */
    }
  }
  return hits;
}

const isMain =
  process.argv[1]?.replace(/\\/g, "/").endsWith("migration-safety-scan.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("migration-safety-scan.js");

if (isMain) {
  const sqlHits = scanMigrationSql();
  const scriptHits = scanDeployScriptsForDanger();
  if (sqlHits.length || scriptHits.length) {
    console.error(JSON.stringify({ ok: false, sqlHits, scriptHits }, null, 2));
    process.exit(2);
  }
  console.log(JSON.stringify({ ok: true, message: "migration-safety: OK" }));
}
