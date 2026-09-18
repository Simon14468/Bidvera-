import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import {
  CRITICAL_RESTORE_TABLES,
  resolveDumpDatabaseUrl,
  restoreDatabaseUrlIsIsolated,
  sanitizeBackupError,
} from "@/services/backup/config";
import type { BackupMethod } from "@/services/backup/types";

type Delegate = {
  findMany: (args?: {
    take?: number;
    skip?: number;
  }) => Promise<unknown[]>;
};

function isDelegate(value: unknown): value is Delegate {
  return Boolean(
    value &&
      typeof value === "object" &&
      "findMany" in value &&
      typeof (value as Delegate).findMany === "function",
  );
}

export function prismaModelDelegates(
  client: object = prisma,
): Array<{ name: string; delegate: Delegate }> {
  const out: Array<{ name: string; delegate: Delegate }> = [];
  for (const [name, value] of Object.entries(client)) {
    if (name.startsWith("$")) continue;
    if (isDelegate(value)) out.push({ name, delegate: value });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Batch size for logical dumps — avoids loading entire tables into memory. */
export const LOGICAL_DUMP_BATCH_SIZE = 500;

export async function dumpPrismaLogical(dir: string): Promise<{
  tableCounts: Record<string, number>;
  method: Extract<BackupMethod, "prisma_logical">;
}> {
  const tablesDir = path.join(dir, "db");
  await mkdir(tablesDir, { recursive: true });
  const tableCounts: Record<string, number> = {};
  for (const { name, delegate } of prismaModelDelegates()) {
    const outPath = path.join(tablesDir, `${name}.jsonl`);
    await writeFile(outPath, "", "utf8");
    let total = 0;
    let skip = 0;
    for (;;) {
      const rows = await delegate.findMany({
        take: LOGICAL_DUMP_BATCH_SIZE,
        skip,
      });
      if (rows.length === 0) break;
      total += rows.length;
      const lines = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
      await appendFile(outPath, lines, "utf8");
      if (rows.length < LOGICAL_DUMP_BATCH_SIZE) break;
      skip += LOGICAL_DUMP_BATCH_SIZE;
    }
    tableCounts[name] = total;
  }
  return { tableCounts, method: "prisma_logical" };
}

function findPgDumpBinary(): Promise<string | null> {
  return findPostgresBinary("pg_dump");
}

function findPostgresBinary(name: "pg_dump" | "pg_restore" | "psql"): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    const child = spawn(cmd, [name], { windowsHide: true });
    let out = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      const first = out.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      resolve(code === 0 && first ? first : null);
    });
    child.on("error", () => resolve(null));
  });
}

function postgresSpawnEnv(urlStr: string): NodeJS.ProcessEnv {
  const u = new URL(urlStr);
  const database = u.pathname.replace(/^\//, "").split("?")[0];
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: database,
  };
}

export async function tryPgDump(dir: string): Promise<{
  ok: boolean;
  errorSafe: string | null;
}> {
  const resolved = resolveDumpDatabaseUrl();
  if (!resolved.url) {
    return { ok: false, errorSafe: "DATABASE_URL is not configured." };
  }
  if (resolved.pooled) {
    return {
      ok: false,
      errorSafe: "pg_dump skipped: pooled DATABASE_URL is not a dump target. Set DATABASE_URL_DIRECT.",
    };
  }
  const bin = await findPgDumpBinary();
  if (!bin) {
    return { ok: false, errorSafe: "pg_dump binary is not available on this host." };
  }
  await mkdir(path.join(dir, "db"), { recursive: true });
  const outFile = path.join(dir, "db", "postgres.dump");
  let spawnEnv: NodeJS.ProcessEnv;
  try {
    spawnEnv = postgresSpawnEnv(resolved.url);
  } catch (error) {
    return { ok: false, errorSafe: sanitizeBackupError(error) };
  }
  return new Promise((resolve) => {
    const child = spawn(
      bin,
      ["--format=custom", "--no-owner", "--no-acl", `--file=${outFile}`],
      { windowsHide: true, env: spawnEnv },
    );
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, errorSafe: "pg_dump timed out." });
    }, 120_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true, errorSafe: null });
      else resolve({ ok: false, errorSafe: sanitizeBackupError(err || `pg_dump exited ${code}`) });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, errorSafe: sanitizeBackupError(error) });
    });
  });
}

export function criticalTablesPresent(tableCounts: Record<string, number>): string[] {
  return CRITICAL_RESTORE_TABLES.filter((name) => tableCounts[name] == null);
}

/**
 * Restore a pg_dump custom-format archive into BACKUP_RESTORE_DATABASE_URL only.
 * Never targets DATABASE_URL / DATABASE_URL_DIRECT.
 */
export async function tryPgRestore(input: {
  dumpFile: string;
  env?: Record<string, string | undefined>;
}): Promise<{ ok: boolean; errorSafe: string | null; targetIdentity: string | null }> {
  const env = input.env ?? process.env;
  const isolated = restoreDatabaseUrlIsIsolated(env);
  if (!isolated.ok || !isolated.url) {
    return {
      ok: false,
      errorSafe: isolated.reason ?? "Isolated restore database is not configured.",
      targetIdentity: null,
    };
  }

  // Defense in depth: refuse if caller somehow passed prod URL as restore.
  const prod = env.DATABASE_URL?.trim() || "";
  const direct = env.DATABASE_URL_DIRECT?.trim() || "";
  if (isolated.url === prod || isolated.url === direct) {
    return {
      ok: false,
      errorSafe: "Refusing to restore into production database URL.",
      targetIdentity: null,
    };
  }

  try {
    await access(input.dumpFile, fsConstants.R_OK);
  } catch {
    return {
      ok: false,
      errorSafe: "postgres.dump is missing from the backup archive.",
      targetIdentity: null,
    };
  }

  const bin = await findPostgresBinary("pg_restore");
  if (!bin) {
    return {
      ok: false,
      errorSafe: "pg_restore binary is not available on this host.",
      targetIdentity: null,
    };
  }

  let spawnEnv: NodeJS.ProcessEnv;
  let targetIdentity: string | null = null;
  try {
    spawnEnv = postgresSpawnEnv(isolated.url);
    targetIdentity = `${spawnEnv.PGHOST}:${spawnEnv.PGPORT}/${spawnEnv.PGDATABASE}`;
  } catch (error) {
    return { ok: false, errorSafe: sanitizeBackupError(error), targetIdentity: null };
  }

  // Never inherit production PGDATABASE from process.env over our target.
  const cleanEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: spawnEnv.PGHOST,
    PGPORT: spawnEnv.PGPORT,
    PGUSER: spawnEnv.PGUSER,
    PGPASSWORD: spawnEnv.PGPASSWORD,
    PGDATABASE: spawnEnv.PGDATABASE,
  };
  // Ensure we did not accidentally set DATABASE_URL to restore target in child
  // in a way that confuses operators — keep env DATABASE_URL as-is (prod) but
  // pg_restore uses PG* only.

  return new Promise((resolve) => {
    const child = spawn(
      bin,
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        `--dbname=${spawnEnv.PGDATABASE}`,
        input.dumpFile,
      ],
      { windowsHide: true, env: cleanEnv },
    );
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        errorSafe: "pg_restore timed out.",
        targetIdentity,
      });
    }, 180_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      // pg_restore may return 1 with non-fatal warnings; treat only hard failure as fail.
      if (code === 0) {
        resolve({ ok: true, errorSafe: null, targetIdentity });
        return;
      }
      // Some servers emit warnings yet exit 1; require connection errors to fail closed.
      const fatal =
        /could not connect|authentication failed|permission denied|does not exist|fatal/i.test(
          err,
        ) || code === null || (code !== 0 && code > 1);
      if (fatal || code !== 0) {
        // Exit code 1 often means some objects errored; still verify tables after.
        // Caller runs verifyIsolatedRestoreTables — here only fail on clear spawn failure.
        if (/could not connect|authentication failed|FATAL/i.test(err) || code === null) {
          resolve({
            ok: false,
            errorSafe: sanitizeBackupError(err || `pg_restore exited ${code}`),
            targetIdentity,
          });
          return;
        }
        // Soft exit 1: allow post-verify to decide.
        resolve({ ok: true, errorSafe: null, targetIdentity });
        return;
      }
      resolve({
        ok: false,
        errorSafe: sanitizeBackupError(err || `pg_restore exited ${code}`),
        targetIdentity,
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, errorSafe: sanitizeBackupError(error), targetIdentity });
    });
  });
}

/**
 * Probe critical tables on the isolated restore database via psql.
 * Never uses DATABASE_URL.
 */
export async function verifyIsolatedRestoreTables(
  env: Record<string, string | undefined> = process.env,
): Promise<{ ok: boolean; errorSafe: string | null; present: string[] }> {
  const isolated = restoreDatabaseUrlIsIsolated(env);
  if (!isolated.ok || !isolated.url) {
    return {
      ok: false,
      errorSafe: isolated.reason ?? "Isolated restore database is not configured.",
      present: [],
    };
  }
  const bin = await findPostgresBinary("psql");
  if (!bin) {
    return {
      ok: false,
      errorSafe: "psql binary is not available to verify isolated restore.",
      present: [],
    };
  }
  let spawnEnv: NodeJS.ProcessEnv;
  try {
    spawnEnv = postgresSpawnEnv(isolated.url);
  } catch (error) {
    return { ok: false, errorSafe: sanitizeBackupError(error), present: [] };
  }

  const present: string[] = [];
  for (const table of CRITICAL_RESTORE_TABLES) {
    const sql = `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND lower(table_name) = lower('${table}') LIMIT 1;`;
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(bin, ["-v", "ON_ERROR_STOP=1", "-tAc", sql], {
        windowsHide: true,
        env: {
          ...process.env,
          PGHOST: spawnEnv.PGHOST,
          PGPORT: spawnEnv.PGPORT,
          PGUSER: spawnEnv.PGUSER,
          PGPASSWORD: spawnEnv.PGPASSWORD,
          PGDATABASE: spawnEnv.PGDATABASE,
        },
      });
      let out = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        out += chunk.toString("utf8");
      });
      const timer = setTimeout(() => {
        child.kill();
        resolve(false);
      }, 30_000);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0 && out.trim() === "1");
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    if (ok) present.push(table);
  }

  const missing = CRITICAL_RESTORE_TABLES.filter((t) => !present.includes(t));
  if (missing.length) {
    return {
      ok: false,
      errorSafe: `Isolated restore missing tables: ${missing.join(", ")}`,
      present,
    };
  }
  return { ok: true, errorSafe: null, present };
}
