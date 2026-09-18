import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import {
  DATABASE_CAPACITY_MESSAGE,
  DATABASE_POOL_MESSAGE,
  isDatabaseCapacityError,
  isDatabasePoolError,
  rethrowDatabaseCapacityError,
} from "@/lib/db-capacity";
import {
  isPooledDatabaseHost,
  resolvePrismaDatasourceUrl,
} from "@/lib/prisma-url";

describe("database capacity errors", () => {
  it("detects Neon transfer quota lockouts", () => {
    assert.equal(
      isDatabaseCapacityError(
        new Error(
          "Error in connector: Error querying the database: ERROR: project has exceeded the data transfer quota. Upgrade your plan",
        ),
      ),
      true,
    );
    assert.equal(isDatabaseCapacityError(new Error("relation session does not exist")), false);
  });

  it("detects Prisma connection pool timeouts", () => {
    assert.equal(
      isDatabasePoolError(
        new Error(
          "Timed out fetching a new connection from the connection pool. (Current connection pool timeout: 10, connection limit: 9)",
        ),
      ),
      true,
    );
    assert.equal(isDatabasePoolError(Object.assign(new Error("x"), { code: "P2024" })), true);
    assert.equal(isDatabasePoolError(new Error("relation session does not exist")), false);
  });

  it("maps Decision Guardian blocks instead of a generic 500", () => {
    const error = new Error(
      "Decision Guardian blocked release: [REPORT_DATASET_MISMATCH] Web/PDF mismatch",
    );
    error.name = "DecisionGuardianError";
    const safe = toSafeClientError(error);
    assert.equal(safe.status, 409);
    assert.equal(safe.code, "DECISION_GUARDIAN_FAILED");
    assert.doesNotMatch(safe.message, /Guardian|REPORT_DATASET|mismatch/);
  });

  it("maps quota failures to a 503 instead of a generic 500", () => {
    const safe = toSafeClientError(
      new Error("ERROR: has exceeded the data transfer quota. Upgrade your plan"),
    );
    assert.equal(safe.status, 503);
    assert.equal(safe.code, ErrorCode.UPSTREAM);
    assert.equal(safe.message, DATABASE_CAPACITY_MESSAGE);
  });

  it("maps pool timeouts to a safe 503 without leaking Prisma internals", () => {
    const safe = toSafeClientError(
      new Error(
        'Invalid `prisma.systemSetting.findUnique()` invocation: Timed out fetching a new connection from the connection pool.',
      ),
    );
    assert.equal(safe.status, 503);
    assert.equal(safe.message, DATABASE_POOL_MESSAGE);
    assert.doesNotMatch(safe.message, /systemSetting|findUnique|connection limit: 9/);
  });

  it("rethrows quota errors as AppError", () => {
    assert.throws(
      () =>
        rethrowDatabaseCapacityError(
          new Error("Error querying the database: data transfer quota exceeded"),
        ),
      (error: unknown) =>
        error instanceof AppError && error.status === 503 && error.code === ErrorCode.UPSTREAM,
    );
  });

  it("rethrows pool errors as AppError", () => {
    assert.throws(
      () =>
        rethrowDatabaseCapacityError(
          new Error("Timed out fetching a new connection from the connection pool"),
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 503 &&
        error.message === DATABASE_POOL_MESSAGE,
    );
  });
});

describe("prisma datasource URL pool hardening", () => {
  it("detects Neon pooler hosts", () => {
    assert.equal(
      isPooledDatabaseHost("ep-odd-salad-axaml9gx-pooler.c-4.us-east-2.aws.neon.tech"),
      true,
    );
    assert.equal(isPooledDatabaseHost("ep-odd-salad-axaml9gx.c-4.us-east-2.aws.neon.tech"), false);
  });

  it("adds pgbouncer + bounded connection_limit for pooler URLs", () => {
    const resolved = resolvePrismaDatasourceUrl(
      "postgresql://u:p@ep-x-pooler.aws.neon.tech/neondb?sslmode=require",
    );
    assert.ok(resolved);
    assert.match(resolved!, /pgbouncer=true/);
    assert.match(resolved!, /connection_limit=5/);
    assert.match(resolved!, /pool_timeout=20/);
    assert.match(resolved!, /^postgresql:\/\//);
  });

  it("uses a higher default connection_limit for dedicated local Postgres", () => {
    const resolved = resolvePrismaDatasourceUrl(
      "postgresql://bidvera:x@127.0.0.1:5433/bidvera_load",
    );
    assert.ok(resolved);
    assert.match(resolved!, /connection_limit=40/);
    assert.doesNotMatch(resolved!, /pgbouncer=true/);
  });

  it("respects explicit env overrides and does not override existing params", () => {
    const resolved = resolvePrismaDatasourceUrl(
      "postgresql://u:p@ep-x-pooler.aws.neon.tech/neondb?connection_limit=3&pool_timeout=15",
      { PRISMA_CONNECTION_LIMIT: "99", PRISMA_POOL_TIMEOUT: "99" },
    );
    assert.match(resolved!, /connection_limit=3/);
    assert.match(resolved!, /pool_timeout=15/);
    assert.match(resolved!, /pgbouncer=true/);
  });
});
